import { z } from 'zod';
import prisma from '../../lib/prisma.js';
import { recalculateUserTiers } from '../../services/tierAssignmentService.js';

const ChangeRoleSchema = z.object({
  role: z.enum(['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN']),
});

/**
 * List all admin users (both registered active administrators and pending invites).
 *
 * Why in-memory merge? Combines registered users having admin privileges and pending pre-authorized
 * allowed email entries, eliminating two separate views and avoiding parallel UI calls.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function listAdminUsers(req, res, next) {
  try {
    const adminRoles = ['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'];
    
    const registeredUsers = await prisma.user.findMany({
      where: { role: { in: adminRoles } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isProtected: true,
        createdAt: true,
      },
    });

    const allowedEmails = await prisma.allowedAdminEmail.findMany();

    const registeredEmails = new Set(registeredUsers.map(u => u.email.toLowerCase().trim()));

    const pendingUsers = allowedEmails
      .filter(entry => !registeredEmails.has(entry.email.toLowerCase().trim()))
      .map(entry => ({
        id: `pending-${entry.id}`,
        email: entry.email,
        firstName: 'Pending',
        lastName: 'Sign-up',
        role: entry.role,
        isActive: false,
        isPending: true,
        isProtected: false,
        createdAt: entry.createdAt,
      }));

    const allUsers = [...registeredUsers, ...pendingUsers].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.status(200).json({ users: allUsers });
  } catch (error) {
    next(error);
  }
}

/**
 * Update the role of an active admin user or a pending pre-assigned invitation.
 *
 * Why dynamic routing? Translates prefix-based virtual IDs (e.g. pending-ID) to the AllowedAdminEmail
 * table or standard User table updates dynamically, maintaining a single API interface.
 * Why transaction? Wrapping updates and audit logs atomically prevents partial database commits.
 * Why self-modification guard? Prevents administrators from demoting themselves or altering their own pre-assignments.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function changeUserRole(req, res, next) {
  try {
    const targetUserId = req.params.id;

    const parsed = ChangeRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid role specified.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { role: newRole } = parsed.data;

    // Handle role changes for pending/unregistered admin email invitations
    if (targetUserId.startsWith('pending-')) {
      const allowedId = parseInt(targetUserId.replace('pending-', ''), 10);
      if (isNaN(allowedId)) {
        return res.status(400).json({ error: 'validation_error', message: 'Invalid pending invite ID.' });
      }

      const entry = await prisma.allowedAdminEmail.findUnique({ where: { id: allowedId } });
      if (!entry) {
        return res.status(404).json({ error: 'not_found', message: 'Pending invite not found.' });
      }

      if (req.adminUser.email.toLowerCase() === entry.email.toLowerCase()) {
        return res.status(400).json({ error: 'bad_request', message: 'You cannot modify your own pre-assignment.' });
      }

      const updatedEntry = await prisma.allowedAdminEmail.update({
        where: { id: allowedId },
        data: { role: newRole },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.adminUser.userId,
          action: 'INVITE_ROLE_CHANGE',
          oldValue: entry.role,
          newValue: `Email: ${entry.email}, Role: ${newRole}`,
          ipAddress: req.ip || null,
        },
      });

      return res.status(200).json({
        status: 'SUCCESS',
        message: `Pending invite role updated to ${newRole}.`,
        user: {
          id: targetUserId,
          email: entry.email,
          firstName: 'Pending',
          lastName: 'Sign-up',
          role: newRole,
          isPending: true,
        },
      });
    }

    // Handle role changes for active registered admin users
    if (req.adminUser.userId === targetUserId) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Sysadmins cannot modify their own role. Another Sysadmin must do this.',
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, role: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'user_not_found', message: 'The target user was not found.' });
    }

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { role: newRole, tokenVersion: { increment: 1 } },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, tokenVersion: true },
      }),
      prisma.allowedAdminEmail.upsert({
        where: { email: targetUser.email.toLowerCase().trim() },
        update: { role: newRole },
        create: { email: targetUser.email.toLowerCase().trim(), role: newRole },
      }),
      prisma.auditLog.create({
        data: {
          actorId: req.adminUser.userId,
          targetUserId: targetUserId,
          action: 'ROLE_CHANGE',
          oldValue: targetUser.role,
          newValue: newRole,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        },
      }),
    ]);

    return res.status(200).json({
      status: 'SUCCESS',
      message: `User role successfully updated to ${newRole}.`,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove an admin user (demotes active user back to DONOR or deletes pending invite entry).
 *
 * Why transaction? Wrapping database demotions, pre-assigned email deletions, and audit trails
 * in a transaction ensures administrators are demoted cleanly without leaving stale permissions.
 * Why isProtected guard? Prevents seed system admin users from being demoted automatically.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function removeAdmin(req, res, next) {
  try {
    const id = req.params.id;

    // Handle removal of un-registered admin pre-assignments
    if (id.startsWith('pending-')) {
      const allowedId = parseInt(id.replace('pending-', ''), 10);
      if (isNaN(allowedId)) {
        return res.status(400).json({ error: 'validation_error', message: 'Invalid invite ID.' });
      }

      const entry = await prisma.allowedAdminEmail.findUnique({ where: { id: allowedId } });
      if (!entry) {
        return res.status(404).json({ error: 'not_found', message: 'Pending invite not found.' });
      }

      if (req.adminUser.email.toLowerCase() === entry.email.toLowerCase()) {
        return res.status(400).json({ error: 'bad_request', message: 'You cannot remove your own invitation.' });
      }

      await prisma.allowedAdminEmail.delete({ where: { id: allowedId } });

      return res.status(200).json({
        status: 'SUCCESS',
        message: `Pending invite for ${entry.email} successfully removed.`,
      });
    }

    // Handle demotion of registered active administrators
    if (req.adminUser.userId === id) {
      return res.status(400).json({ error: 'bad_request', message: 'You cannot remove or demote yourself.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isProtected: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found.' });
    }

    if (targetUser.isProtected) {
      return res.status(400).json({ error: 'bad_request', message: 'Protected administrators cannot be demoted.' });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { role: 'DONOR', tokenVersion: { increment: 1 } },
      }),
      prisma.allowedAdminEmail.deleteMany({
        where: { email: targetUser.email.toLowerCase().trim() },
      }),
      prisma.auditLog.create({
        data: {
          actorId: req.adminUser.userId,
          targetUserId: id,
          action: 'INVITE_DEMOTE',
          oldValue: targetUser.role,
          newValue: 'DONOR',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        },
      }),
    ]);

    return res.status(200).json({
      status: 'SUCCESS',
      message: `User ${targetUser.email} demoted to DONOR and removed from allowed list.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all standard donor users and their assigned tiers (both manual and auto).
 *
 * Why? Provides the admin user interface with the list of standard donors to allow tier management.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function listDonors(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const search = req.query.search ? String(req.query.search).trim() : '';

    const skip = (page - 1) * limit;

    const where = {
      role: 'DONOR',
    };

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const [donors, totalCount] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          monthlyAmount: true,
          isActive: true,
          createdAt: true,
          userTiers: {
            include: {
              tier: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return res.status(200).json({
      donors,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

const AssignTierSchema = z.object({
  tierId: z.number({ coerce: true }).int().positive(),
});

/**
 * Manually assign a tier to a user.
 *
 * Why? Allows administrators to assign custom perks/tiers independent of transaction amounts.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function assignTierToUser(req, res, next) {
  try {
    const userId = req.params.id;
    
    const parsed = AssignTierSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid Tier ID specified.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { tierId: tierIdParsed } = parsed.data;

    const [user, tier] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.tier.findUnique({ where: { id: tierIdParsed } }),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'User not found.' });
    }
    if (!tier) {
      return res.status(404).json({ error: 'not_found', message: 'Tier not found.' });
    }

    if (tier.isAutoAppliedBySum) {
      return res.status(409).json({
        error: 'conflict',
        message: `"${tier.name}" is automatically assigned based on monthly subscription amount and cannot be manually assigned. Use a standalone override tier (e.g. VIP Patron) instead.`,
      });
    }

    const userTier = await prisma.userTier.upsert({
      where: {
        userId_tierId: {
          userId,
          tierId: tierIdParsed,
        },
      },
      create: {
        userId,
        tierId: tierIdParsed,
        assignedBy: 'MANUAL',
      },
      update: {
        assignedBy: 'MANUAL',
      },
    });

    // Automatically recalculate auto-assigned tiers immediately
    await recalculateUserTiers(userId);

    return res.status(200).json({
      status: 'SUCCESS',
      message: `Tier "${tier.name}" manually assigned to user.`,
      userTier,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Manually remove an assigned tier from a user.
 *
 * Why? Allows administrators to revoke manually assigned tiers.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function removeTierFromUser(req, res, next) {
  try {
    const userId = req.params.id;
    const tierId = parseInt(req.params.tierId, 10);

    if (isNaN(tierId)) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid Tier ID.' });
    }

    const existing = await prisma.userTier.findUnique({
      where: {
        userId_tierId: {
          userId,
          tierId,
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'User does not hold this tier.' });
    }

    if (existing.assignedBy === 'AUTO_SUM') {
      return res.status(409).json({
        error: 'conflict',
        message: 'This tier is automatically assigned based on subscription amount and cannot be removed manually.',
      });
    }

    await prisma.userTier.delete({
      where: {
        userId_tierId: {
          userId,
          tierId,
        },
      },
    });

    // Automatically recalculate auto-assigned tiers immediately
    // so if the user still qualifies via subscription, they don't lose the tier
    await recalculateUserTiers(userId);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Tier removed from user successfully.',
    });
  } catch (error) {
    next(error);
  }
}


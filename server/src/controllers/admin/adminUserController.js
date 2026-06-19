import { z } from 'zod';
import prisma from '../../lib/prisma.js';

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
          newValue: newRole,
          newValue: `Email: ${entry.email}, Role: ${newRole}`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
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

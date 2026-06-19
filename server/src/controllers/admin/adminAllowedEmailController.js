import { z } from 'zod';
import prisma from '../../lib/prisma.js';

const AllowedEmailSchema = z.object({
  email: z.string().email().transform(val => val.toLowerCase().trim()),
  role: z.enum(['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN']),
});

/**
 * Add or pre-assign an allowed admin email role.
 *
 * Why transaction? Wrapping the allowed email pre-assignment check and potential target user
 * role promotion in a transaction guarantees that we do not leave database roles in an inconsistent state.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function addAllowedEmail(req, res, next) {
  try {
    const parsed = AllowedEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid email or role specified.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, role } = parsed.data;

    // Block sysadmins from modifying their own allowed email settings to prevent lockout
    if (req.adminUser.email.toLowerCase() === email) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'You cannot invite or add your own email.',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Upsert the allowed email mapping
      const allowedEntry = await tx.allowedAdminEmail.upsert({
        where: { email },
        update: { role },
        create: { email, role },
      });

      // Find if this user already exists
      const targetUser = await tx.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });

      let updatedUser = null;

      // If the user exists and has a different role, promote or update their role
      if (targetUser && targetUser.role !== role) {
        updatedUser = await tx.user.update({
          where: { id: targetUser.id },
          data: {
            role: role,
            tokenVersion: { increment: 1 },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: req.adminUser.userId,
            targetUserId: targetUser.id,
            action: 'INVITE_PROMOTE',
            oldValue: targetUser.role,
            newValue: role,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
          },
        });
      }

      return { allowedEntry, updatedUser };
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: `Email ${email} successfully invited with role ${role}.`,
      allowedEmail: result.allowedEntry,
      userUpdated: !!result.updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

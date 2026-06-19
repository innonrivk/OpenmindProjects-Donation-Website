import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../../lib/prismaPublic.js';
import { issueTokenCookie } from '../../middleware/auth.js';
import { sendEmail } from '../../services/email.js';

const SALT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 15;
const MAX_OTP_ATTEMPTS = 5;

const SignupSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const OtpVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  password: z.string().min(8).optional(),
});

/**
 * Generate a random 6-digit numeric OTP code.
 * @returns {string} Plain OTP code.
 */
function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Sends the OTP verification email notification.
 * @param {string} email - Recipient email.
 * @param {string} otp - Plain OTP code.
 * @param {string} purpose - OTP use-case.
 * @param {string|null} newEmail - Prospective new email.
 * @returns {Promise<boolean>} Sent status.
 */
export async function sendOtpEmailWrapper(email, otp, purpose, newEmail = null) {
  let subject = 'OMP Donation Site Verification Code';
  let title = 'Your Verification Code';
  let messageText = `Your code is ${otp}. It is valid for 15 minutes.`;

  if (purpose === 'REGISTRATION') {
    subject = 'Activate Your OMP Account';
    title = 'Activate Your Account';
    messageText = `Thank you for signing up to support OpenmindProjects. Your verification code is ${otp}. It is valid for 15 minutes.`;
  } else if (purpose === 'PASSWORD_CHANGE') {
    subject = 'Reset Your OMP Password';
    title = 'Reset Your Password';
    messageText = `A password change request was triggered. Your verification code is ${otp}. It is valid for 15 minutes.`;
  } else if (purpose === 'EMAIL_CHANGE') {
    subject = 'Verify Your New OMP Email';
    title = 'Verify Your New Email';
    messageText = `An email change request to change your account email to ${newEmail} was triggered. Your verification code is ${otp}. It is valid for 15 minutes.`;
  } else if (purpose === 'ACCOUNT_DELETE') {
    subject = 'Confirm Your OMP Account Deletion';
    title = 'Delete Your Account';
    messageText = `An account deletion request was triggered. Your verification code is ${otp}. It is valid for 15 minutes. This action is permanent.`;
  }

  return sendEmail({
    to: newEmail || email,
    subject,
    title,
    messageText,
    otp,
  });
}

/**
 * Hashes, stores, and dispatches a verification OTP code.
 * @param {string} email - Recipient email.
 * @param {string} purpose - Purpose of OTP generation.
 * @param {string|null} newEmail - Proposed new email.
 * @returns {Promise<void>}
 */
export async function createAndStoreOtp(email, purpose, newEmail = null) {
  await prisma.userOtp.deleteMany({ where: { email, purpose } });

  const plainOtp = generateOtp();
  const hashedOtp = await bcrypt.hash(plainOtp, SALT_ROUNDS);

  await prisma.userOtp.create({
    data: {
      email,
      otp: hashedOtp,
      purpose,
      newEmail,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    },
  });

  await sendOtpEmailWrapper(email, plainOtp, purpose, newEmail);
}

/**
 * Handle new user signups.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function signup(req, res, next) {
  try {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid input.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { firstName, lastName, email, password } = parsed.data;
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser && existingUser.password) {
      return res.status(409).json({
        error: 'email_taken',
        message: 'An account with this email already exists. Please log in.',
      });
    }

    if (existingUser && !existingUser.password) {
      await createAndStoreOtp(email, 'REGISTRATION');
      return res.status(200).json({
        status: 'OTP_REQUIRED',
        message: 'A verification code has been sent to your email.',
        email,
      });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    let user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: hashedPassword,
        role: 'DONOR',
      },
    });

    // Check if the user email has a pre-assigned admin role
    const allowedAdmin = await prisma.allowedAdminEmail.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (allowedAdmin && user.role !== allowedAdmin.role) {
      const originalRole = user.role;
      user = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: {
            role: allowedAdmin.role,
            tokenVersion: { increment: 1 },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            targetUserId: user.id,
            action: 'AUTO_PROMOTE_SIGNUP',
            oldValue: originalRole,
            newValue: allowedAdmin.role,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
          },
        });
        return updated;
      });
    }

    issueTokenCookie(res, user);
    return res.status(201).json({
      status: 'CREATED',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify a received OTP.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function verifyOtp(req, res, next) {
  try {
    const parsed = OtpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid input.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, otp, password } = parsed.data;
    const otpRecord = await prisma.userOtp.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(404).json({ error: 'otp_not_found', message: 'No verification code found. Please request a new one.' });
    }

    if (new Date() > otpRecord.expiresAt) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(410).json({ error: 'otp_expired', message: 'Verification code has expired. Please request a new one.' });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(429).json({ error: 'too_many_attempts', message: 'Too many attempts. Please request a new verification code.' });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) {
      await prisma.userOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });

      const remaining = MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1);
      return res.status(401).json({
        error: 'invalid_otp',
        message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
        attemptsRemaining: remaining,
      });
    }

    await prisma.userOtp.delete({ where: { id: otpRecord.id } });

    if (otpRecord.purpose === 'REGISTRATION') {
      if (!password) {
        return res.status(400).json({ error: 'password_required', message: 'Password is required for account activation.' });
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      let user = await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });

      // Check if the user email has a pre-assigned admin role
      const allowedAdmin = await prisma.allowedAdminEmail.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (allowedAdmin && user.role !== allowedAdmin.role) {
        const originalRole = user.role;
        user = await prisma.$transaction(async (tx) => {
          const updated = await tx.user.update({
            where: { id: user.id },
            data: {
              role: allowedAdmin.role,
              tokenVersion: { increment: 1 },
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              targetUserId: user.id,
              action: 'AUTO_PROMOTE_OTP',
              oldValue: originalRole,
              newValue: allowedAdmin.role,
              ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
            },
          });
          return updated;
        });
      }

      issueTokenCookie(res, user);
      return res.status(201).json({
        status: 'ACTIVATED',
        message: 'Account activated successfully.',
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      });
    }

    // Pass password changes and email changes to follow-up controllers or return payload
    return res.status(400).json({ error: 'unknown_purpose', message: 'Unknown OTP purpose.' });
  } catch (error) {
    next(error);
  }
}

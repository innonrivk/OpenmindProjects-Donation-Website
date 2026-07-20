import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { issueAdminToken } from '../../middleware/adminAuth.js';
import { sendEmail } from '../../services/email.js';
import { ErrorCodes } from '../../lib/errors.js';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';
const SALT_ROUNDS = 12;
const MAX_OTP_ATTEMPTS = 5;
const OTP_EXPIRY_MINUTES = 15;

/**
 * Sends a branded security OTP email to the administrator.
 *
 * Why? Admin security events require custom template wording to reassure
 * portal owners and specify the exact action being verified (email or password change).
 *
 * @param {string} email - Recipient email.
 * @param {string} otp - Plaintext OTP.
 * @param {string} purpose - 'PASSWORD_CHANGE' | 'EMAIL_CHANGE'
 * @param {string|null} [newEmail=null] - Prospective new email.
 */
async function sendAdminOtpEmail(email, otp, purpose, newEmail = null) {
  let subject = 'OMP Admin Security Code';
  let title = 'Admin Portal Verification';
  let messageText = `Your OMP Admin security verification code is ${otp}. It is valid for 15 minutes.`;

  if (purpose === 'PASSWORD_CHANGE') {
    subject = 'Reset Your OMP Admin Password';
    title = 'Admin Password Change';
    messageText = `An admin password change request was triggered. Your verification code is:`;
  } else if (purpose === 'EMAIL_CHANGE') {
    subject = 'Verify Your New OMP Admin Email';
    title = 'Admin Email Change';
    messageText = `A request to change your admin account email to ${newEmail} was triggered. Your verification code is:`;
  }

  await sendEmail({
    to: newEmail || email,
    subject,
    title,
    messageText,
    otp,
  });
}

/**
 * Dispatch OTP verification code for admin password changes.
 *
 * Why? Asserts the administrator is authenticated and dispatches a secure
 * short-lived OTP verification code to their registered email before writing password changes.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function requestPasswordOtp(req, res, next) {
  try {
    const email = req.adminUser.email;
    await prisma.userOtp.deleteMany({ where: { email, purpose: 'PASSWORD_CHANGE' } });

    const plainOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(plainOtp, SALT_ROUNDS);

    await prisma.userOtp.create({
      data: {
        email,
        otp: hashedOtp,
        purpose: 'PASSWORD_CHANGE',
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    await sendAdminOtpEmail(email, plainOtp, 'PASSWORD_CHANGE');

    return res.status(200).json({
      status: 'OTP_SENT',
      message: 'Verification code sent to your email.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle password changes after admin OTP confirmation.
 *
 * Why? Implements strict brute-force protection (max 5 attempts) and updates
 * the admin password safely in the database using bcrypt hashing.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function changePassword(req, res, next) {
  try {
    const { otp, newPassword } = req.body;
    const email = req.adminUser.email;

    if (!otp || !newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'OTP and new password (8+ chars) are required.',
      });
    }

    const otpRecord = await prisma.userOtp.findFirst({
      where: { email, purpose: 'PASSWORD_CHANGE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(404).json({
        error: 'otp_not_found',
        message: 'No active verification code found. Please request a new one.',
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(410).json({
        error: 'otp_expired',
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(429).json({
        error: 'too_many_attempts',
        message: 'Too many incorrect attempts. Verification code locked.',
      });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) {
      const nextAttempts = otpRecord.attempts + 1;
      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        await prisma.userOtp.delete({ where: { id: otpRecord.id } });
        return res.status(429).json({
          error: 'too_many_attempts',
          message: 'Too many incorrect attempts. Verification code locked.',
        });
      }

      await prisma.userOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: nextAttempts },
      });

      const remaining = MAX_OTP_ATTEMPTS - nextAttempts;
      return res.status(401).json({
        error: 'invalid_otp',
        message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    // Success: Consume OTP and update password
    await prisma.userOtp.delete({ where: { id: otpRecord.id } });

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: req.adminUser.userId },
      data: { password: hashedPassword },
    });

    return res.status(200).json({
      status: 'PASSWORD_CHANGED',
      message: 'Password updated successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Dispatch OTP verification code for admin email changes.
 *
 * Why? Asserts the proposed new email is valid, unique, and not already in use
 * before dispatching a secure verification code directly to the target address.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function requestEmailOtp(req, res, next) {
  try {
    const { newEmail } = req.body;
    const currentEmail = req.adminUser.email;

    if (!newEmail || !z.string().email().safeParse(newEmail).success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'A valid new email address is required.',
      });
    }

    if (newEmail === currentEmail) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'New email cannot be the same as your current email.',
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) {
      return res.status(409).json({
        error: 'email_taken',
        message: 'This email is already in use.',
      });
    }

    await prisma.userOtp.deleteMany({ where: { email: currentEmail, purpose: 'EMAIL_CHANGE' } });

    const plainOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(plainOtp, SALT_ROUNDS);

    await prisma.userOtp.create({
      data: {
        email: currentEmail,
        otp: hashedOtp,
        purpose: 'EMAIL_CHANGE',
        newEmail,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    await sendAdminOtpEmail(currentEmail, plainOtp, 'EMAIL_CHANGE', newEmail);

    return res.status(200).json({
      status: 'OTP_SENT',
      message: 'Verification code sent to the new email.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle updating admin email after OTP verification.
 *
 * Why? Updates email, re-signs the JWT tokens with the fresh email payload,
 * resets the httpOnly refresh cookie, and returns credentials to sync the SPA state.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function changeEmail(req, res, next) {
  try {
    const { otp } = req.body;
    const email = req.adminUser.email;

    if (!otp) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Verification code is required.',
      });
    }

    const otpRecord = await prisma.userOtp.findFirst({
      where: { email, purpose: 'EMAIL_CHANGE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(404).json({
        error: 'otp_not_found',
        message: 'No active verification code found.',
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(410).json({
        error: 'otp_expired',
        message: 'Verification code has expired.',
      });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(429).json({
        error: 'too_many_attempts',
        message: 'Too many incorrect attempts. Verification code locked.',
      });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) {
      const nextAttempts = otpRecord.attempts + 1;
      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        await prisma.userOtp.delete({ where: { id: otpRecord.id } });
        return res.status(429).json({
          error: 'too_many_attempts',
          message: 'Too many incorrect attempts. Verification code locked.',
        });
      }

      await prisma.userOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: nextAttempts },
      });

      const remaining = MAX_OTP_ATTEMPTS - nextAttempts;
      return res.status(401).json({
        error: 'invalid_otp',
        message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    // Success: Consume OTP and write email change
    await prisma.userOtp.delete({ where: { id: otpRecord.id } });

    const newEmail = otpRecord.newEmail;
    const updatedUser = await prisma.user.update({
      where: { id: req.adminUser.userId },
      data: { email: newEmail },
    });

    // Re-sign JWT tokens for admin session sync
    const accessToken = issueAdminToken(updatedUser);
    const refreshToken = jwt.sign(
      { userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
      ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('adminRefreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.status(200).json({
      status: 'EMAIL_CHANGED',
      message: 'Email address updated successfully.',
      accessToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      },
    });
  } catch (error) {
    next(error);
  }
}

import bcrypt from 'bcrypt';
import { z } from 'zod';
import prisma from '../../lib/prismaPublic.js';
import { issueTokenCookie } from '../../middleware/auth.js';
import { stripe, isMockMode, listActiveSubscriptions } from '../../services/stripe.js';
import { createAndStoreOtp } from './authUserController.js';

const SALT_ROUNDS = 12;
const MAX_OTP_ATTEMPTS = 5;

/**
 * Send OTP code for password changes.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function requestPasswordOtp(req, res, next) {
  try {
    await createAndStoreOtp(req.user.email, 'PASSWORD_CHANGE');
    return res.status(200).json({
      status: 'OTP_SENT',
      message: 'Verification code sent to your email.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle password changes after OTP confirmation.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function changePassword(req, res, next) {
  try {
    const { otp, newPassword } = req.body;

    if (!otp || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'validation_error', message: 'OTP and new password (8+ chars) are required.' });
    }

    const otpRecord = await prisma.userOtp.findFirst({
      where: { email: req.user.email, purpose: 'PASSWORD_CHANGE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(404).json({ error: 'otp_not_found', message: 'No verification code found. Please request a new one.' });
    }

    if (new Date() > otpRecord.expiresAt) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(410).json({ error: 'otp_expired', message: 'Verification code has expired.' });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(429).json({ error: 'too_many_attempts', message: 'Too many attempts. Please request a new code.' });
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
      });
    }

    await prisma.userOtp.delete({ where: { id: otpRecord.id } });

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { email: req.user.email },
      data: { password: hashedPassword },
    });

    return res.status(200).json({ status: 'PASSWORD_CHANGED', message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Send OTP code for email updates.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function requestEmailOtp(req, res, next) {
  try {
    const { newEmail } = req.body;
    if (!newEmail || !z.string().email().safeParse(newEmail).success) {
      return res.status(400).json({ error: 'validation_error', message: 'Valid new email is required.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      return res.status(409).json({ error: 'email_taken', message: 'This email is already in use.' });
    }

    await createAndStoreOtp(req.user.email, 'EMAIL_CHANGE', newEmail);
    return res.status(200).json({
      status: 'OTP_SENT',
      message: 'Verification code sent to the new email.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle updating email details after OTP verification.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function changeEmail(req, res, next) {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: 'validation_error', message: 'Verification code is required.' });
    }

    const otpRecord = await prisma.userOtp.findFirst({
      where: { email: req.user.email, purpose: 'EMAIL_CHANGE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(404).json({ error: 'otp_not_found', message: 'No verification code found.' });
    }

    if (new Date() > otpRecord.expiresAt) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(410).json({ error: 'otp_expired', message: 'Verification code has expired.' });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(429).json({ error: 'too_many_attempts', message: 'Too many attempts.' });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) {
      await prisma.userOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });
      return res.status(401).json({ error: 'invalid_otp', message: 'Incorrect code.' });
    }

    await prisma.userOtp.delete({ where: { id: otpRecord.id } });

    const newEmail = otpRecord.newEmail;
    const user = await prisma.user.update({
      where: { email: req.user.email },
      data: { email: newEmail },
    });

    if (user.stripeCustomerId && !isMockMode) {
      try {
        await stripe.customers.update(user.stripeCustomerId, { email: newEmail });
      } catch (e) {
        console.error('Failed to update Stripe customer email:', e.message);
      }
    }

    issueTokenCookie(res, { ...user, email: newEmail });
    return res.status(200).json({ status: 'EMAIL_CHANGED', message: 'Email updated successfully.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle name modifications.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function changeName(req, res, next) {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'validation_error', message: 'First name and last name are required.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { firstName, lastName },
    });

    if (user.stripeCustomerId && !isMockMode) {
      try {
        await stripe.customers.update(user.stripeCustomerId, {
          name: `${firstName} ${lastName}`,
        });
      } catch (e) {
        console.error('Failed to update Stripe customer name:', e.message);
      }
    }
    return res.status(200).json({
      status: 'NAME_CHANGED',
      message: 'Name updated successfully.',
      user: { firstName: user.firstName, lastName: user.lastName },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send OTP code for account deletion.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function requestDeleteOtp(req, res, next) {
  try {
    await createAndStoreOtp(req.user.email, 'ACCOUNT_DELETE');
    return res.status(200).json({
      status: 'OTP_SENT',
      message: 'Verification code sent to your email.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify OTP code and permanently delete user account.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function deleteAccount(req, res, next) {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ error: 'validation_error', message: 'Verification code is required.' });
    }

    const email = req.user.email;
    const userId = req.user.userId;

    const otpRecord = await prisma.userOtp.findFirst({
      where: { email, purpose: 'ACCOUNT_DELETE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(404).json({ error: 'otp_not_found', message: 'No verification code found. Please request a new one.' });
    }

    if (new Date() > otpRecord.expiresAt) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(410).json({ error: 'otp_expired', message: 'Verification code has expired.' });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.userOtp.delete({ where: { id: otpRecord.id } });
      return res.status(429).json({ error: 'too_many_attempts', message: 'Too many attempts.' });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) {
      await prisma.userOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });
      return res.status(401).json({ error: 'invalid_otp', message: 'Incorrect code.' });
    }

    await prisma.userOtp.delete({ where: { id: otpRecord.id } });

    const userRecord = await prisma.user.findUnique({ where: { id: userId } });
    if (userRecord?.stripeCustomerId) {
      try {
        if (isMockMode) {
          console.log(`🔌 [STRIPE] (Mock) Wiped subscriptions for deleted customer ${userRecord.stripeCustomerId}`);
        } else {
          const activeSubs = await listActiveSubscriptions(userRecord.stripeCustomerId);
          for (const sub of activeSubs) {
            await stripe.subscriptions.cancel(sub.id);
          }
        }
      } catch (stripeErr) {
        console.error('Failed to cancel Stripe subscriptions during account deletion:', stripeErr.message);
      }
    }

    await prisma.$transaction([
      prisma.vote.deleteMany({ where: { userId } }),
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.claimedMilestone.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return res.status(200).json({
      status: 'DELETED',
      message: 'Your account has been permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
}

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../lib/prismaPublic.js';
import { issueTokenCookie } from '../../middleware/auth.js';
import { isMockMode } from '../../services/stripe.js';
import { mapDonationBoxes } from '../../lib/mapDonationBoxes.js';

const SALT_ROUNDS = 12;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Handle traditional email and password login.
 *
 * Why? Provides standard authorization checks by comparing user password hashes
 * and issues session tokens upon success.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function login(req, res, next) {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid input.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password.' });
    }

    issueTokenCookie(res, user);
    return res.status(200).json({
      status: 'LOGGED_IN',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle Google OAuth authentication and auto-registration.
 *
 * Why? Allows fast-tracked authentication via Google ID tokens, resolving or merging
 * shadow accounts dynamically.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function googleLogin(req, res, next) {
  try {
    const { credential, email: mockEmail, firstName: mockFirstName, lastName: mockLastName, googleId: mockGoogleId } = req.body;

    let email, firstName, lastName, googleId;

    if (credential) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        googleId = payload.sub;
        email = payload.email;
        firstName = payload.given_name;
        lastName = payload.family_name;
      } catch (verifyErr) {
        console.error('❌ [GOOGLE AUTH ERROR] Failed to verify ID token:', verifyErr.message);
        return res.status(401).json({ error: 'invalid_credential', message: 'Invalid Google ID token.' });
      }
    } else if (process.env.NODE_ENV !== 'production' && mockEmail) {
      email = mockEmail;
      firstName = mockFirstName || 'Mock';
      lastName = mockLastName || 'User';
      googleId = mockGoogleId || `mock-google-id-${Date.now()}`;
      console.log(`🧪 [GOOGLE AUTH] (Mock Fallback) Logged in as mock user: ${email}`);
    } else {
      return res.status(400).json({ error: 'missing_credential', message: 'Google Credential ID token is required.' });
    }

    if (!email) {
      return res.status(400).json({ error: 'missing_email', message: 'Email not provided by Google OAuth.' });
    }

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        user = await prisma.user.update({
          where: { email },
          data: {
            googleId,
            ...(!user.password && {
              password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS),
            }),
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            googleId,
            firstName: firstName || 'Google',
            lastName: lastName || 'User',
            role: 'DONOR',
            password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS),
          },
        });
      }
    }

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
            actorId: user.id, // Self-promotion actor representation since user initiates the OAuth login
            targetUserId: user.id,
            action: 'AUTO_PROMOTE_GOOGLE',
            oldValue: originalRole,
            newValue: allowedAdmin.role,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
          },
        });
        return updated;
      });
    }

    issueTokenCookie(res, user);
    return res.status(200).json({
      status: 'LOGGED_IN',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle logging out users by clearing cookies.
 *
 * Why? Provides immediate session termination by removing JWT tokens from the client browser.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 */
export function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
  res.clearCookie('adminRefreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
  return res.status(200).json({ status: 'LOGGED_OUT', message: 'Logged out successfully.' });
}

/**
 * Retrieve current user profile summary and metrics.
 *
 * Why? Returns consolidated records (claimed milestones, transactions list, current pricing tier)
 * to fuel the user dashboard interface in one single fetch.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getMe(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(200).json({ status: 'NO_SESSION' });
    }

    let decoded;
    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(200).json({ status: 'NO_SESSION' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
        claimedMilestones: { include: { milestone: true } },
        userTiers: { include: { tier: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found.' });
    }

    // Consolidate both total computations into a single database query
    const aggregates = await prisma.transaction.groupBy({
      by: ['isRecurring'],
      where: { userId: decoded.userId, status: 'SUCCEEDED' },
      _sum: { amount: true },
    });

    let lifetimeMonthlyTotal = 0;
    let lifetimeOneTimeTotal = 0;

    for (const group of aggregates) {
      const amountDollars = Math.round((group._sum.amount ?? 0) / 100);
      if (group.isRecurring) {
        lifetimeMonthlyTotal = amountDollars;
      } else {
        lifetimeOneTimeTotal = amountDollars;
      }
    }

    const lifetimeTotal = lifetimeMonthlyTotal + lifetimeOneTimeTotal; // Backwards compatibility

    const [tiers, milestones, donationBoxes] = await Promise.all([
      prisma.tier.findMany({ orderBy: { tierLevel: 'asc' } }),
      prisma.donationMilestone.findMany({ orderBy: { displayOrder: 'asc' } }),
      prisma.donationBox.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' }, include: { tier: true } }),
    ]);

    const monthlyAmountDollars = user.monthlyAmount;
    
    // Retrieve all active tiers sorted by tier level descending, retaining assignment metadata
    const activeTiers = user.userTiers
      .sort((a, b) => b.tier.tierLevel - a.tier.tierLevel)
      .map(ut => ({
        ...ut.tier,
        assignedBy: ut.assignedBy,
        userTierId: ut.id,
      }));
    const currentTier = activeTiers[0] || null;

    const mappedDonationBoxes = mapDonationBoxes(donationBoxes);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        country: user.country,
        stripeCustomerId: user.stripeCustomerId,
        createdAt: user.createdAt,
        role: user.role,
        tiers: activeTiers,
      },
      tier: currentTier,
      monthlyAmount: monthlyAmountDollars,
      scheduledAmount: user.scheduledAmount,
      scheduledAmountEffectiveDate: user.scheduledAmountEffectiveDate,
      lifetimeTotal,
      lifetimeMonthlyTotal,
      lifetimeOneTimeTotal,
      transactions: user.transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        status: t.status,
        createdAt: t.createdAt,
        isRecurring: t.isRecurring,
      })),
      claimedMilestones: user.claimedMilestones.map(cm => ({
        milestoneId: cm.milestoneId,
        claimedAt: cm.claimedAt,
      })),
      milestones,
      tiers,
      donationBoxes: mappedDonationBoxes,
    });
  } catch (error) {
    next(error);
  }
}

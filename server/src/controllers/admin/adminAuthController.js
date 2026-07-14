import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../../lib/prisma.js';
import { issueAdminToken } from '../../middleware/adminAuth.js';
import { ErrorCodes } from '../../lib/errors.js';
import crypto from 'crypto';
import { sendEmail } from '../../services/email.js';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';

const ADMIN_ROLES = ['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'];

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Handle admin email and password login.
 *
 * Why? Asserts the user exists, has role 'ADMIN', compares passwords via bcrypt,
 * and issues a short-lived access token in the response and a long-lived refresh token cookie.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function adminLogin(req, res, next) {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid input.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !ADMIN_ROLES.includes(user.role) || !user.password) {
      return res.status(401).json({
        error: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        error: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    const accessToken = issueAdminToken(user);

    // Issue a 7-day refresh token for admin users
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
      ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('adminRefreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      status: 'LOGGED_IN',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Silent re-auth flow for admin access tokens.
 *
 * Why? Allows admin SPAs to silently fetch fresh short-lived access tokens
 * before they expire by presenting the secure HttpOnly refresh token cookie.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function adminRefresh(req, res, next) {
  try {
    const refreshToken = req.cookies.adminRefreshToken;
    if (!refreshToken) {
      return res.status(200).json({
        status: 'NO_SESSION',
        error: ErrorCodes.NOT_AUTHENTICATED,
        message: 'Refresh token cookie is missing.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, ADMIN_JWT_SECRET);
    } catch (err) {
      return res.status(200).json({
        status: 'NO_SESSION',
        error: ErrorCodes.INVALID_TOKEN,
        message: 'Invalid or expired refresh token.',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !ADMIN_ROLES.includes(user.role) || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(403).json({
        error: ErrorCodes.FORBIDDEN,
        message: 'Access denied.',
      });
    }

    const newAccessToken = issueAdminToken(user);

    return res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke admin session by clearing the refresh token cookie.
 *
 * Why? Provides immediate logout for admin users.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 */
export function adminLogout(req, res) {
  res.clearCookie('adminRefreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
  });
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
  });
  return res.status(200).json({
    status: 'LOGGED_OUT',
    message: 'Logged out successfully.',
  });
}

/**
 * Get active admin session info.
 *
 * Why? Provides UI bootstrap logic for checking admin authentication state.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.adminUser.userId },
    });

    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return res.status(404).json({
        error: ErrorCodes.USER_NOT_FOUND,
        message: 'Admin user not found.',
      });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upgrade a valid donor session to an admin session.
 * 
 * Why? Decouples public login from admin token signing. Ensures admin secrets
 * remain isolated to admin-specific controllers and endpoints.
 * 
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function upgradeSession(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user || !ADMIN_ROLES.includes(user.role) || !user.isActive) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Insufficient privileges or account deactivated.',
      });
    }

    const accessToken = issueAdminToken(user);

    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
      ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('adminRefreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      status: 'UPGRADED',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

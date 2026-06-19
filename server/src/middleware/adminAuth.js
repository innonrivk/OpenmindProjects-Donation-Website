import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

/**
 * Admin JWT secret — sourced exclusively from environment.
 * The startup guard in lib/env.js prevents the server from booting
 * in production if this value is missing.
 */
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';

const ADMIN_ROLES = ['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'];

/**
 * Admin JWT verification middleware.
 *
 * Why? Admin routes use Bearer token authentication (not cookies) to decouple
 * admin SPA sessions from the donor cookie-based auth flow. This middleware
 * extracts the token from the Authorization header, verifies the signature,
 * asserts the ADMIN role, and performs a live database lookup to confirm the
 * account is still active and still holds the ADMIN role.
 *
 * Why the DB lookup? Stateless JWT payloads remain valid until expiry even
 * if an admin account has been deactivated or demoted. The fast DB check
 * (single indexed PK lookup) eliminates this revocation blind spot.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'not_authenticated',
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>.',
    });
  }

  const token = authHeader.slice(7);

  if (!token) {
    return res.status(401).json({
      error: 'not_authenticated',
      message: 'Bearer token is empty.',
    });
  }

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);

    if (!ADMIN_ROLES.includes(decoded.role)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Insufficient privileges. Admin role required.',
      });
    }

    // Live DB verification — ensures deactivated/demoted admins are rejected
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true, tokenVersion: true },
    });

    if (!dbUser || !dbUser.isActive || !ADMIN_ROLES.includes(dbUser.role)) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Admin account has been deactivated or privileges revoked.',
      });
    }

    // Assert that the JWT's tokenVersion matches the current DB version to handle instant session invalidation
    if (dbUser.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({
        error: 'invalid_token',
        message: 'Session invalidated. Please log in again.',
      });
    }

    req.adminUser = {
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'invalid_token',
        message: 'Admin session expired. Please log in again.',
      });
    }

    return res.status(401).json({
      error: 'invalid_token',
      message: 'Invalid admin token.',
    });
  }
}

/**
 * Issue a short-lived admin JWT.
 *
 * Why? Admin tokens expire in 1 hour to limit the blast radius of token theft.
 * Tokens are returned in the response body (not cookies) for SPA consumption.
 * We include the tokenVersion to enable immediate session revocation upon role changes.
 *
 * @param {{ id: string, email: string, role: string, tokenVersion: number }} user - Admin user record.
 * @returns {string} Signed JWT string.
 */
export function issueAdminToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
    ADMIN_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

import jwt from 'jsonwebtoken';

/**
 * Donor JWT secret — sourced from environment with a dev-only fallback.
 *
 * Why a fallback? During local development, .env may not always be configured.
 * The startup guard in lib/env.js prevents production boots with missing secrets,
 * so this fallback only applies in dev/test environments.
 */
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

/**
 * Auth middleware — verifies JWT from HttpOnly cookie.
 * Attaches decoded { userId, email } to req.user on success.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token', message: 'Session expired. Please log in again.' });
  }
}

/**
 * Issue a JWT and set it as an HttpOnly cookie.
 */
export function issueTokenCookie(res, user) {
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  return token;
}

import { ROLE_PERMISSIONS } from '../config/permissions.js';

/**
 * Permission-based route guard. Checks a user's role against the ROLE_PERMISSIONS
 * map rather than a hardcoded array. Adding a new role requires no changes here.
 *
 * Why a Set? O(1) lookup vs. O(n) array.includes(), and prevents duplicate permissions.
 *
 * @param {string} permission - A PERMISSIONS constant string from config/permissions.js.
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    // req.adminUser is populated by requireAdminAuth
    const userRole = req.adminUser?.role;
    const userPermissions = ROLE_PERMISSIONS[userRole];

    if (!userPermissions || !userPermissions.has(permission)) {
      return res.status(403).json({
        error: 'forbidden',
        message: `Insufficient privileges. Missing required permission: ${permission}`,
      });
    }

    next();
  };
};

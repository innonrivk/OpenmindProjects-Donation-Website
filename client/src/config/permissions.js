/**
 * Centralized permission constants for frontend access control.
 * Must match the backend configuration to ensure consistent behavior.
 */
export const PERMISSIONS = Object.freeze({
  CAN_EDIT_CONTENT:       'CAN_EDIT_CONTENT',
  CAN_MANAGE_PROJECTS:    'CAN_MANAGE_PROJECTS',
  CAN_MANAGE_DONATIONS:   'CAN_MANAGE_DONATIONS',
  CAN_VIEW_TRANSACTIONS:  'CAN_VIEW_TRANSACTIONS',
  CAN_MANAGE_RECEIPTS:    'CAN_MANAGE_RECEIPTS',
  CAN_MANAGE_SETTINGS:    'CAN_MANAGE_SETTINGS',
  CAN_MANAGE_USERS:       'CAN_MANAGE_USERS',
});

/**
 * Maps each admin role to its allowed permissions set.
 * Used for dynamic layout hides/guards in the UI.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  CONTENT_ADMIN:    new Set([PERMISSIONS.CAN_EDIT_CONTENT, PERMISSIONS.CAN_MANAGE_PROJECTS]),
  OPERATIONS_ADMIN: new Set([
    PERMISSIONS.CAN_EDIT_CONTENT,
    PERMISSIONS.CAN_MANAGE_PROJECTS,
    PERMISSIONS.CAN_MANAGE_DONATIONS,
    PERMISSIONS.CAN_MANAGE_RECEIPTS,
  ]),
  SUPER_ADMIN:      new Set([
    PERMISSIONS.CAN_EDIT_CONTENT,
    PERMISSIONS.CAN_MANAGE_PROJECTS,
    PERMISSIONS.CAN_MANAGE_DONATIONS,
    PERMISSIONS.CAN_VIEW_TRANSACTIONS,
    PERMISSIONS.CAN_MANAGE_RECEIPTS,
  ]),
  SYSADMIN:         new Set([
    PERMISSIONS.CAN_EDIT_CONTENT,
    PERMISSIONS.CAN_MANAGE_PROJECTS,
    PERMISSIONS.CAN_MANAGE_DONATIONS,
    PERMISSIONS.CAN_VIEW_TRANSACTIONS,
    PERMISSIONS.CAN_MANAGE_RECEIPTS,
    PERMISSIONS.CAN_MANAGE_SETTINGS,
    PERMISSIONS.CAN_MANAGE_USERS,
  ]),
});

/**
 * Helper to determine if a user role is an administrative role.
 *
 * @param {string} role - The role string from user profile.
 * @returns {boolean}
 */
export const isAdmin = (role) => {
  return ['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'].includes(role);
};

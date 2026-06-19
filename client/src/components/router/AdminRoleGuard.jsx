import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { ROLE_PERMISSIONS } from '../../config/permissions';

/**
 * AdminRoleGuard — Restricts access to administrative sub-routes based on permission requirements.
 *
 * Why? Provides declaratively applied frontend page access control. Rejects users with
 * insufficient privileges and redirects them to the default admin dashboard home.
 *
 * @param {object} props
 * @param {string} props.requiredPermission - The permission key to check from config/permissions.js.
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function AdminRoleGuard({ requiredPermission, children }) {
  const { admin, isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return null; // Let the top-level Suspense or loading boundary handle loading states
  }

  // Redirect to login if not authenticated as admin at all
  if (!isAuthenticated || !admin) {
    return <Navigate to="/login" replace />;
  }

  const userPermissions = ROLE_PERMISSIONS[admin.role];

  // If user does not have the required permission, bounce them back to the safe main dashboard landing page
  if (!userPermissions || !userPermissions.has(requiredPermission)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}

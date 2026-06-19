import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FullPageSpinner from '../ui/FullPageSpinner';

/**
 * PrivateRoute — Redirects unauthenticated users to /login.
 * Preserves the original URL for post-login redirect.
 *
 * Why redirect admins? If an authenticated user has an admin role, they should be
 * seamlessly directed to the admin panel dashboard instead of standard donor private pages.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function PrivateRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // If the user has an admin role, route them to the admin dashboard instead of donor private pages
  const adminRoles = ['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'];
  if (user && adminRoles.includes(user.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}

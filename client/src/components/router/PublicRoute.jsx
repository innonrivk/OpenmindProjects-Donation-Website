import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { isAdmin } from '../../config/permissions';
import FullPageSpinner from '../ui/FullPageSpinner';

/**
 * PublicRoute — Redirects already-authenticated users to /dashboard.
 */
export default function PublicRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  const { isAuthenticated: isAdminAuthenticated } = useAdminAuth();

  if (loading) return <FullPageSpinner />;

  if (isAuthenticated) {
    if (isAdmin(user?.role)) {
      if (isAdminAuthenticated) {
        return <Navigate to="/admin/dashboard" replace />;
      }
      return children;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

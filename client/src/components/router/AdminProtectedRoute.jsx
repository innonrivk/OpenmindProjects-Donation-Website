import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useAuth } from '../../context/AuthContext';
import FullPageSpinner from '../ui/FullPageSpinner';

/**
 * AdminProtectedRoute — Redirects unauthenticated administrators to /login,
 * but attempts inline upgrade if the user is authenticated as a donor and has an admin role.
 *
 * Why inline upgrade? Avoids redirect loops where a logged-in admin lands on admin pages
 * but hasn't established their admin Bearer JWT in memory yet.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated: isAdminAuthenticated, loading: adminLoading, upgradeAdminSession } = useAdminAuth();
  const { user: donorUser, loading: donorLoading } = useAuth();
  const location = useLocation();
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeFailed, setUpgradeFailed] = useState(false);

  useEffect(() => {
    const adminRoles = ['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'];
    const hasAdminRole = donorUser && adminRoles.includes(donorUser.role);

    if (
      !adminLoading &&
      !donorLoading &&
      !isAdminAuthenticated &&
      hasAdminRole &&
      !upgrading &&
      !upgradeFailed
    ) {
      setUpgrading(true);
      upgradeAdminSession()
        .then(() => {
          setUpgrading(false);
        })
        .catch((err) => {
          console.error('❌ [ADMIN PROTECTED ROUTE] Failed to upgrade session:', err);
          setUpgrading(false);
          setUpgradeFailed(true);
        });
    }
  }, [adminLoading, donorLoading, isAdminAuthenticated, donorUser, upgrading, upgradeFailed, upgradeAdminSession]);

  if (adminLoading || donorLoading || upgrading) {
    return <FullPageSpinner />;
  }

  if (!isAdminAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../config/permissions';
import './DashboardNav.css';

export default function DashboardNav() {
  const location = useLocation();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    // Redirect happens via PublicRoute/PrivateRoute
    window.location.href = '/';
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="dashboard-nav">
      <div className="dashboard-nav__container container">
        <Link to="/" className="dashboard-nav__brand">
          <img src="/omp-logo.png" alt="OMP Logo" style={{ height: '32px', width: 'auto', marginRight: '8px' }} />
          <span className="gradient-text">OMP</span>
          <span className="dashboard-nav__brand-sub">OpenmindProjects</span>
        </Link>
 
        <div className="dashboard-nav__links">
          <Link
            to={isAdmin(user?.role) ? '/admin/dashboard' : '/dashboard'}
            className={`dashboard-nav__link ${isActive('/dashboard') || isActive('/admin/dashboard') ? 'dashboard-nav__link--active' : ''}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Dashboard
          </Link>
          <Link
            to="/settings"
            className={`dashboard-nav__link ${isActive('/settings') ? 'dashboard-nav__link--active' : ''}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Settings
          </Link>
        </div>

        <div className="dashboard-nav__right">
          <span className="dashboard-nav__user">
            {user?.firstName}
          </span>
          <button
            className="dashboard-nav__logout"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}

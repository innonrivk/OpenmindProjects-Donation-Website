import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import './AdminSidebar.css';

/**
 * AdminSidebar — Sidebar layout navigation panel for the CMS.
 * Handles role displaying, session control (logout), and active route highlighting.
 *
 * @param {object} props
 * @param {function(): void} [props.onToggleMobile] - Optional mobile menu toggle.
 * @returns {JSX.Element}
 */
export default function AdminSidebar() {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Text edit site', path: '/admin/dashboard', icon: '💬' },
    { label: 'Active Projects', path: '/admin/dashboard/projects', icon: '📂' },
    { label: 'Donation Boxes', path: '/admin/dashboard/donation-boxes', icon: '🎁' },
    { label: 'Tiers', path: '/admin/dashboard/tiers', icon: '⭐' },
    { label: 'Milestones', path: '/admin/dashboard/milestones', icon: '🏆' },
    { label: 'Transactions', path: '/admin/dashboard/transactions', icon: '📊' },
    { label: 'Receipt Settings', path: '/admin/dashboard/receipts', icon: '📝' },
    { label: 'Admin Settings', path: '/admin/dashboard/settings', icon: '⚙️' },
  ];

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <Link to="/" className="brand-link">
          <img src="/omp-logo.png" alt="OMP Logo" className="brand-logo" />
          <span className="brand-text">OMP Admin</span>
        </Link>
      </div>

      <div className="admin-sidebar__profile">
        <div className="profile-avatar">{admin?.firstName?.[0] || 'A'}</div>
        <div className="profile-info">
          <span className="profile-name">{admin ? `${admin.firstName} ${admin.lastName}` : 'Administrator'}</span>
          <span className="profile-role">Portal Owner</span>
        </div>
      </div>

      <nav className="admin-sidebar__nav">
        <ul>
          {navItems.map((item) => {
            const isActive =
              item.path === '/admin/dashboard'
                ? location.pathname === '/admin/dashboard' || location.pathname === '/admin/dashboard/'
                : location.pathname.startsWith(item.path);

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="admin-sidebar__footer">
        <button onClick={logout} className="logout-btn">
          <span className="btn-icon">🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}

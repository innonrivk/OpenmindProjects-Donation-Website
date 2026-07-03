import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../config/permissions';
import NotificationBell from './NotificationBell';
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
    { label: 'Text edit site', path: '/admin/dashboard', icon: '💬', permission: PERMISSIONS.CAN_EDIT_CONTENT },
    { label: 'Active Projects', path: '/admin/dashboard/projects', icon: '📂', permission: PERMISSIONS.CAN_MANAGE_PROJECTS },
    { label: 'Donation Boxes', path: '/admin/dashboard/donation-boxes', icon: '🎁', permission: PERMISSIONS.CAN_MANAGE_DONATIONS },
    { label: 'Tiers', path: '/admin/dashboard/tiers', icon: '⭐', permission: PERMISSIONS.CAN_MANAGE_DONATIONS },
    { label: 'Milestones', path: '/admin/dashboard/milestones', icon: '🏆', permission: PERMISSIONS.CAN_MANAGE_DONATIONS },
    { label: 'Transactions', path: '/admin/dashboard/transactions', icon: '📊', permission: PERMISSIONS.CAN_VIEW_TRANSACTIONS },
    { label: 'Receipt Settings', path: '/admin/dashboard/receipts', icon: '📝', permission: PERMISSIONS.CAN_MANAGE_RECEIPTS },
    { label: 'Communications', path: '/admin/dashboard/communications', icon: '📨', permission: PERMISSIONS.CAN_MANAGE_COMMUNICATIONS },
    { label: 'Admin Settings', path: '/admin/dashboard/settings', icon: '⚙️', permission: PERMISSIONS.CAN_MANAGE_SETTINGS },
    { label: 'User Management', path: '/admin/dashboard/users', icon: '👥', permission: PERMISSIONS.CAN_MANAGE_USERS },
  ];

  const userPermissions = admin ? ROLE_PERMISSIONS[admin.role] : null;

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" className="brand-link">
          <img src="/omp-logo.png" alt="OMP Logo" className="brand-logo" />
          <span className="brand-text">OMP Admin</span>
        </Link>
        <NotificationBell />
      </div>

      <div className="admin-sidebar__profile">
        <div className="profile-avatar">{admin?.firstName?.[0] || 'A'}</div>
        <div className="profile-info">
          <span className="profile-name">{admin ? `${admin.firstName} ${admin.lastName}` : 'Administrator'}</span>
          <span className="profile-role" style={{ textTransform: 'capitalize', fontSize: '0.8rem', opacity: 0.7 }}>
            {admin?.role ? admin.role.replace('_', ' ').toLowerCase() : 'Administrator'}
          </span>
        </div>
      </div>

      <nav className="admin-sidebar__nav">
        <ul>
          {navItems
            .filter((item) => userPermissions && userPermissions.has(item.permission))
            .map((item) => {
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

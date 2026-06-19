import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../config/permissions';
import './NotFoundPage.css';

export default function NotFoundPage() {
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch {
    // AuthProvider not available
  }

  const dashboardPath = isAdmin(user?.role) ? '/admin/dashboard' : '/dashboard';

  return (
    <div className="notfound-page">
      <div className="notfound-content animate-fade-in-up">
        <span className="notfound-code">404</span>
        <h1 className="notfound-title">Page Not Found</h1>
        <p className="notfound-text">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="notfound-links">
          <Link to="/" className="notfound-btn notfound-btn--primary">
            ← Back to Home
          </Link>
          <Link to={dashboardPath} className="notfound-btn notfound-btn--secondary">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

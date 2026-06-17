import './Header.css';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  let isAuthenticated = false;
  let user = null;
  try {
    const auth = useAuth();
    isAuthenticated = auth.isAuthenticated;
    user = auth.user;
  } catch {
    // AuthProvider not available — default to not authenticated
  }

  return (
    <header className="header">
      <div className="header__container container">
        <Link to="/" className="header__logo">
          <img src="/omp-logo.png" alt="OpenmindProjects Logo" className="header__logo-img" style={{ height: '40px', width: 'auto' }} />
          <span className="header__logo-text">
            <span className="gradient-text">OMP</span>
            <span className="header__logo-subtitle">OpenmindProjects</span>
          </span>
        </Link>
        <nav className="header__nav">
          <a href="#donate" className="header__nav-link">Donate</a>
          {isAuthenticated ? (
            <Link to={user?.role === 'ADMIN' ? "/admin/dashboard" : "/dashboard"} className="header__nav-link header__nav-link--cta">Dashboard</Link>
          ) : (
            <Link to="/login" className="header__nav-link header__nav-link--cta">Sign In/Sign Up</Link>
          )}
        </nav>
      </div>
    </header>
  );
}


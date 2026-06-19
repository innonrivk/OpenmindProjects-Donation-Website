import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { isAdmin } from '../config/permissions';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleLogin, isAuthenticated: isDonorAuthenticated, user: donorUser } = useAuth();
  const { upgradeAdminSession, isAuthenticated: isAdminAuthenticated } = useAdminAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function autoUpgrade() {
      if (isDonorAuthenticated && isAdmin(donorUser?.role) && !isAdminAuthenticated) {
        setLoading(true);
        try {
          await upgradeAdminSession();
          navigate('/admin/dashboard', { replace: true });
        } catch (err) {
          // Silent failure: let them log in manually
        } finally {
          setLoading(false);
        }
      }
    }
    autoUpgrade();
  }, [isDonorAuthenticated, donorUser, isAdminAuthenticated, upgradeAdminSession, navigate]);

  const from = location.state?.from || '/dashboard';

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login({ email: form.email, password: form.password });
      if (isAdmin(result.user?.role)) {
        await upgradeAdminSession();
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const result = await googleLogin({ credential: credentialResponse.credential });
      if (isAdmin(result.user?.role)) {
        await upgradeAdminSession();
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="auth-page">
      <div className="auth-page__bg-shapes">
        <div className="auth-page__shape auth-page__shape--1" />
        <div className="auth-page__shape auth-page__shape--2" />
        <div className="auth-page__shape auth-page__shape--3" />
      </div>

      <div className="auth-card glass-strong animate-fade-in-up">
        <Link to="/" className="auth-card__back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Link>

        <Link to="/" className="auth-card__brand" style={{ marginTop: '24px' }}>
          <img src="/omp-logo.png" alt="OMP Logo" style={{ height: '32px', width: 'auto', marginRight: '8px' }} />
          <span className="gradient-text">OMP</span>
          <span className="auth-card__brand-sub">OpenmindProjects</span>
        </Link>

        <h1 className="auth-card__title">Welcome Back</h1>
        <p className="auth-card__subtitle">Sign in to your donor dashboard</p>

        {error && (
          <div className="auth-card__error animate-fade-in">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-form__field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="auth-form__submit"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-form__spinner" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-card__divider">
          <span>or</span>
        </div>

        <div className="auth-form__google-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError('Google OAuth verification failed. Please try again.');
            }}
            useOneTap
            theme="filled_blue"
            shape="pill"
            width="100%"
          />
          
        </div>


        <p className="auth-card__footer">
          Don't have an account?{' '}
          <Link to="/signup" className="auth-card__link">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css'; // Reuse shared auth styles

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, googleLogin } = useAuth();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    emailConfirm: '',
    password: '',
    passwordConfirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    if (form.email !== form.emailConfirm) {
      return setError('Email addresses do not match.');
    }
    if (form.password !== form.passwordConfirm) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }

    setLoading(true);
    try {
      const result = await signup({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      });

      if (result.status === 'OTP_REQUIRED') {
        // Shadow account — store email in sessionStorage for OTP page
        sessionStorage.setItem('otp_email', form.email);
        sessionStorage.setItem('otp_password', form.password);
        navigate('/signup/verify-otp');
      } else if (result.status === 'CREATED') {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      await googleLogin({ credential: credentialResponse.credential });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Google sign-up failed.');
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

        <h1 className="auth-card__title">Create Account</h1>
        <p className="auth-card__subtitle">Join the community of monthly donors</p>

        {error && (
          <div className="auth-card__error animate-fade-in">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__row">
            <div className="auth-form__field">
              <label htmlFor="signup-first">First Name</label>
              <input
                id="signup-first"
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder="John"
                required
                autoComplete="given-name"
              />
            </div>
            <div className="auth-form__field">
              <label htmlFor="signup-last">Last Name</label>
              <input
                id="signup-last"
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Doe"
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="auth-form__field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-email-confirm">Confirm Email</label>
            <input
              id="signup-email-confirm"
              type="email"
              name="emailConfirm"
              value={form.emailConfirm}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-form__field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-form__field">
            <label htmlFor="signup-password-confirm">Confirm Password</label>
            <input
              id="signup-password-confirm"
              type="password"
              name="passwordConfirm"
              value={form.passwordConfirm}
              onChange={handleChange}
              placeholder="Repeat your password"
              required
              minLength={8}
              autoComplete="new-password"
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
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-card__divider">
          <span>or</span>
        </div>

        <div className="auth-form__google-container" style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '16px' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError('Google OAuth verification failed. Please try again.');
            }}
            useOneTap
            theme="filled_blue"
            shape="pill"
          />
        </div>

        <p className="auth-card__footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-card__link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { adminApi } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import './AdminSettingsPage.css';

/**
 * AdminSettingsPage — Administrative portal settings management.
 * Separates Email and Password updates, securing both operations with email-based OTPs.
 * Uses Framer Motion for smooth accordion-style animations.
 */
export default function AdminSettingsPage() {
  const { admin, updateAdminState } = useAdminAuth();

  // Accordion state
  const [openSection, setOpenSection] = useState(null);

  // Password Update Form State
  const [pwStep, setPwStep] = useState('idle'); // idle -> otp_sent -> success
  const [pwOtp, setPwOtp] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  // Email Update Form State
  const [emStep, setEmStep] = useState('idle'); // idle -> otp_sent -> success
  const [emNew, setEmNew] = useState('');
  const [emOtp, setEmOtp] = useState('');
  const [emLoading, setEmLoading] = useState(false);
  const [emMsg, setEmMsg] = useState({ type: '', text: '' });

  const toggleSection = (section) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  /**
   * Dispatches password update verification code to admin's current email.
   */
  const handleRequestPwOtp = async () => {
    setPwLoading(true);
    setPwMsg({ type: '', text: '' });
    try {
      await adminApi.post('/auth/settings/password-otp');
      setPwStep('otp_sent');
      setPwMsg({ type: 'success', text: 'Verification code sent to your email.' });
    } catch (err) {
      setPwMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to dispatch verification code.',
      });
    } finally {
      setPwLoading(false);
    }
  };

  /**
   * Submits OTP verification code and hashed new password.
   *
   * @param {import('react').FormEvent} e - Form submission event.
   */
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (pwNew.length < 8) {
      setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }

    setPwLoading(true);
    setPwMsg({ type: '', text: '' });
    try {
      const { data } = await adminApi.post('/auth/settings/change-password', {
        otp: pwOtp,
        newPassword: pwNew,
      });
      setPwStep('success');
      setPwMsg({ type: 'success', text: data.message });
      setPwOtp('');
      setPwNew('');
      setPwConfirm('');
    } catch (err) {
      setPwMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to change password.',
      });
    } finally {
      setPwLoading(false);
    }
  };

  /**
   * Dispatches email update verification code to the prospective new email address.
   *
   * @param {import('react').FormEvent} e - Form submission event.
   */
  const handleRequestEmOtp = async (e) => {
    e.preventDefault();
    if (!emNew) {
      setEmMsg({ type: 'error', text: 'Please input a valid email address.' });
      return;
    }
    if (emNew === admin?.email) {
      setEmMsg({ type: 'error', text: 'New email cannot be the same as current email.' });
      return;
    }

    setEmLoading(true);
    setEmMsg({ type: '', text: '' });
    try {
      await adminApi.post('/auth/settings/email-otp', { newEmail: emNew });
      setEmStep('otp_sent');
      setEmMsg({ type: 'success', text: `Verification code sent to ${emNew}.` });
    } catch (err) {
      setEmMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to dispatch verification code.',
      });
    } finally {
      setEmLoading(false);
    }
  };

  /**
   * Submits OTP verification code and confirms email update.
   * Updates state globally via context upon success.
   *
   * @param {import('react').FormEvent} e - Form submission event.
   */
  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setEmLoading(true);
    setEmMsg({ type: '', text: '' });
    try {
      const { data } = await adminApi.post('/auth/settings/change-email', {
        otp: emOtp,
      });
      setEmStep('success');
      setEmMsg({ type: 'success', text: data.message });
      setEmOtp('');
      setEmNew('');
      // Rotate active admin JWT credentials in React state
      updateAdminState(data.user, data.accessToken);
    } catch (err) {
      setEmMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update email.',
      });
    } finally {
      setEmLoading(false);
    }
  };

  return (
    <div className="admin-settings-page">
      <div className="page-header">
        <h1 className="page-title">Portal Settings</h1>
        <p className="page-subtitle">Configure administrator settings and security credentials.</p>
      </div>

      <div className="settings-accordion-list">
        {/* Accordion 1: Change Password */}
        <div className={`accordion-card ${openSection === 'password' ? 'accordion-card--open' : ''}`}>
          <button
            type="button"
            className="accordion-header"
            onClick={() => toggleSection('password')}
          >
            <span className="accordion-header-title">🔐 Change Password</span>
            <span className="accordion-chevron">▼</span>
          </button>

          <AnimatePresence initial={false}>
            {openSection === 'password' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="accordion-body"
              >
                {pwStep === 'idle' && (
                  <div className="step-container">
                    <p className="settings-field-hint">
                      We will dispatch a 6-digit verification code to <strong>{admin?.email}</strong> to verify this change.
                    </p>
                    {pwMsg.text && <p className={`settings-msg settings-msg--${pwMsg.type}`}>{pwMsg.text}</p>}
                    <button
                      type="button"
                      className="settings-action-btn"
                      onClick={handleRequestPwOtp}
                      disabled={pwLoading}
                    >
                      {pwLoading ? <span className="btn-spinner" /> : 'Request Code'}
                    </button>
                  </div>
                )}

                {pwStep === 'otp_sent' && (
                  <form onSubmit={handleChangePassword} className="settings-form">
                    {/* Hidden username field to satisfy browser password managers */}
                    <input type="text" autoComplete="username" value={admin?.email || ''} style={{ display: 'none' }} readOnly />
                    <div className="settings-field">
                      <label htmlFor="pw-otp">Verification Code</label>
                      <input
                        id="pw-otp"
                        type="text"
                        maxLength={6}
                        value={pwOtp}
                        onChange={(e) => setPwOtp(e.target.value)}
                        placeholder="6-digit code"
                        autoComplete="one-time-code"
                        required
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="pw-new">New Password</label>
                      <input
                        id="pw-new"
                        type="password"
                        minLength={8}
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        placeholder="Min 8 characters"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="pw-confirm">Confirm New Password</label>
                      <input
                        id="pw-confirm"
                        type="password"
                        minLength={8}
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        placeholder="Repeat new password"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    {pwMsg.text && <p className={`settings-msg settings-msg--${pwMsg.type}`}>{pwMsg.text}</p>}
                    <div className="form-actions">
                      <button
                        type="button"
                        className="settings-cancel-btn"
                        onClick={() => setPwStep('idle')}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="settings-action-btn"
                        disabled={pwLoading}
                      >
                        {pwLoading ? <span className="btn-spinner" /> : 'Confirm Password Update'}
                      </button>
                    </div>
                  </form>
                )}

                {pwStep === 'success' && (
                  <div className="success-container">
                    <p className="settings-success-msg">✓ Password updated successfully.</p>
                    <button
                      type="button"
                      className="settings-cancel-btn"
                      onClick={() => {
                        setPwStep('idle');
                        setPwMsg({ type: '', text: '' });
                      }}
                    >
                      Reset Form
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accordion 2: Change Email */}
        <div className={`accordion-card ${openSection === 'email' ? 'accordion-card--open' : ''}`}>
          <button
            type="button"
            className="accordion-header"
            onClick={() => toggleSection('email')}
          >
            <span className="accordion-header-title">📧 Change Email Address</span>
            <span className="accordion-chevron">▼</span>
          </button>

          <AnimatePresence initial={false}>
            {openSection === 'email' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="accordion-body"
              >
                {emStep === 'idle' && (
                  <form onSubmit={handleRequestEmOtp} className="settings-form">
                    <p className="settings-field-hint">
                      Current Account Email: <strong>{admin?.email}</strong>
                    </p>
                    <div className="settings-field">
                      <label htmlFor="em-new">New Email Address</label>
                      <input
                        id="em-new"
                        type="email"
                        value={emNew}
                        onChange={(e) => setEmNew(e.target.value)}
                        placeholder="new-admin@openmindprojects.org"
                        required
                      />
                    </div>
                    {emMsg.text && <p className={`settings-msg settings-msg--${emMsg.type}`}>{emMsg.text}</p>}
                    <button
                      type="submit"
                      className="settings-action-btn"
                      disabled={emLoading}
                    >
                      {emLoading ? <span className="btn-spinner" /> : 'Request Code'}
                    </button>
                  </form>
                )}

                {emStep === 'otp_sent' && (
                  <form onSubmit={handleChangeEmail} className="settings-form">
                    <p className="settings-field-hint">
                      Enter the 6-digit code sent to: <strong>{emNew}</strong>
                    </p>
                    <div className="settings-field">
                      <label htmlFor="em-otp">Verification Code</label>
                      <input
                        id="em-otp"
                        type="text"
                        maxLength={6}
                        value={emOtp}
                        onChange={(e) => setEmOtp(e.target.value)}
                        placeholder="6-digit code"
                        required
                      />
                    </div>
                    {emMsg.text && <p className={`settings-msg settings-msg--${emMsg.type}`}>{emMsg.text}</p>}
                    <div className="form-actions">
                      <button
                        type="button"
                        className="settings-cancel-btn"
                        onClick={() => setEmStep('idle')}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="settings-action-btn"
                        disabled={emLoading}
                      >
                        {emLoading ? <span className="btn-spinner" /> : 'Confirm Email Update'}
                      </button>
                    </div>
                  </form>
                )}

                {emStep === 'success' && (
                  <div className="success-container">
                    <p className="settings-success-msg">✓ Email address updated successfully.</p>
                    <button
                      type="button"
                      className="settings-cancel-btn"
                      onClick={() => {
                        setEmStep('idle');
                        setEmMsg({ type: '', text: '' });
                      }}
                    >
                      Reset Form
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

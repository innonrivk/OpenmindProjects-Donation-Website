import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardNav from '../components/layout/DashboardNav';
import { isAdmin } from '../config/permissions';
import * as api from '../services/api';
import './SettingsPage.css';

export default function SettingsPage() {
  const { user, refreshUser, profileData, logout } = useAuth();

  // ── Name ──
  const [nameForm, setNameForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  });
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState({ type: '', text: '' });

  // ── Password ──
  const [pwStep, setPwStep] = useState('idle'); // idle → otp_sent → done
  const [pwOtp, setPwOtp] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  // ── Email ──
  const [emStep, setEmStep] = useState('idle');
  const [emNew, setEmNew] = useState('');
  const [emOtp, setEmOtp] = useState('');
  const [emLoading, setEmLoading] = useState(false);
  const [emMsg, setEmMsg] = useState({ type: '', text: '' });

  // ── Danger Zone (Cancel/Delete) ──
  const [deleteStep, setDeleteStep] = useState('idle'); // idle → otp_sent
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState({ type: '', text: '' });
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState({ type: '', text: '' });

  // ── Accordion ──
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (section) => {
    setOpenSection(prev => prev === section ? null : section);
  };

  // ── Name Handlers ──
  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (!nameForm.firstName || !nameForm.lastName) {
      setNameMsg({ type: 'error', text: 'Both fields are required.' });
      return;
    }
    setNameLoading(true);
    setNameMsg({ type: '', text: '' });
    try {
      const result = await api.changeName(nameForm);
      setNameMsg({ type: 'success', text: result.message });
      await refreshUser();
    } catch (err) {
      setNameMsg({ type: 'error', text: err.message });
    } finally {
      setNameLoading(false);
    }
  };

  // ── Password Handlers ──
  const handleRequestPwOtp = async () => {
    setPwLoading(true);
    setPwMsg({ type: '', text: '' });
    try {
      await api.requestPasswordOtp();
      setPwStep('otp_sent');
      setPwMsg({ type: 'success', text: 'Verification code sent to your email.' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    } finally {
      setPwLoading(false);
    }
  };

  const handleChangePw = async (e) => {
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
      const result = await api.changePassword({ otp: pwOtp, newPassword: pwNew });
      setPwMsg({ type: 'success', text: result.message });
      setPwStep('done');
      setPwOtp('');
      setPwNew('');
      setPwConfirm('');
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    } finally {
      setPwLoading(false);
    }
  };

  // ── Email Handlers ──
  const handleRequestEmOtp = async (e) => {
    e.preventDefault();
    if (!emNew) {
      setEmMsg({ type: 'error', text: 'Enter a new email address.' });
      return;
    }
    setEmLoading(true);
    setEmMsg({ type: '', text: '' });
    try {
      await api.requestEmailOtp({ newEmail: emNew });
      setEmStep('otp_sent');
      setEmMsg({ type: 'success', text: 'Verification code sent to the new email.' });
    } catch (err) {
      setEmMsg({ type: 'error', text: err.message });
    } finally {
      setEmLoading(false);
    }
  };

  const handleChangeEm = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setEmLoading(true);
    setEmMsg({ type: '', text: '' });
    try {
      const result = await api.changeEmail({ otp: emOtp });
      setEmMsg({ type: 'success', text: result.message });
      setEmStep('done');
      await refreshUser();
    } catch (err) {
      setEmMsg({ type: 'error', text: err.message });
    } finally {
      setEmLoading(false);
    }
  };

  const handleCancelSubscriptionInSettings = async () => {
    if (!window.confirm('Are you sure you want to cancel your monthly subscription?')) return;
    setCancelLoading(true);
    setCancelMsg({ type: '', text: '' });
    try {
      const result = await api.cancelSubscription();
      setCancelMsg({ type: 'success', text: result.message });
      await refreshUser();
    } catch (err) {
      setCancelMsg({ type: 'error', text: err.message });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleRequestDeleteOtp = async () => {
    if (!window.confirm('WARNING: Are you absolutely sure you want to delete your account? This will wipe your donations, milestones, and settings, and cannot be undone.')) return;
    setDeleteLoading(true);
    setDeleteMsg({ type: '', text: '' });
    try {
      await api.requestDeleteOtp();
      setDeleteStep('otp_sent');
      setDeleteMsg({ type: 'success', text: 'Verification code sent to your email.' });
    } catch (err) {
      setDeleteMsg({ type: 'error', text: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deleteOtp) {
      setDeleteMsg({ type: 'error', text: 'Verification code is required.' });
      return;
    }
    setDeleteLoading(true);
    setDeleteMsg({ type: '', text: '' });
    try {
      const result = await api.deleteAccount({ otp: deleteOtp });
      setDeleteMsg({ type: 'success', text: result.message });
      // Clear data and logout
      setTimeout(async () => {
        await logout();
      }, 2000);
    } catch (err) {
      setDeleteMsg({ type: 'error', text: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };


  return (
    <div className="settings-page">
      <DashboardNav />

      <main className="settings-main container">
        <h1 className="settings-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </h1>

        {/* ── Change Name ── */}
        <div className="settings-accordion">
          <button
            className={`settings-accordion__header ${openSection === 'name' ? 'settings-accordion__header--open' : ''}`}
            onClick={() => toggleSection('name')}
          >
            <span>Change Name</span>
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" className="settings-accordion__icon">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {openSection === 'name' && (
            <div className="settings-accordion__body animate-fade-in">
              <form onSubmit={handleNameSubmit} className="settings-form">
                <div className="auth-form__row">
                  <div className="auth-form__field">
                    <label htmlFor="settings-first">First Name</label>
                    <input
                      id="settings-first"
                      type="text"
                      value={nameForm.firstName}
                      onChange={e => setNameForm(p => ({ ...p, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="auth-form__field">
                    <label htmlFor="settings-last">Last Name</label>
                    <input
                      id="settings-last"
                      type="text"
                      value={nameForm.lastName}
                      onChange={e => setNameForm(p => ({ ...p, lastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                {nameMsg.text && <p className={`dash-msg dash-msg--${nameMsg.type}`}>{nameMsg.text}</p>}
                <button type="submit" className="settings-btn" disabled={nameLoading}>
                  {nameLoading ? <span className="auth-form__spinner" /> : 'Update Name'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── Change Password ── */}
        <div className="settings-accordion">
          <button
            className={`settings-accordion__header ${openSection === 'password' ? 'settings-accordion__header--open' : ''}`}
            onClick={() => toggleSection('password')}
          >
            <span>Change Password</span>
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" className="settings-accordion__icon">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {openSection === 'password' && (
            <div className="settings-accordion__body animate-fade-in">
              {pwStep === 'idle' && (
                <div className="settings-form">
                  <p className="settings-info">We'll send a verification code to your email to confirm the change.</p>
                  {pwMsg.text && <p className={`dash-msg dash-msg--${pwMsg.type}`}>{pwMsg.text}</p>}
                  <button className="settings-btn" onClick={handleRequestPwOtp} disabled={pwLoading}>
                    {pwLoading ? <span className="auth-form__spinner" /> : 'Send Verification Code'}
                  </button>
                </div>
              )}

              {pwStep === 'otp_sent' && (
                <form onSubmit={handleChangePw} className="settings-form">
                  <div className="auth-form__field">
                    <label htmlFor="pw-otp">Verification Code</label>
                    <input id="pw-otp" type="text" value={pwOtp} onChange={e => setPwOtp(e.target.value)} maxLength={6} placeholder="6-digit code" required />
                  </div>
                  <div className="auth-form__field">
                    <label htmlFor="pw-new">New Password</label>
                    <input id="pw-new" type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} minLength={8} placeholder="At least 8 characters" autoComplete="new-password" required />
                  </div>
                  <div className="auth-form__field">
                    <label htmlFor="pw-confirm">Confirm New Password</label>
                    <input id="pw-confirm" type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} minLength={8} placeholder="Repeat password" autoComplete="new-password" required />
                  </div>
                  {pwMsg.text && <p className={`dash-msg dash-msg--${pwMsg.type}`}>{pwMsg.text}</p>}
                  <button type="submit" className="settings-btn" disabled={pwLoading}>
                    {pwLoading ? <span className="auth-form__spinner" /> : 'Update Password'}
                  </button>
                </form>
              )}

              {pwStep === 'done' && (
                <div className="settings-form">
                  <p className="settings-success">✓ Password updated successfully.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Change Email ── */}
        <div className="settings-accordion">
          <button
            className={`settings-accordion__header ${openSection === 'email' ? 'settings-accordion__header--open' : ''}`}
            onClick={() => toggleSection('email')}
          >
            <span>Change Email</span>
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" className="settings-accordion__icon">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {openSection === 'email' && (
            <div className="settings-accordion__body animate-fade-in">
              {emStep === 'idle' && (
                <form onSubmit={handleRequestEmOtp} className="settings-form">
                  <p className="settings-info">Current email: <strong>{user?.email}</strong></p>
                  <div className="auth-form__field">
                    <label htmlFor="em-new">New Email Address</label>
                    <input id="em-new" type="email" value={emNew} onChange={e => setEmNew(e.target.value)} placeholder="new@email.com" required />
                  </div>
                  {emMsg.text && <p className={`dash-msg dash-msg--${emMsg.type}`}>{emMsg.text}</p>}
                  <button type="submit" className="settings-btn" disabled={emLoading}>
                    {emLoading ? <span className="auth-form__spinner" /> : 'Send Verification Code'}
                  </button>
                </form>
              )}

              {emStep === 'otp_sent' && (
                <form onSubmit={handleChangeEm} className="settings-form">
                  <p className="settings-info">Enter the code sent to <strong>{emNew}</strong></p>
                  <div className="auth-form__field">
                    <label htmlFor="em-otp">Verification Code</label>
                    <input id="em-otp" type="text" value={emOtp} onChange={e => setEmOtp(e.target.value)} maxLength={6} placeholder="6-digit code" required />
                  </div>
                  {emMsg.text && <p className={`dash-msg dash-msg--${emMsg.type}`}>{emMsg.text}</p>}
                  <button type="submit" className="settings-btn" disabled={emLoading}>
                    {emLoading ? <span className="auth-form__spinner" /> : 'Update Email'}
                  </button>
                </form>
              )}

              {emStep === 'done' && (
                <div className="settings-form">
                  <p className="settings-success">✓ Email updated successfully.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Danger Zone ── */}
        <div className="settings-accordion settings-accordion--danger settings-accordion--danger-pulse">
          <button
            className={`settings-accordion__header ${openSection === 'danger' ? 'settings-accordion__header--open' : ''}`}
            onClick={() => toggleSection('danger')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Danger Zone
            </span>
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" className="settings-accordion__icon">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {openSection === 'danger' && (
            <div className="settings-accordion__body animate-fade-in">
              {/* Cancel Subscription */}
              <div className="settings-form" style={{ borderBottom: '1px solid rgba(234, 67, 53, 0.1)', paddingBottom: '20px' }}>
                <h4 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '15px' }}>Cancel Monthly Subscription</h4>
                <p className="settings-info">
                  This will stop your recurring monthly contribution at the end of the current billing cycle. You will keep your tier status until the period ends.
                </p>
                {cancelMsg.text && <p className={`dash-msg dash-msg--${cancelMsg.type}`}>{cancelMsg.text}</p>}
                <button
                  type="button"
                  className="settings-btn settings-btn--danger"
                  onClick={handleCancelSubscriptionInSettings}
                  disabled={cancelLoading || (profileData?.monthlyAmount || 0) === 0}
                >
                  {cancelLoading ? <span className="auth-form__spinner" /> : (profileData?.monthlyAmount || 0) > 0 ? 'Cancel Subscription' : 'No Active Subscription'}
                </button>
              </div>

              {/* Delete User */}
              <div className="settings-form" style={{ paddingTop: '20px' }}>
                <h4 style={{ margin: 0, color: '#ea4335', fontSize: '15px' }}>Permanently Delete Account</h4>
                {isAdmin(user?.role) ? (
                  <p className="settings-info" style={{ marginTop: '10px' }}>
                    Account management options are not available for this account type.
                  </p>
                ) : (
                  <>
                    <p className="settings-info">
                      Once deleted, your account, billing profiles, votes, and tier milestones cannot be recovered. This action requires email OTP confirmation.
                    </p>

                    {deleteStep === 'idle' && (
                      <>
                        {deleteMsg.text && <p className={`dash-msg dash-msg--${deleteMsg.type}`}>{deleteMsg.text}</p>}
                        <button
                          type="button"
                          className="settings-btn settings-btn--danger"
                          onClick={handleRequestDeleteOtp}
                          disabled={deleteLoading}
                        >
                          {deleteLoading ? <span className="auth-form__spinner" /> : 'Request Account Deletion OTP'}
                        </button>
                      </>
                    )}

                    {deleteStep === 'otp_sent' && (
                      <form onSubmit={handleDeleteAccount} className="settings-form" style={{ paddingTop: 0 }}>
                        <div className="auth-form__field">
                          <label htmlFor="del-otp">Verification Code</label>
                          <input
                            id="del-otp"
                            type="text"
                            value={deleteOtp}
                            onChange={e => setDeleteOtp(e.target.value)}
                            maxLength={6}
                            placeholder="6-digit code"
                            required
                            style={{ borderColor: 'rgba(234, 67, 53, 0.3)' }}
                          />
                        </div>
                        {deleteMsg.text && <p className={`dash-msg dash-msg--${deleteMsg.type}`}>{deleteMsg.text}</p>}
                        <button type="submit" className="settings-btn" style={{ background: '#ea4335' }} disabled={deleteLoading}>
                          {deleteLoading ? <span className="auth-form__spinner" /> : 'Permanently Delete My Account'}
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>

  );
}

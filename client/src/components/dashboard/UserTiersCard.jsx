import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatContentInline } from '../../utils/formatContent';
import * as api from '../../services/api';

/**
 * UserTiersCard displays all active tiers assigned to the current user.
 * Allows users to self-cancel manually assigned (standalone) tiers.
 *
 * @param {Object} props
 * @param {Array} props.tiers - Array of tier objects with metadata (assignedBy, userTierId, name, minAmount, maxAmount)
 * @param {Function} props.onTierCancelled - Callback to refresh user data after successful cancellation
 */
export default function UserTiersCard({ tiers = [], onTierCancelled }) {
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmCancelTier, setConfirmCancelTier] = useState(null);
  const [error, setError] = useState('');

  // Tier color branding definitions
  const tierColors = {
    Regular: { bg: 'rgba(66, 133, 244, 0.1)', border: '#4285f4', text: '#4285f4' },
    Shareholder: { bg: 'rgba(52, 168, 83, 0.1)', border: '#34a853', text: '#34a853' },
    Patron: { bg: 'rgba(251, 188, 4, 0.1)', border: '#fbbc04', text: '#b08200' },
  };

  const handleCancelTier = async (tierId) => {
    setCancellingId(tierId);
    setError('');
    try {
      await api.cancelUserTier(tierId);
      setConfirmCancelTier(null);
      if (onTierCancelled) {
        onTierCancelled();
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel the tier.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <section className="dash-card dash-card--tiers animate-fade-in-up animate-delay-1" style={{ position: 'relative' }}>
      <h3 className="dash-card__title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
        My Active Tiers
      </h3>

      {error && (
        <div style={{ color: '#ea4335', background: 'rgba(234,67,53,0.1)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '12px' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        <AnimatePresence>
          {tiers.map((t) => {
            const isAuto = t.assignedBy === 'AUTO_SUM';
            const tc = tierColors[t.name] || { bg: 'rgba(156, 163, 175, 0.1)', border: '#9ca3af', text: '#4b5563' };

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-card, #ffffff)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '700', color: 'var(--color-text-primary, #1f2937)' }}>
                      {formatContentInline(t.name)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: isAuto ? 'rgba(52, 168, 83, 0.1)' : 'rgba(66, 133, 244, 0.1)',
                        color: isAuto ? '#34a853' : '#4285f4',
                        border: `1px solid ${isAuto ? 'rgba(52, 168, 83, 0.2)' : 'rgba(66, 133, 244, 0.2)'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title={isAuto ? 'Automatically managed based on your subscription amount' : 'Manually assigned add-on'}
                    >
                      {isAuto && (
                        <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10" style={{ flexShrink: 0 }}>
                          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                        </svg>
                      )}
                      {isAuto ? 'Donor Type' : 'Add-on'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #6b7280)', marginTop: '4px' }}>
                    {isAuto
                      ? `Based on subscription amount (min $${t.minAmount}/mo)`
                      : `Standalone benefits (level ${t.tierLevel})`}
                  </p>
                </div>

                {!isAuto && (
                  <button
                    type="button"
                    onClick={() => setConfirmCancelTier(t)}
                    style={{
                      background: 'rgba(234, 67, 53, 0.08)',
                      color: '#ea4335',
                      border: '1px solid rgba(234, 67, 53, 0.2)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(234, 67, 53, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(234, 67, 53, 0.08)';
                    }}
                  >
                    Cancel Add-on
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {tiers.some((t) => t.assignedBy === 'MANUAL') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '6px',
            background: 'var(--color-bg-light, rgba(0, 0, 0, 0.02))',
            border: '1px dashed var(--color-border)',
            fontSize: '0.8rem',
            color: 'var(--color-text-muted, #6b7280)',
            lineHeight: '1.4',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16" style={{ flexShrink: 0, color: '#4285f4' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span>
            Add-on donations do not count towards Donor Type tiers (Regular, Shareholder, Patron...).
          </span>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmCancelTier && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              color: '#1f2937',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Cancel Add-on Assignment?</h4>
            <p style={{ fontSize: '0.9rem', color: '#4b5563', marginTop: '12px', lineHeight: '1.5' }}>
              Are you sure you want to remove the <strong>{confirmCancelTier.name}</strong> add-on from your account? This action will take effect immediately.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setConfirmCancelTier(null)}
                disabled={cancellingId !== null}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: '#374151',
                }}
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => handleCancelTier(confirmCancelTier.id)}
                disabled={cancellingId !== null}
                style={{
                  background: '#ea4335',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {cancellingId ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </section>
  );
}

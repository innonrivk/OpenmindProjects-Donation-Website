import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi } from '../../lib/api.js';

const ADMIN_ROLES = ['DONOR', 'CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'];

export default function BatchComposer({ templateId, onClose }) {
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedTiers, setSelectedTiers] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [sentCount, setSentCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch tiers
  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async () => {
      const { data } = await adminApi.get('/tiers');
      return data;
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (payload) => {
      return adminApi.post('/communications/dispatch', payload);
    },
    onSuccess: (res) => {
      const logId = res.data.logId;
      setIsSending(true);
      setSuccessMsg(`Initiating manual dispatch for ${res.data.recipientCount} recipient(s)...`);

      const interval = setInterval(async () => {
        try {
          const statusRes = await adminApi.get(`/communications/dispatch-logs/${logId}`);
          const log = statusRes.data;

          if (log.status !== 'QUEUED') {
            clearInterval(interval);
            setIsSending(false);
            setDispatchStatus(log.status);
            setSentCount(log.recipientCount);
            setErrorMessage(log.errorMessage);
            setSuccessMsg('');
          } else {
            setSuccessMsg(`Sending emails: progress enqueued to ${log.recipientCount} user(s)...`);
          }
        } catch (err) {
          clearInterval(interval);
          setIsSending(false);
          setErrorMsg('Lost connection while polling dispatch status.');
        }
      }, 1500);
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to dispatch manual batch.');
    },
  });

  const handleRoleToggle = (role) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleTierToggle = (tierId) => {
    setSelectedTiers((prev) =>
      prev.includes(tierId) ? prev.filter((t) => t !== tierId) : [...prev, tierId]
    );
  };

  const handleSend = () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (selectedRoles.length === 0 && selectedTiers.length === 0) {
      setErrorMsg('Please select at least one target role or target tier.');
      return;
    }

    dispatchMutation.mutate({
      templateId,
      targetRoles: selectedRoles,
      targetTiers: selectedTiers,
    });
  };

  if (isSending) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
        }}
      >
        <div className="glass" style={{ width: '400px', background: 'var(--color-bg-card)', padding: '32px', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}} />
          <h4 style={{ marginBottom: '16px' }}>✉️ Sending Batch Emails</h4>
          <div className="spinner" style={{ border: '4px solid var(--color-border)', borderTop: '4px solid var(--brand-blue)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
          <p style={{ fontSize: '13px', margin: 0 }}>{successMsg}</p>
        </div>
      </div>
    );
  }

  if (dispatchStatus) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
        }}
      >
        <div className="glass" style={{ width: '400px', background: 'var(--color-bg-card)', padding: '32px', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>
            {dispatchStatus === 'SENT' ? '🎉' : '⚠️'}
          </span>
          <h4 style={{ marginBottom: '12px' }}>
            {dispatchStatus === 'SENT' ? 'Emails Sent Successfully' : 'Emails Dispatched with Issues'}
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
            {dispatchStatus === 'SENT'
              ? `All ${sentCount} emails have been successfully sent to matching recipients!`
              : `Dispatch finished with status ${dispatchStatus}. Sent to ${sentCount} user(s). ${errorMessage || ''}`
            }
          </p>
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            style={{ width: '100%' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
      }}
    >
      <div
        className="glass"
        style={{
          width: '500px',
          maxHeight: '90vh',
          background: 'var(--color-bg-card)',
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0 }}>Manual Batch Dispatch</h4>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
          >
            ×
          </button>
        </div>

        {errorMsg && <div className="auth-card__error" style={{ marginBottom: '16px' }}>{errorMsg}</div>}
        {successMsg && <div style={{ color: 'var(--brand-green)', marginBottom: '16px', fontWeight: 600 }}>{successMsg}</div>}

        {isLoading ? (
          <div>Loading batch composer configuration...</div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Filter Recipients by User Role
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {ADMIN_ROLES.map((role) => (
                  <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => handleRoleToggle(role)}
                    />
                    {role.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Filter Recipients by Active Tier
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {tiers.map((t) => (
                  <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedTiers.includes(String(t.id))}
                      onChange={() => handleTierToggle(String(t.id))}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                className="cms-btn cms-btn--secondary"
                disabled={dispatchMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="cms-btn cms-btn--primary"
                disabled={dispatchMutation.isPending}
              >
                {dispatchMutation.isPending ? 'Sending...' : '🚀 Send Batch Now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

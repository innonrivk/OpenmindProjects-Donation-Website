import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { adminApi } from '../../lib/api.js';

const EVENT_NAMES = [
  { value: 'DONATION_RECEIVED', label: 'Donation Received' },
  { value: 'TIER_REACHED', label: 'User Tier Reached' },
  { value: 'MILESTONE_CLAIMED', label: 'Donation Milestone Claimed' },
];

const ADMIN_ROLES = ['CONTENT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN', 'SYSADMIN'];

export default function AutomationConfigurator() {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch triggers
  const { data: triggers = [], isLoading: loadingTriggers } = useQuery({
    queryKey: ['admin-triggers'],
    queryFn: async () => {
      const { data } = await adminApi.get('/communications/triggers');
      return data;
    },
  });

  // Fetch non-archived templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const { data } = await adminApi.get('/communications/templates');
      return data;
    },
  });

  // Fetch tiers
  const { data: tiers = [], isLoading: loadingTiers } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async () => {
      const { data } = await adminApi.get('/tiers');
      return data;
    },
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      eventName: 'DONATION_RECEIVED',
      tierId: 'ALL',
      emailTemplateId: '',
      adminRoles: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        eventName: data.eventName,
        tierId: data.tierId === 'ALL' ? null : parseInt(data.tierId, 10),
        emailTemplateId: parseInt(data.emailTemplateId, 10),
        adminRoles: data.adminRoles || [],
      };
      return adminApi.post('/communications/triggers', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-triggers'] });
      setSuccessMsg('Automation rule created successfully!');
      reset();
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create automation rule.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return adminApi.delete(`/communications/triggers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-triggers'] });
      setSuccessMsg('Automation rule deleted successfully!');
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to delete automation rule.');
    },
  });

  const onSubmit = (data) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!data.emailTemplateId) {
      setErrorMsg('Please select an email template for this automation rule.');
      return;
    }
    createMutation.mutate(data);
  };

  const getTierName = (tierId) => {
    if (!tierId) return 'Any Tier';
    const tier = tiers.find((t) => t.id === tierId);
    return tier ? tier.name : `Tier #${tierId}`;
  };

  const getEventLabel = (eventName) => {
    const found = EVENT_NAMES.find((e) => e.value === eventName);
    return found ? found.label : eventName;
  };

  const isLoading = loadingTriggers || loadingTemplates || loadingTiers;

  if (isLoading) {
    return <div className="admin-loading">Loading automation configurations...</div>;
  }

  return (
    <div className="templates-grid">
      <div>
        <h3 style={{ marginBottom: '16px' }}>Active Automation Rules</h3>
        {errorMsg && <div className="auth-card__error" style={{ marginBottom: '16px' }}>{errorMsg}</div>}
        {successMsg && <div style={{ color: 'var(--brand-green)', marginBottom: '16px', fontWeight: 600 }}>{successMsg}</div>}

        {triggers.length === 0 ? (
          <p>No automation rules defined yet. Create one on the right.</p>
        ) : (
          triggers.map((rule) => (
            <div key={rule.id} className="trigger-rule-row">
              <div className="trigger-rule-row__info">
                <span style={{ fontWeight: 600, fontSize: '14px' }}>
                  ⚡ {getEventLabel(rule.eventName)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Tier Scope: <strong>{getTierName(rule.tierId)}</strong> · Action: Email <strong>{rule.template?.name || 'Unknown Template'}</strong>
                </span>
                {rule.adminAssignments?.length > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--brand-blue)', marginTop: '2px', display: 'block' }}>
                    🔔 Notifies roles: {rule.adminAssignments.map((a) => a.role.replace('_', ' ')).join(', ')}
                  </span>
                )}
              </div>
              <div className="trigger-rule-row__actions">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this rule?')) {
                      deleteMutation.mutate(rule.id);
                    }
                  }}
                  className="cms-btn cms-btn--danger"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div>
        <div className="template-form-card">
          <h4>Create Automation Rule</h4>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="auth-form__field" style={{ marginBottom: '12px' }}>
              <label htmlFor="rule-event">Fired Event Trigger</label>
              <select id="rule-event" {...register('eventName')}>
                {EVENT_NAMES.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-form__field" style={{ marginBottom: '12px' }}>
              <label htmlFor="rule-tier">Qualifying User Tier (Optional)</label>
              <select id="rule-tier" {...register('tierId')}>
                <option value="ALL">All Tiers (Any)</option>
                {tiers.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name} (Min: ${t.minAmount})
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-form__field" style={{ marginBottom: '12px' }}>
              <label htmlFor="rule-template">Email Action Template</label>
              <select id="rule-template" {...register('emailTemplateId')}>
                <option value="">-- Select Template --</option>
                {templates.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Internal Roles to Notify (Optional)
              </span>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
                Admins holding the selected roles will receive a dashboard bell notification when this trigger fires.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {ADMIN_ROLES.map((role) => (
                  <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      value={role}
                      {...register('adminRoles')}
                    />
                    {role.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="submit"
                className="cms-btn cms-btn--primary"
                disabled={createMutation.isPending}
              >
                Create Rule
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

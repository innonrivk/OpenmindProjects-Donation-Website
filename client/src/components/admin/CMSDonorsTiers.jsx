import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';

/**
 * CMSDonorsTiers Component — Renders the donor tier assignment and management workspace.
 *
 * Why? Separating this from the Admin role assignment component keeps files modular.
 */
export default function CMSDonorsTiers() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTiers, setSelectedTiers] = useState({}); // userId -> tierId to assign
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Debounce search term to avoid hitting the API too frequently
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search change
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // 1. Fetch donors with server-side pagination and search
  const { data: donorsData = {}, isLoading: donorsLoading } = useQuery({
    queryKey: ['admin-donors', page, debouncedSearch],
    queryFn: async () => {
      const { data } = await adminApi.get('/users/donors', {
        params: { page, limit: 10, search: debouncedSearch },
      });
      return data;
    },
  });

  const donors = donorsData.donors || [];
  const pagination = donorsData.pagination || { page: 1, totalPages: 1 };

  // 2. Fetch all available tiers for selection
  const { data: tiers = [], isLoading: tiersLoading } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async () => {
      const { data } = await adminApi.get('/tiers');
      return data;
    },
  });

  // 3. Assign Tier mutation
  const assignMutation = useMutation({
    mutationFn: async ({ userId, tierId }) => {
      return adminApi.post(`/users/${userId}/tiers`, { tierId });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-donors'] });
      setSuccessMessage(res.data.message || 'Tier manually assigned successfully.');
      setApiError('');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Failed to assign tier.');
      setSuccessMessage('');
      setTimeout(() => setApiError(''), 3000);
    },
  });

  // 4. Remove Tier mutation
  const removeMutation = useMutation({
    mutationFn: async ({ userId, tierId }) => {
      return adminApi.delete(`/users/${userId}/tiers/${tierId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-donors'] });
      setSuccessMessage('Tier removed successfully.');
      setApiError('');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Failed to remove tier.');
      setSuccessMessage('');
      setTimeout(() => setApiError(''), 3000);
    },
  });

  const handleAssignTier = (userId) => {
    const tierId = selectedTiers[userId];
    if (!tierId) return;
    assignMutation.mutate({ userId, tierId });
    // Reset selection
    setSelectedTiers((prev) => ({ ...prev, [userId]: '' }));
  };

  const handleRemoveTier = (userId, tierId) => {
    if (window.confirm('Are you sure you want to remove this tier assignment?')) {
      removeMutation.mutate({ userId, tierId });
    }
  };

  if (donorsLoading || tiersLoading) {
    return <div className="admin-loading" style={{ padding: '20px', textAlign: 'center' }}>Loading donors and tiers...</div>;
  }

  return (
    <div style={{ marginTop: '16px' }}>
      {apiError && <div className="cms-error-banner" style={{ margin: '12px 0', padding: '10px 15px', background: 'rgba(234, 67, 53, 0.1)', color: '#ea4335', borderRadius: '4px' }}>{apiError}</div>}
      {successMessage && <div className="cms-success-banner" style={{ margin: '12px 0', padding: '10px 15px', background: 'rgba(52, 168, 83, 0.1)', color: 'var(--brand-green)', borderRadius: '4px' }}>{successMessage}</div>}

      {/* Search Input bar */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search donors by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            fontSize: '0.95rem',
          }}
        />
      </div>

      {/* Donors Table */}
      <div className="cms-table-container glass" style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
        <table className="cms-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
              <th style={{ padding: '12px 15px', color: 'var(--color-text-primary)' }}>Donor Name</th>
              <th style={{ padding: '12px 15px', color: 'var(--color-text-primary)' }}>Email Address</th>
              <th style={{ padding: '12px 15px', color: 'var(--color-text-primary)' }}>Sub Amount</th>
              <th style={{ padding: '12px 15px', color: 'var(--color-text-primary)' }}>Assigned Tiers</th>
              <th style={{ padding: '12px 15px', color: 'var(--color-text-primary)' }}>Assign New Tier</th>
            </tr>
          </thead>
          <tbody>
            {donors.map((donor) => {
              const activeUserTiers = donor.userTiers || [];

              return (
                <tr key={donor.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 15px', fontWeight: '500', color: 'var(--color-text-primary)' }}>
                    {donor.firstName} {donor.lastName}
                  </td>
                  <td style={{ padding: '12px 15px', color: 'var(--color-text-primary)' }}>{donor.email}</td>
                  <td style={{ padding: '12px 15px', color: 'var(--color-text-primary)' }}>
                    {donor.monthlyAmount > 0 ? `$${donor.monthlyAmount}/mo` : 'No active sub'}
                  </td>
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {activeUserTiers.map((ut) => {
                        const isAuto = ut.assignedBy === 'AUTO_SUM';
                        return (
                          <div
                            key={ut.tierId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              background: isAuto ? 'rgba(52, 168, 83, 0.1)' : 'rgba(66, 133, 244, 0.1)',
                              color: isAuto ? 'var(--brand-green)' : 'var(--brand-blue)',
                              border: `1px solid ${isAuto ? 'rgba(52, 168, 83, 0.2)' : 'rgba(66, 133, 244, 0.2)'}`,
                            }}
                          >
                            <span>{ut.tier?.name}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 'normal' }}>
                              ({isAuto ? 'Auto' : 'Manual'})
                            </span>
                            <button
                              type="button"
                              onClick={() => !isAuto && handleRemoveTier(donor.id, ut.tierId)}
                              disabled={isAuto}
                              title={isAuto ? 'This tier is auto-assigned based on subscription amount and cannot be removed manually.' : 'Remove Tier'}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'inherit',
                                padding: 0,
                                cursor: isAuto ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                marginLeft: '4px',
                                lineHeight: 1,
                                opacity: isAuto ? 0.4 : 1,
                              }}
                            >
                              &times;
                            </button>
                          </div>
                        );
                      })}
                      {activeUserTiers.length === 0 && (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No tiers</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={selectedTiers[donor.id] || ''}
                        onChange={(e) =>
                          setSelectedTiers((prev) => ({ ...prev, [donor.id]: e.target.value }))
                        }
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid var(--color-border)',
                          background: '#ffffff',
                          color: '#000000',
                          fontSize: '0.85rem',
                        }}
                      >
                        <option value="">-- Select Tier --</option>
                        {tiers
                          .filter((t) => !t.isAutoAppliedBySum && !activeUserTiers.some((ut) => ut.tierId === t.id))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} (Lvl {t.tierLevel})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAssignTier(donor.id)}
                        disabled={!selectedTiers[donor.id]}
                        className="cms-btn cms-btn--primary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.85rem',
                          borderRadius: '4px',
                        }}
                      >
                        Assign
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: 0 }}>
                      ⚡ Subscription tiers (Regular, Shareholder, Patron) are assigned automatically by the system. Assign standalone override tiers (like VIP Patron) here.
                    </p>
                  </td>
                </tr>
              );
            })}
            {donors.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No donor records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="cms-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              borderRadius: '4px',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Page {page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="cms-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              borderRadius: '4px',
              cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer',
              opacity: page === pagination.totalPages ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

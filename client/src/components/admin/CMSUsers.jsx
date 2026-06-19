import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { useAdminAuth } from '../../context/AdminAuthContext';
import CMSUsersAddForm from './CMSUsersAddForm';
import CMSUsersRoleGuide from './CMSUsersRoleGuide';
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal';

/**
 * CMSUsers — Consolidated Administrator Management panel.
 *
 * Why? Provides Sysadmins with a single unified workspace to manage active administrators
 * and pre-authorize email addresses for automatic role promotion.
 * Why ConfirmDeleteModal? Integrates the custom premium modal instead of blocking native browser confirm alerts.
 */
export default function CMSUsers() {
  const queryClient = useQueryClient();
  const { admin: currentAdmin } = useAdminAuth();
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch all admins (both registered and pending) in a single request
  const { data: usersData = {}, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await adminApi.get('/users');
      return data;
    },
  });

  const users = usersData.users || [];

  // Invite/Pre-assign mutation
  const inviteAdminMutation = useMutation({
    mutationFn: async (payload) => {
      return adminApi.post('/users', payload);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSuccessMessage(response.data.message || 'Administrator pre-authorized successfully.');
      setApiError('');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Failed to invite admin.');
      setSuccessMessage('');
    },
  });

  // Update role mutation (handles both registered and pending)
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }) => {
      return adminApi.patch(`/users/${id}/role`, { role });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSuccessMessage(response.data.message || 'Privileges updated successfully.');
      setApiError('');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Failed to update role.');
      setSuccessMessage('');
    },
  });

  // Remove/Demote mutation (handles both registered and pending)
  const removeAdminMutation = useMutation({
    mutationFn: async (id) => {
      return adminApi.delete(`/users/${id}`);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSuccessMessage(response.data.message || 'Administrator removed.');
      setApiError('');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Failed to remove admin.');
      setSuccessMessage('');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    },
  });

  const handleRoleChange = (userId, email, newRole) => {
    const isSelf = currentAdmin?.id === userId || currentAdmin?.email?.toLowerCase() === email.toLowerCase();
    if (isSelf) {
      alert('You cannot modify your own role.');
      return;
    }
    updateRoleMutation.mutate({ id: userId, role: newRole });
  };

  const handleRemoveClick = (user) => {
    const isSelf = currentAdmin?.id === user.id || currentAdmin?.email?.toLowerCase() === user.email.toLowerCase();
    if (isSelf) {
      alert('You cannot remove yourself.');
      return;
    }
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  if (isLoading) {
    return <div className="admin-loading" style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading user management...</div>;
  }

  return (
    <div className="cms-section">
      <div className="cms-section__header" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-text-primary)' }}>User Management (Admin Roles)</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '5px', fontSize: '0.95rem' }}>
          Assign roles to existing administrators or pre-authorize email addresses for automatic promotion.
        </p>
      </div>

      {apiError && <div className="cms-error-banner" style={{ margin: '15px 0', padding: '10px 15px', background: 'rgba(234, 67, 53, 0.1)', color: '#ea4335', borderRadius: '4px' }}>{apiError}</div>}
      {successMessage && <div className="cms-success-banner" style={{ margin: '15px 0', background: 'rgba(52, 168, 83, 0.1)', color: 'var(--brand-green)', padding: '10px 15px', borderRadius: '4px' }}>{successMessage}</div>}

      <CMSUsersRoleGuide />

      <CMSUsersAddForm
        onInvite={inviteAdminMutation.mutate}
        isPending={inviteAdminMutation.isPending}
        currentAdminEmail={currentAdmin?.email}
      />

      {/* Administrators List Table */}
      <div className="cms-table-container glass" style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
        <table className="cms-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
              <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Name</th>
              <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Email Address</th>
              <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Role</th>
              <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Status / Joined</th>
              <th style={{ padding: '15px', color: 'var(--color-text-primary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = currentAdmin?.id === user.id || currentAdmin?.email?.toLowerCase() === user.email.toLowerCase();

              return (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border)', background: isSelf ? 'rgba(66, 133, 244, 0.02)' : 'transparent' }}>
                  <td style={{ padding: '15px', color: 'var(--color-text-primary)' }}>
                    {user.isPending ? (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Pending Sign-up</span>
                    ) : (
                      `${user.firstName} ${user.lastName}`
                    )}
                    {isSelf && <span style={{ fontSize: '0.8rem', background: 'var(--brand-blue)', color: 'white', padding: '2px 6px', borderRadius: '10px', marginLeft: '5px' }}>You</span>}
                  </td>
                  <td style={{ padding: '15px', color: 'var(--color-text-primary)' }}>{user.email}</td>
                  <td style={{ padding: '15px' }}>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, user.email, e.target.value)}
                      disabled={isSelf || updateRoleMutation.isPending}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        background: '#ffffff',
                        color: '#000000',
                        border: '1px solid rgba(0, 0, 0, 0.15)',
                        cursor: isSelf ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      <option value="CONTENT_ADMIN" style={{ color: '#000000', background: '#ffffff' }}>Content Admin</option>
                      <option value="OPERATIONS_ADMIN" style={{ color: '#000000', background: '#ffffff' }}>Operations Admin</option>
                      <option value="SUPER_ADMIN" style={{ color: '#000000', background: '#ffffff' }}>Super Admin</option>
                      <option value="SYSADMIN" style={{ color: '#000000', background: '#ffffff' }}>Sysadmin</option>
                    </select>
                  </td>
                  <td style={{ padding: '15px', color: 'var(--color-text-primary)' }}>
                    {user.isPending ? (
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', background: 'rgba(244, 180, 0, 0.15)', color: '#fbbc04' }}>
                        Pending
                      </span>
                    ) : (
                      new Date(user.createdAt).toLocaleDateString()
                    )}
                  </td>
                  <td style={{ padding: '15px' }}>
                    <button
                      onClick={() => handleRemoveClick(user)}
                      disabled={isSelf || removeAdminMutation.isPending}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        background: 'rgba(234, 67, 53, 0.1)',
                        color: '#ea4335',
                        border: '1px solid rgba(234, 67, 53, 0.2)',
                        cursor: isSelf ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        transition: 'opacity 0.2s',
                        opacity: isSelf ? 0.5 : 1
                      }}
                    >
                      {user.isPending ? 'Cancel Invite' : 'Remove Admin'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No administrators found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        title={userToDelete?.isPending ? 'Cancel Invitation' : 'Remove Administrator'}
        message={
          userToDelete?.isPending
            ? `Are you sure you want to remove the pre-authorized invitation for <strong>${userToDelete?.email}</strong>?`
            : `Are you sure you want to demote <strong>${userToDelete?.email}</strong> back to a regular donor? This will instantly terminate all active admin sessions.`
        }
        isLoading={removeAdminMutation.isPending}
        onConfirm={() => removeAdminMutation.mutate(userToDelete?.id)}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
      />
    </div>
  );
}

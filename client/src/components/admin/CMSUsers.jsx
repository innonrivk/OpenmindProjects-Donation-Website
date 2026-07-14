import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { useAdminAuth } from '../../context/AdminAuthContext';
import CMSUsersAddForm from './CMSUsersAddForm';
import CMSUsersRoleGuide from './CMSUsersRoleGuide';
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal';
import CMSAdminsTable from './CMSAdminsTable';
import CMSDonorsTiers from './CMSDonorsTiers';

/**
 * CMSUsers — Consolidated Administrator and Donor Tier Management panel.
 *
 * Why? Provides Sysadmins with a single unified workspace to manage active administrators,
 * pre-authorize admin emails, and assign manual perks/tiers to standard donor accounts.
 */
export default function CMSUsers() {
  const queryClient = useQueryClient();
  const { admin: currentAdmin } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('ADMINS'); // 'ADMINS' | 'DONORS'
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
    enabled: activeTab === 'ADMINS',
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

  if (activeTab === 'ADMINS' && isLoading) {
    return <div className="admin-loading" style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading user management...</div>;
  }

  return (
    <div className="cms-section">
      <div className="cms-section__header" style={{ marginBottom: '20px', borderBottom: 'none' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-text-primary)' }}>User &amp; Tier Management</h2>
      </div>

      {/* Tabs Header bar */}
      <div
        className="cms-tabs"
        style={{
          display: 'flex',
          gap: '16px',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: '24px',
        }}
      >
        <button
          type="button"
          data-testid="users-admins-tab"
          onClick={() => setActiveTab('ADMINS')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ADMINS' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
            color: activeTab === 'ADMINS' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Administrators
        </button>
        <button
          type="button"
          data-testid="users-donors-tab"
          onClick={() => setActiveTab('DONORS')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'DONORS' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
            color: activeTab === 'DONORS' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Donor Tiers
        </button>
      </div>

      {activeTab === 'DONORS' ? (
        <CMSDonorsTiers />
      ) : (
        <>
          {apiError && <div className="cms-error-banner" style={{ margin: '15px 0', padding: '10px 15px', background: 'rgba(234, 67, 53, 0.1)', color: '#ea4335', borderRadius: '4px' }}>{apiError}</div>}
          {successMessage && <div className="cms-success-banner" style={{ margin: '15px 0', background: 'rgba(52, 168, 83, 0.1)', color: 'var(--brand-green)', padding: '10px 15px', borderRadius: '4px' }}>{successMessage}</div>}

          <CMSUsersRoleGuide />

          <CMSUsersAddForm
            onInvite={inviteAdminMutation.mutate}
            isPending={inviteAdminMutation.isPending}
            currentAdminEmail={currentAdmin?.email}
          />

          <CMSAdminsTable
            users={users}
            currentAdmin={currentAdmin}
            updateRoleMutation={updateRoleMutation}
            handleRoleChange={handleRoleChange}
            handleRemoveClick={handleRemoveClick}
          />

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
        </>
      )}
    </div>
  );
}

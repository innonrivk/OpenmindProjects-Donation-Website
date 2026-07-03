import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminApi } from '../../lib/api';
import MarkdownHelper from './MarkdownHelper';
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal';
import PerkChipInput from '../ui/PerkChipInput';

const TierFormSchema = z.object({
  tierLevel: z.preprocess((val) => parseInt(val, 10), z.number().int().min(1)),
  name: z.string().min(1, 'Name is required'),
  minAmount: z.preprocess((val) => parseInt(val, 10), z.number().int().min(0)),
  maxAmount: z.preprocess((val) => (val === '' ? null : parseInt(val, 10)), z.number().int().min(0).nullable().optional()),
  perks: z.array(z.string()).optional(),
  isAutoAppliedBySum: z.boolean().optional(),
});

export default function CMSTiers() {
  const queryClient = useQueryClient();
  const [editingTier, setEditingTier] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [apiError, setApiError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [perks, setPerks] = useState([]);

  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async () => {
      const { data } = await adminApi.get('/tiers');
      return data;
    },
  });

  const { data: boxes = [] } = useQuery({
    queryKey: ['admin-boxes'],
    queryFn: async () => {
      const { data } = await adminApi.get('/content/donation-boxes');
      return data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(TierFormSchema),
    defaultValues: { tierLevel: 1, name: '', minAmount: 0, maxAmount: '', isAutoAppliedBySum: false },
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, perks };
      if (editingTier) return adminApi.put(`/tiers/${editingTier.id}`, payload);
      return adminApi.post('/tiers', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      closeForm();
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Operation failed.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => adminApi.delete(`/tiers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      alert(err.response?.data?.message || err.message || 'Delete failed.');
      setDeleteTarget(null);
    },
  });

  const openForm = (tier = null) => {
    setApiError('');
    if (tier) {
      setEditingTier(tier);
      let parsedPerks;
      try {
        parsedPerks = typeof tier.perks === 'string' ? JSON.parse(tier.perks) : (Array.isArray(tier.perks) ? tier.perks : []);
      } catch {
        parsedPerks = [];
      }
      setPerks(parsedPerks);
      reset({
        tierLevel: tier.tierLevel,
        name: tier.name,
        minAmount: tier.minAmount,
        maxAmount: tier.maxAmount === null ? '' : tier.maxAmount,
        isAutoAppliedBySum: tier.isAutoAppliedBySum ?? false,
      });
    } else {
      setEditingTier(null);
      setPerks([]);
      reset({ tierLevel: tiers.length + 1, name: '', minAmount: 0, maxAmount: '', isAutoAppliedBySum: false });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTier(null);
    setPerks([]);
    reset();
  };

  const getTierPerks = (tier) => {
    try {
      return typeof tier.perks === 'string' ? JSON.parse(tier.perks) : (Array.isArray(tier.perks) ? tier.perks : []);
    } catch {
      return [];
    }
  };

  const linkedBoxesCount = deleteTarget ? boxes.filter((b) => b.tierId === deleteTarget.id).length : 0;
  const deleteWarningMessage = deleteTarget
    ? linkedBoxesCount > 0
      ? `This Tier is linked to <strong>${linkedBoxesCount} Donation Box(es)</strong>. Deleting it will remove inherited perks from those boxes. Continue?`
      : `Are you sure you want to delete the tier <strong>${deleteTarget.name}</strong>?`
    : '';

  if (isLoading) return <div className="admin-loading">Loading donation tiers...</div>;

  return (
    <div className="cms-section">
      <div className="cms-section__header">
        <h2>Donation Tiers & Benefits</h2>
        {!isFormOpen && (
          <button onClick={() => openForm()} className="cms-btn cms-btn--primary">
            + Add New Tier
          </button>
        )}
      </div>

      {apiError && <div className="cms-error-banner">{apiError}</div>}

      {isFormOpen ? (
        <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="cms-form glass animate-fade-in">
          <div className="workspace-container">
            <div className="fields-workspace">
              <h3>{editingTier ? `Edit Tier: ${editingTier.name}` : 'Add Benefit Tier'}</h3>

              <div className="cms-form__grid">
                <div className="cms-form__field">
                  <label>Tier Name</label>
                  <input {...register('name')} placeholder="e.g. Regular, Shareholder" />
                  {errors.name && <span className="field-error">{errors.name.message}</span>}
                </div>

                <div className="cms-form__field">
                  <label>Hierarchy Level</label>
                  <input type="number" {...register('tierLevel')} />
                  {errors.tierLevel && <span className="field-error">{errors.tierLevel.message}</span>}
                </div>

                <div className="cms-form__field">
                  <label>Min Monthly Amount ($)</label>
                  <input type="number" {...register('minAmount')} />
                  {errors.minAmount && <span className="field-error">{errors.minAmount.message}</span>}
                </div>

                <div className="cms-form__field">
                  <label>Max Monthly Amount ($) (Empty = Unlimited)</label>
                  <input type="number" {...register('maxAmount')} placeholder="e.g. 84" />
                  {errors.maxAmount && <span className="field-error">{errors.maxAmount.message}</span>}
                </div>
              </div>

              <div className="cms-form__field cms-form__field--checkbox" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                <input type="checkbox" id="isAutoAppliedBySum" {...register('isAutoAppliedBySum')} style={{ width: 'auto', margin: 0, height: '18px', width: '18px', cursor: 'pointer' }} />
                <label htmlFor="isAutoAppliedBySum" style={{ margin: 0, cursor: 'pointer', fontWeight: '500', color: 'var(--color-text-primary)' }}>Automatically apply this tier when total donation meets threshold</label>
              </div>

              <div className="cms-form__field" style={{ marginTop: '16px' }}>
                <label>Tier Perks List (Chips)</label>
                <PerkChipInput
                  value={perks}
                  onChange={setPerks}
                  placeholder="Type a perk and press Enter..."
                />
              </div>
            </div>

            <div className="sidebar-workspace">
              <MarkdownHelper />
            </div>
          </div>

          <div className="cms-form__actions">
            <button type="button" onClick={closeForm} className="cms-btn cms-btn--secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="cms-btn cms-btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Tier'}
            </button>
          </div>
        </form>
      ) : (
        <div className="cms-cards-grid">
          {tiers.map((tier) => (
            <div key={tier.id} className="cms-card glass">
              <div className="cms-card__order">Level {tier.tierLevel}</div>
              <h4>{tier.name}</h4>
              <div className="cms-card__amount">
                ${tier.minAmount} {tier.maxAmount != null ? `– $${tier.maxAmount}` : '+'} / mo
              </div>
              {tier.isAutoAppliedBySum && (
                <div style={{ fontSize: '0.8rem', background: 'rgba(52, 168, 83, 0.1)', color: 'var(--brand-green)', display: 'inline-block', padding: '2px 8px', borderRadius: '12px', marginTop: '6px', fontWeight: '500' }}>
                  Auto-Applied
                </div>
              )}
              <div style={{ margin: '12px 0' }}>
                <PerkChipInput
                  value={getTierPerks(tier)}
                  disabled={true}
                />
              </div>
              <div className="cms-card__actions">
                <button onClick={() => openForm(tier)} className="cms-btn-action">Edit</button>
                <button onClick={() => setDeleteTarget(tier)} className="cms-btn-action cms-btn-action--danger">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Donation Tier"
        message={deleteWarningMessage}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

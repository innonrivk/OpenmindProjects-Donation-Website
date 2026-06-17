import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminApi } from '../../lib/api';
import MarkdownHelper from './MarkdownHelper';
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal';
import PerkChipInput from '../ui/PerkChipInput';

const DonationBoxSchema = z.object({
  title: z.string().optional().default(''),
  amount: z.preprocess((val) => (val === '' || val === undefined || val === null ? 0 : Math.round(parseFloat(val))), z.number().int().min(0)),
  tierId: z.preprocess((val) => (val === '' || val === undefined || val === null ? null : parseInt(val, 10)), z.number().int().nullable()),
  tierDetails: z.string().optional().default(''),
  perks: z.array(z.string()).optional().default([]),
  buttonText: z.string().optional().default('Donate'),
  isCustomAmount: z.boolean(),
  isRecurring: z.boolean(),
  isActive: z.boolean(),
  displayOrder: z.preprocess((val) => parseInt(val, 10), z.number().int().min(0)),
}).refine(data => {
  // If not linked to a tier and not custom amount, title is required
  if (!data.tierId && !data.isCustomAmount && (!data.title || data.title.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Title is required for standalone donation cards',
  path: ['title'],
}).refine(data => {
  // If not linked to a tier and not custom amount, amount must be > 0
  if (!data.tierId && !data.isCustomAmount && data.amount <= 0) {
    return false;
  }
  return true;
}, {
  message: 'Amount must be greater than 0 for standalone cards',
  path: ['amount'],
});

/**
 * CMSDonationBoxes — Handles CRUD for individual donation cards.
 */
export default function CMSDonationBoxes() {
  const queryClient = useQueryClient();
  const [editingBox, setEditingBox] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [apiError, setApiError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [perks, setPerks] = useState([]);
  const [isOverridingPerks, setIsOverridingPerks] = useState(false);

  const { data: boxes = [], isLoading: loadingBoxes } = useQuery({
    queryKey: ['admin-boxes'],
    queryFn: async () => {
      const { data } = await adminApi.get('/content/donation-boxes');
      return data;
    },
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async () => {
      const { data } = await adminApi.get('/tiers');
      return data;
    },
  });

  const { register, handleSubmit, reset, watch, control, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(DonationBoxSchema),
    defaultValues: {
      title: '', amount: '', tierId: '', tierDetails: '',
      buttonText: 'Donate', isCustomAmount: false, isRecurring: true, isActive: true, displayOrder: 0
    },
  });

  const watchedTierId = watch('tierId');
  const prevTierIdRef = useRef(watchedTierId);

  // Clear overrides and force standard values when tier is changed/selected
  useEffect(() => {
    if (prevTierIdRef.current !== watchedTierId) {
      setPerks([]);
      setIsOverridingPerks(false);
      if (watchedTierId) {
        setValue('title', '');
        setValue('amount', '');
        setValue('isCustomAmount', false);
        setValue('isRecurring', true);
      }
    }
    prevTierIdRef.current = watchedTierId;
  }, [watchedTierId, setValue]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingBox) {
        return adminApi.put(`/content/donation-boxes/${editingBox.id}`, payload);
      }
      return adminApi.post('/content/donation-boxes', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-boxes'] });
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      closeForm();
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Operation failed.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => adminApi.delete(`/content/donation-boxes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-boxes'] });
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      alert(err.response?.data?.message || err.message || 'Delete failed.');
      setDeleteTarget(null);
    },
  });

  const openForm = (box = null) => {
    setApiError('');
    const initialTierId = box ? (box.tierId === null ? '' : box.tierId) : '';
    prevTierIdRef.current = initialTierId;

    if (box) {
      setEditingBox(box);
      
      const rawPerks = Array.isArray(box.perks)
        ? box.perks
        : (typeof box.perks === 'string' ? JSON.parse(box.perks || '[]') : []);
      const hasCustomPerks = box.tierId !== null && rawPerks.length > 0;
      setIsOverridingPerks(hasCustomPerks);
      setPerks(rawPerks);

      reset({
        title: box.title === '' ? '' : box.title,
        amount: box.amount === 0 ? '' : box.amount,
        tierId: box.tierId === null ? '' : box.tierId,
        tierDetails: box.tierDetails || '',
        buttonText: box.buttonText || 'Donate',
        isCustomAmount: box.isCustomAmount,
        isRecurring: box.isRecurring,
        isActive: box.isActive,
        displayOrder: box.displayOrder,
      });
    } else {
      setEditingBox(null);
      setPerks([]);
      setIsOverridingPerks(false);
      reset({
        title: '', amount: '', tierId: '', tierDetails: '',
        buttonText: 'Donate', isCustomAmount: false, isRecurring: true, isActive: true, displayOrder: boxes.length
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingBox(null);
    setPerks([]);
    setIsOverridingPerks(false);
    reset();
  };

  const getTierPerks = (tier) => {
    if (!tier) return [];
    try {
      return typeof tier.perks === 'string'
        ? JSON.parse(tier.perks)
        : (Array.isArray(tier.perks) ? tier.perks : []);
    } catch {
      return [];
    }
  };

  const onSubmit = (data) => {
    const payload = {
      ...data,
      title: watchedTierId ? '' : (data.title || ''),
      amount: data.amount || 0,
      perks: watchedTierId ? [] : perks,
      isCustomAmount: watchedTierId ? false : data.isCustomAmount,
      isRecurring: watchedTierId ? true : data.isRecurring,
    };
    saveMutation.mutate(payload);
  };

  if (loadingBoxes) return <div className="admin-loading">Loading donation cards...</div>;

  return (
    <div className="cms-section">
      <div className="cms-section__header">
        <h2>Donation Card Configuration</h2>
        {!isFormOpen && (
          <button onClick={() => openForm()} className="cms-btn cms-btn--primary">
            + Add Donation Box
          </button>
        )}
      </div>

      {apiError && <div className="cms-error-banner">{apiError}</div>}

      {isFormOpen ? (
        <form onSubmit={handleSubmit(onSubmit)} className="cms-form glass animate-fade-in">
          <div className="workspace-container">
            <div className="fields-workspace">
              <h3>{editingBox ? `Edit Card: ${editingBox.title || 'bobo'}` : 'Add Donation Card Option'}</h3>

              <div className="cms-form__grid">
                <div className="cms-form__field">
                  <label>
                    Card Title
                    {watchedTierId && (
                      <span style={{ fontSize: '10px', color: 'var(--brand-blue)', marginLeft: '6px' }}>
                        (Standardized: "{tiers.find(t => t.id === parseInt(watchedTierId, 10))?.name}")
                      </span>
                    )}
                  </label>
                  <input
                    {...register('title')}
                    disabled={!!watchedTierId}
                    placeholder={
                      watchedTierId
                        ? `${tiers.find(t => t.id === parseInt(watchedTierId, 10))?.name || ''} (Standardized)`
                        : "e.g. Supporter"
                    }
                  />
                  {errors.title && <span className="field-error">{errors.title.message}</span>}
                </div>

                <div className="cms-form__field">
                  <label>
                    Amount ($)
                    {watchedTierId && (watch('amount') === '' || parseInt(watch('amount'), 10) === 0 || !watch('amount')) && (
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                        (Inheriting: ${tiers.find(t => t.id === parseInt(watchedTierId, 10))?.minAmount})
                      </span>
                    )}
                    {watchedTierId && watch('amount') && parseInt(watch('amount'), 10) > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--brand-blue)', marginLeft: '6px' }}>
                        (✏️ Overriding Tier amount)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    {...register('amount')}
                    placeholder={
                      watchedTierId
                        ? `${tiers.find(t => t.id === parseInt(watchedTierId, 10))?.minAmount || '0'} (Inherited)`
                        : "e.g. 10.00"
                    }
                  />
                  {errors.amount && <span className="field-error">{errors.amount.message}</span>}
                </div>

                <div className="cms-form__field">
                  <label>Link to Level/Tier</label>
                  <select {...register('tierId')}>
                    <option value="">-- No Linked Tier --</option>
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} (${t.minAmount}+)</option>
                    ))}
                  </select>
                </div>

                <div className="cms-form__field">
                  <label>Subtext</label>
                  <input {...register('tierDetails')} placeholder="e.g. Ideal for individuals" />
                </div>

                <div className="cms-form__field">
                  <label>Button Text</label>
                  <input
                    {...register('buttonText')}
                    placeholder={
                      watchedTierId
                        ? `Donate $${tiers.find(t => t.id === parseInt(watchedTierId, 10))?.minAmount || '0'}/mo (Default)`
                        : (watch('amount') && watch('amount') !== '0'
                          ? `Donate $${watch('amount')}${watch('isRecurring') ? '/mo' : ''} (Default)`
                          : "Donate $[amount]/mo (Default)")
                    }
                  />
                </div>

                <div className="cms-form__field">
                  <label>Display Position Order</label>
                  <input type="number" {...register('displayOrder')} />
                </div>
              </div>

              <div className="cms-form__field" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Perks List (Chips)</label>
                </div>

                {watchedTierId && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                    🛈 Perks are inherited from the linked Tier. Customize them in the **Tiers & Benefits** screen to maintain global consistency.
                  </div>
                )}

                <PerkChipInput
                  value={
                    watchedTierId
                      ? getTierPerks(tiers.find((t) => t.id === parseInt(watchedTierId, 10)))
                      : perks
                  }
                  onChange={setPerks}
                  disabled={!!watchedTierId}
                  placeholder={watchedTierId ? "Perks are managed by Tier" : "Type a perk and press Enter..."}
                />
              </div>

              <div className="cms-form__row-checkboxes" style={{ marginTop: '16px' }}>
                <label className={`checkbox-label ${watchedTierId ? 'checkbox-label--disabled' : ''}`}>
                  <input type="checkbox" {...register('isCustomAmount')} disabled={!!watchedTierId} /> Is Custom Input Box
                </label>
                <label className={`checkbox-label ${watchedTierId ? 'checkbox-label--disabled' : ''}`}>
                  <input type="checkbox" {...register('isRecurring')} disabled={!!watchedTierId} /> Is Subscription / Monthly
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" {...register('isActive')} /> Is Card Active/Visible
                </label>
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
              {isSubmitting ? 'Saving...' : 'Save Card'}
            </button>
          </div>
        </form>
      ) : (
        <div className="cms-cards-grid">
          {boxes.map((box) => {
            const isLinked = box.tier && !box.isCustomAmount;
            const resolvedTitle = isLinked ? box.tier.name : (box.title || '');
            const resolvedAmount = isLinked && box.amount === 0 ? box.tier.minAmount : (box.amount || 0);
            
            const rawBoxPerks = Array.isArray(box.perks)
              ? box.perks
              : (typeof box.perks === 'string' ? JSON.parse(box.perks || '[]') : []);
            const resolvedPerks = isLinked ? getTierPerks(box.tier) : (rawBoxPerks.length > 0 ? rawBoxPerks : []);

            return (
              <div key={box.id} className={`cms-card glass ${!box.isActive ? 'cms-card--inactive' : ''}`}>
                <div className="cms-card__order">#{box.displayOrder}</div>
                <h4>{resolvedTitle}</h4>
                <div className="cms-card__amount">
                  {box.isCustomAmount ? 'Custom Amount' : `$${resolvedAmount}`}
                  {box.isRecurring && <span className="cms-card__freq"> / mo</span>}
                  {box.tier && box.amount === 0 && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>🛈 Inheriting ${box.tier.minAmount} from Tier</span>}
                  {box.tier && box.amount > 0 && <span style={{ fontSize: '10px', color: 'var(--brand-blue)', display: 'block', marginTop: '4px' }}>✏️ Overriding Tier amount</span>}
                </div>
                {box.tier && <div className="cms-card__badge-tier">Linked Tier: {box.tier.name}</div>}
                
                <div className="cms-card__perks-list-preview" style={{ margin: '10px 0' }}>
                  <PerkChipInput
                    value={resolvedPerks}
                    disabled={true}
                  />
                </div>

                <p className="cms-card__perks-summary">{box.tierDetails || 'No subtext specified.'}</p>
                <div className="cms-card__actions">
                  <button onClick={() => openForm(box)} className="cms-btn-action">Edit</button>
                  <button onClick={() => setDeleteTarget(box)} className="cms-btn-action cms-btn-action--danger">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Donation Box"
        message={deleteTarget ? `Are you sure you want to delete the donation card <strong>${deleteTarget.title || 'this box'}</strong>?` : ''}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

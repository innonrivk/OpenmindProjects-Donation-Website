import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminApi } from '../../lib/api';
import MarkdownHelper from './MarkdownHelper';
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal';

const MilestoneSchema = z.object({
  amountUsd: z.preprocess((val) => parseInt(val, 10), z.number().int().min(1, 'Amount must be at least $1')),
  label: z.string().min(1, 'Milestone label/title is required'),
  description: z.string().min(1, 'Description is required'),
  isRepeatable: z.boolean(),
  displayOrder: z.preprocess((val) => parseInt(val, 10), z.number().int().min(0)),
});

/**
 * CMSMilestones — Admin section for managing donor roadmap achievements.
 */
export default function CMSMilestones() {
  const queryClient = useQueryClient();
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [apiError, setApiError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['admin-milestones'],
    queryFn: async () => {
      const { data } = await adminApi.get('/milestones');
      return data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(MilestoneSchema),
    defaultValues: { amountUsd: 10, label: '', description: '', isRepeatable: false, displayOrder: 0 },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingMilestone) {
        return adminApi.put(`/milestones/${editingMilestone.id}`, payload);
      }
      return adminApi.post('/milestones', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      closeForm();
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Operation failed.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => adminApi.delete(`/milestones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      alert(err.response?.data?.message || err.message || 'Delete failed.');
      setDeleteTarget(null);
    },
  });

  const openForm = (m = null) => {
    setApiError('');
    if (m) {
      setEditingMilestone(m);
      reset({
        amountUsd: m.amountUsd,
        label: m.label,
        description: m.description,
        isRepeatable: m.isRepeatable,
        displayOrder: m.displayOrder,
      });
    } else {
      setEditingMilestone(null);
      reset({ amountUsd: 100, label: '', description: '', isRepeatable: false, displayOrder: milestones.length });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingMilestone(null);
    reset();
  };

  if (isLoading) return <div className="admin-loading">Loading achievements...</div>;

  return (
    <div className="cms-section">
      <div className="cms-section__header">
        <h2>Donation Milestones & Roadmap</h2>
        {!isFormOpen && (
          <button data-testid="add-milestone-btn" onClick={() => openForm()} className="cms-btn cms-btn--primary">
            + Add Milestone
          </button>
        )}
      </div>

      {apiError && <div className="cms-error-banner">{apiError}</div>}

      {isFormOpen ? (
        <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="cms-form glass animate-fade-in">
          <div className="workspace-container">
            <div className="fields-workspace">
              <h3>{editingMilestone ? `Edit Milestone: ${editingMilestone.label}` : 'Create Donation Milestone'}</h3>

              <div className="cms-form__grid">
                <div className="cms-form__field">
                  <label>Milestone Name / Label</label>
                  <input data-testid="milestone-label-input" {...register('label')} placeholder="e.g. Silver Friend" />
                  {errors.label && <span className="field-error">{errors.label.message}</span>}
                </div>

                <div className="cms-form__field">
                  <label>Target Amount ($)</label>
                  <input type="number" {...register('amountUsd')} placeholder="e.g. 1000" />
                  {errors.amountUsd && <span className="field-error">{errors.amountUsd.message}</span>}
                </div>

                <div className="cms-form__field">
                  <label>Display Position Order</label>
                  <input type="number" {...register('displayOrder')} />
                </div>

                <div className="cms-form__field">
                  <label>Description / Reward text</label>
                  <input {...register('description')} placeholder="e.g. Silver friend certificate sent to your home" />
                  {errors.description && <span className="field-error">{errors.description.message}</span>}
                </div>
              </div>

              <div className="cms-form__row-checkboxes">
                <label className="checkbox-label">
                  <input type="checkbox" {...register('isRepeatable')} /> Is Repeatable One-Time Objective
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
              {isSubmitting ? 'Saving...' : 'Save Milestone'}
            </button>
          </div>
        </form>
      ) : (
        <div className="cms-cards-grid">
          {milestones.map((m) => (
            <div key={m.id} className="cms-card glass">
              <div className="cms-card__order">Order #{m.displayOrder}</div>
              <h4>{m.label}</h4>
              <div className="cms-card__amount">
                ${m.amountUsd.toLocaleString()}
              </div>
              <div className="cms-card__badge-tier" style={{ background: m.isRepeatable ? 'rgba(52, 168, 83, 0.1)' : 'rgba(66, 133, 244, 0.1)', color: m.isRepeatable ? 'var(--brand-green)' : 'var(--brand-blue)' }}>
                {m.isRepeatable ? 'One-Time Objective' : 'Monthly Timeline Milestone'}
              </div>
              <p className="cms-card__perks-summary" style={{ marginTop: '8px' }}>{m.description}</p>
              <div className="cms-card__actions">
                <button onClick={() => openForm(m)} className="cms-btn-action">Edit</button>
                <button
                  onClick={() => setDeleteTarget(m)}
                  className="cms-btn-action cms-btn-action--danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Milestone"
        message={deleteTarget ? `Are you sure you want to delete the milestone <strong>${deleteTarget.label}</strong>? This will demote any donors who reached it.` : ''}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

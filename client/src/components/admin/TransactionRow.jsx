import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { adminApi } from '../../lib/api';

const TransactionMetaSchema = z.object({
  subject: z.string().max(100, 'Subject cannot exceed 100 characters').optional().or(z.literal('')),
  adminNote: z.string().max(500, 'Admin note cannot exceed 500 characters').optional().or(z.literal(''))
});

/**
 * TransactionRow — Renders a single row in the ledger table with inline edit expansion.
 * 
 * Why? Separating row logic from the main CMSTransactions grid reduces file size limits,
 * isolates re-renders, and enables self-contained state for expand/collapse transitions.
 * 
 * @param {Object} props
 * @param {Object} props.tx - The transaction database record object.
 */
export default function TransactionRow({ tx }) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [subjectVal, setSubjectVal] = useState(tx.subject || '');
  const [adminNoteVal, setAdminNoteVal] = useState(tx.adminNote || '');
  const [validationError, setValidationError] = useState('');

  const mutation = useMutation({
    mutationFn: async ({ id, subject, adminNote }) => {
      const { data } = await adminApi.patch(`/transactions/${id}`, { 
        subject: subject || null, 
        adminNote: adminNote || null 
      });
      return data;
    },
    onMutate: async ({ id, subject, adminNote }) => {
      // Cancel any active/inactive queries matching the prefix to prevent race conditions or updates overwriting our optimistic state.
      await queryClient.cancelQueries({ queryKey: ['admin-transactions'] });

      // We retrieve all cached transaction queries because date filters result in dynamic query keys (e.g. ['admin-transactions', start, end]).
      // Snapshotting all of them ensures we can safely rollback any partial or stale views if the server request fails.
      const queries = queryClient.getQueryCache().findAll({ queryKey: ['admin-transactions'] });
      const previousData = queries.map((query) => ({
        queryKey: query.queryKey,
        data: query.state.data,
      }));

      // Optimistically update all matching cache entries immediately so the admin sees the change in their current filter view.
      queries.forEach((query) => {
        queryClient.setQueryData(query.queryKey, (old) => {
          if (!old || !old.transactions) return old;
          return {
            ...old,
            transactions: old.transactions.map((t) =>
              t.id === id ? { ...t, subject: subject || null, adminNote: adminNote || null } : t
            )
          };
        });
      });

      return { previousData };
    },
    onError: (err, newVars, context) => {
      // Restore all original snapshots to revert the optimistic updates across all relevant filters.
      if (context?.previousData) {
        context.previousData.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      setValidationError(err.response?.data?.message || err.message || 'Save failed.');
    },
    onSuccess: () => {
      // Invalidation with prefix matching triggers a background refetch for all matching keys to ensure synchronization.
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      setIsExpanded(false);
    }
  });

  const handleSave = (e) => {
    e.stopPropagation();
    setValidationError('');

    const parsed = TransactionMetaSchema.safeParse({
      subject: subjectVal,
      adminNote: adminNoteVal
    });

    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      const firstErr = Object.values(fields)[0]?.[0];
      setValidationError(firstErr || 'Invalid input values');
      return;
    }

    mutation.mutate({
      id: tx.id,
      subject: subjectVal,
      adminNote: adminNoteVal
    });
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setSubjectVal(tx.subject || '');
    setAdminNoteVal(tx.adminNote || '');
    setValidationError('');
    setIsExpanded(false);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Primary Row */}
      <tr onClick={toggleExpand} style={{ cursor: 'pointer' }} className={isExpanded ? 'row-expanded' : ''}>
        <td className="tx-id-cell">
          <code>{tx.stripeInvoiceId || tx.stripePaymentIntentId || tx.id.slice(0, 8)}</code>
        </td>
        <td>{tx.user ? `${tx.user.firstName} ${tx.user.lastName}` : 'Anonymous'}</td>
        <td>{tx.user?.email || '—'}</td>
        <td><strong>${(tx.amount / 100).toFixed(2)}</strong></td>
        <td>
          <span className={`status-badge status-badge--${tx.status.toLowerCase()}`}>
            {tx.status}
          </span>
        </td>
        <td>{tx.isRecurring ? 'Subscription' : 'One-Time'}</td>
        <td>{tx.subject ? <span className="subject-pill">{tx.subject}</span> : <span className="text-muted">—</span>}</td>
        <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
      </tr>

      {/* Expanded Inline Editor Panel */}
      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--color-border)' }}>
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="inline-editor-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-header">
                    <h4>Edit Transaction Meta</h4>
                  </div>
                  {validationError && (
                    <div className="cms-error-banner" style={{ margin: '0 0 var(--space-md) 0', padding: '8px 12px', fontSize: '12px' }}>
                      {validationError}
                    </div>
                  )}
                  <div className="fields-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 'var(--space-md)' }}>
                    <div className="cms-form__field">
                      <label htmlFor={`sub-${tx.id}`}>Subject Label (Donor-Facing in Email)</label>
                      <input
                        id={`sub-${tx.id}`}
                        value={subjectVal}
                        onChange={(e) => setSubjectVal(e.target.value)}
                        placeholder="e.g. Camp Equipment Fund"
                        maxLength={100}
                      />
                    </div>
                    <div className="cms-form__field">
                      <label htmlFor={`note-${tx.id}`}>Admin Note (Internal-Only)</label>
                      <textarea
                        id={`note-${tx.id}`}
                        value={adminNoteVal}
                        onChange={(e) => setAdminNoteVal(e.target.value)}
                        placeholder="Add internal notes about this payment, donor interactions, etc."
                        rows={2}
                        maxLength={500}
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  </div>
                  <div className="panel-actions" style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
                    <button type="button" onClick={handleCancel} className="cms-btn cms-btn--secondary" disabled={mutation.isPending}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleSave} className="cms-btn cms-btn--primary" disabled={mutation.isPending}>
                      {mutation.isPending ? 'Saving...' : 'Save Meta'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

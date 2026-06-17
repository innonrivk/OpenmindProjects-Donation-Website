import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminApi } from '../../lib/api';
import ReceiptLivePreview from './ReceiptLivePreview';
import './CMSReceiptSettings.css';

const ReceiptSettingsSchema = z.object({
  emailSubjectTemplate: z.string().min(3, 'Subject template must be at least 3 characters').max(200, 'Subject template cannot exceed 200 characters'),
  pdfThankYouMessage:   z.string().max(500, 'Thank you message cannot exceed 500 characters'),
  pdfFooterNote:        z.string().max(300, 'Footer note cannot exceed 300 characters'),
  pdfSignatureName:     z.string().max(100, 'Signature name cannot exceed 100 characters'),
});

const DEFAULT_CHIPS = [
  '{donorName}', '{amount}', '{tierName}', '{date}',
  '{transactionId}', '{transactionSubject}', '{country}'
];

/**
 * CMSReceiptSettings — Admin dashboard interface to edit donation email subjects and PDF texts.
 * 
 * Why? Provides administrators a localized control deck to override default receipt
 * templates per type (one-time, monthly) and per tier, with real-time visual previews.
 */
export default function CMSReceiptSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('GLOBAL');
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const subjectInputRef = useRef(null);

  // 1. Fetch Tiers list
  const { data: tiers = [] } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async () => {
      const { data } = await adminApi.get('/tiers');
      return data;
    }
  });

  // 2. Fetch all receipt settings
  const { data: settingsList = [], isLoading } = useQuery({
    queryKey: ['admin-receipt-settings'],
    queryFn: async () => {
      const { data } = await adminApi.get('/receipt-settings');
      return data;
    }
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(ReceiptSettingsSchema),
    defaultValues: {
      emailSubjectTemplate: '',
      pdfThankYouMessage: '',
      pdfFooterNote: '',
      pdfSignatureName: ''
    }
  });

  const watchedFields = watch();

  // Find the exact settings row for the active tab, fallback to GLOBAL
  const activeSettings = settingsList.find(s => s.donationType === activeTab);
  const globalSettings = settingsList.find(s => s.donationType === 'GLOBAL');

  // Reset form values whenever active tab or fetched settings change
  useEffect(() => {
    const target = activeSettings || globalSettings || {
      emailSubjectTemplate: 'Thank you for your donation — Official OMP Receipt 🎉',
      pdfThankYouMessage: 'We appreciate your generous support.',
      pdfFooterNote: 'This PDF is your official donation receipt. Please retain for your records.',
      pdfSignatureName: 'The OpenmindProjects Team'
    };
    reset({
      emailSubjectTemplate: target.emailSubjectTemplate,
      pdfThankYouMessage: target.pdfThankYouMessage,
      pdfFooterNote: target.pdfFooterNote,
      pdfSignatureName: target.pdfSignatureName
    });
    setApiError('');
    setSuccessMsg('');
  }, [activeTab, settingsList]);

  // Mutation for updating/upserting active settings
  const mutation = useMutation({
    mutationFn: async (payload) => {
      return adminApi.put(`/receipt-settings/${activeTab}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-receipt-settings'] });
      setSuccessMsg('Settings saved successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Failed to save settings.');
    }
  });

  const onSubmit = (data) => {
    setApiError('');
    setSuccessMsg('');
    mutation.mutate(data);
  };

  // Helper to insert a variable chip at current cursor position
  const handleInsertChip = (chip) => {
    const el = subjectInputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const text = el.value || '';
    const updatedText = text.slice(0, start) + chip + text.slice(end);
    
    // Update react-hook-form value state
    setValue('emailSubjectTemplate', updatedText, { shouldDirty: true, shouldValidate: true });

    // Focus and restore cursor selection position asynchronously
    setTimeout(() => {
      el.focus();
      const nextPos = start + chip.length;
      el.setSelectionRange(nextPos, nextPos);
    }, 10);
  };

  // Resolve tier name for preview labels
  let previewTierName = 'One-Time Supporter';
  if (activeTab === 'RECURRING') previewTierName = 'Monthly Supporter';
  if (activeTab.startsWith('TIER_')) {
    const activeTierId = parseInt(activeTab.split('_')[1], 10);
    const tier = tiers.find(t => t.id === activeTierId);
    previewTierName = tier ? `${tier.name} Tier` : 'Supporter Tier';
  }

  // Ref register callback to hold ref and apply react-hook-form bindings together
  const { ref: registeredRef, ...subjectInputProps } = register('emailSubjectTemplate');

  if (isLoading) return <div className="admin-loading">Loading receipt templates...</div>;

  return (
    <div className="cms-section">
      <div className="cms-section__header" style={{ marginBottom: '24px' }}>
        <h2>Donation Receipts Editor</h2>
      </div>

      {apiError && <div className="cms-error-banner" style={{ marginBottom: '16px' }}>{apiError}</div>}
      {successMsg && <div className="cms-success-banner" style={{ marginBottom: '16px', background: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '10px 16px', borderRadius: 'var(--radius-sm)' }}>{successMsg}</div>}

      {/* Tabs navigation list */}
      <div className="tabs-nav" role="tablist">
        <button className={`tab-btn ${activeTab === 'GLOBAL' ? 'active' : ''}`} onClick={() => setActiveTab('GLOBAL')} role="tab" aria-selected={activeTab === 'GLOBAL'}>Global (Default)</button>
        <button className={`tab-btn ${activeTab === 'ONE_TIME' ? 'active' : ''}`} onClick={() => setActiveTab('ONE_TIME')} role="tab" aria-selected={activeTab === 'ONE_TIME'}>One-Time</button>
        <button className={`tab-btn ${activeTab === 'RECURRING' ? 'active' : ''}`} onClick={() => setActiveTab('RECURRING')} role="tab" aria-selected={activeTab === 'RECURRING'}>Monthly (Fallback)</button>
        {tiers.map(tier => (
          <button key={tier.id} className={`tab-btn ${activeTab === `TIER_${tier.id}` ? 'active' : ''}`} onClick={() => setActiveTab(`TIER_${tier.id}`)} role="tab" aria-selected={activeTab === `TIER_${tier.id}`}>{tier.name} Tier</button>
        ))}
      </div>

      <div className="receipt-settings-grid">
        {/* Editor Form Panel */}
        <form onSubmit={handleSubmit(onSubmit)} className="receipt-form-card glass">
          {activeTab !== 'GLOBAL' && !activeSettings && (
            <div className="settings-inheritance-badge">
              <span>🛈</span> Inheriting from Global Default Settings
            </div>
          )}

          <div className="cms-form__field">
            <label htmlFor="emailSubjectTemplate">Email Subject Line Template</label>
            <input
              {...subjectInputProps}
              id="emailSubjectTemplate"
              placeholder="e.g. Thank you for your support, {donorName}!"
              ref={(e) => {
                registeredRef(e);
                subjectInputRef.current = e;
              }}
            />
            {errors.emailSubjectTemplate && <span className="field-error">{errors.emailSubjectTemplate.message}</span>}

            {/* Variable chips selector */}
            <div className="variable-chips-container">
              <span className="variable-chips-label">Click placeholders to insert:</span>
              <div className="chips-list">
                {DEFAULT_CHIPS.map(chip => (
                  <button key={chip} type="button" className="var-chip" onClick={() => handleInsertChip(chip)} aria-label={`Insert placeholder ${chip}`}>{chip}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="cms-form__field">
            <label htmlFor="pdfThankYouMessage">PDF Receipt Thank-You Message</label>
            <textarea {...register('pdfThankYouMessage')} id="pdfThankYouMessage" rows={4} placeholder="Customize the header text appearing on the PDF receipt receipt..." />
            {errors.pdfThankYouMessage && <span className="field-error">{errors.pdfThankYouMessage.message}</span>}
          </div>

          <div className="cms-form__field">
            <label htmlFor="pdfFooterNote">PDF Receipt Footer Note</label>
            <input {...register('pdfFooterNote')} id="pdfFooterNote" placeholder="A green legal notice box text at the bottom..." />
            {errors.pdfFooterNote && <span className="field-error">{errors.pdfFooterNote.message}</span>}
          </div>

          <div className="cms-form__field">
            <label htmlFor="pdfSignatureName">PDF Receipt Signature Name</label>
            <input {...register('pdfSignatureName')} id="pdfSignatureName" placeholder="Signature text..." />
            {errors.pdfSignatureName && <span className="field-error">{errors.pdfSignatureName.message}</span>}
          </div>

          <div className="cms-form__actions" style={{ marginTop: '24px' }}>
            <button type="submit" className="cms-btn cms-btn--primary" style={{ width: '100%' }} disabled={isSubmitting}>
              {isSubmitting ? 'Saving changes...' : 'Save Settings Override'}
            </button>
          </div>
        </form>

        {/* Live Visual Preview column */}
        <ReceiptLivePreview
          emailSubjectTemplate={watchedFields.emailSubjectTemplate}
          pdfThankYouMessage={watchedFields.pdfThankYouMessage}
          pdfFooterNote={watchedFields.pdfFooterNote}
          pdfSignatureName={watchedFields.pdfSignatureName}
          activeTierName={previewTierName}
          isRecurring={activeTab !== 'ONE_TIME'}
        />
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { adminApi } from '../../lib/api.js';
import TipTapEditor from './TipTapEditor.jsx';
import BatchComposer from './BatchComposer.jsx';

const DEFAULT_CHIPS = ['{donorName}', '{donorEmail}', '{amount}', '{date}', '{tierName}'];

export default function TemplateManager() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showBatchSend, setShowBatchSend] = useState(false);
  const [batchTemplateId, setBatchTemplateId] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    const fileInput = document.getElementById('cert-bg-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Fetch non-archived templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const { data } = await adminApi.get('/communications/templates');
      return data;
    },
  });

  const { register, control, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: {
      name: '',
      subject: '',
      bodyHtml: '',
      fields: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'fields',
  });

  const bodyHtmlValue = watch('bodyHtml');
  const watchedFields = watch('fields');

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        name: data.name,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        pdfConfig: data.fields.length > 0 || uploadedImage ? {
          fields: data.fields,
          backgroundImage: uploadedImage,
        } : null,
      };
      return adminApi.post('/communications/templates', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setSuccessMsg('Template created successfully!');
      handleCancelEdit();
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create template.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        name: data.name,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        pdfConfig: data.fields.length > 0 || uploadedImage ? {
          fields: data.fields,
          backgroundImage: uploadedImage,
        } : null,
      };
      return adminApi.put(`/communications/templates/${editingTemplate.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setSuccessMsg('Template updated successfully!');
      handleCancelEdit();
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update template.');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id) => {
      return adminApi.delete(`/communications/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setSuccessMsg('Template archived successfully!');
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to archive template.');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id) => {
      return adminApi.delete(`/communications/templates/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setSuccessMsg('Template deleted permanently!');
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to delete template.');
    },
  });

  const onSubmit = (data) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (editingTemplate) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEditClick = (template) => {
    setEditingTemplate(template);
    setValue('name', template.name);
    setValue('subject', template.subject);
    setValue('bodyHtml', template.bodyHtml);
    setUploadedImage(template.pdfConfig?.backgroundImage || null);

    const pdfFields = template.pdfConfig?.fields || [];
    reset({
      name: template.name,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      fields: pdfFields.map((f) => ({
        type: f.type || 'text',
        x: f.x || 0,
        y: f.y || 0,
        value: f.value || '',
        fontSize: f.fontSize || 14,
        color: f.color || '#202124',
      })),
    });
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setUploadedImage(null);
    reset({
      name: '',
      subject: '',
      bodyHtml: '',
      fields: [],
    });
  };

  const handleChipClick = (chip) => {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.name === 'subject') {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd;
      const val = activeEl.value;
      const updated = val.slice(0, start) + chip + val.slice(end);
      setValue('subject', updated);
      setTimeout(() => {
        activeEl.focus();
        activeEl.setSelectionRange(start + chip.length, start + chip.length);
      }, 0);
    }
  };

  const handleOpenBatchSend = (id) => {
    setBatchTemplateId(id);
    setShowBatchSend(true);
  };

  if (isLoading) {
    return <div className="admin-loading">Loading templates...</div>;
  }

  return (
    <div className="templates-grid">
      <div>
        <h3 style={{ marginBottom: '16px' }}>Available Templates</h3>
        {errorMsg && <div className="auth-card__error" style={{ marginBottom: '16px' }}>{errorMsg}</div>}
        {successMsg && <div style={{ color: 'var(--brand-green)', marginBottom: '16px', fontWeight: 600 }}>{successMsg}</div>}

        {templates.length === 0 ? (
          <p>No email templates configured yet. Create one on the right.</p>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="template-card">
              <div>
                <strong>{t.name}</strong>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Subject: {t.subject}
                </div>
                {t.pdfConfig && (
                  <span style={{ fontSize: '11px', color: 'var(--brand-blue)', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                    📄 Includes Certificate Attachment
                  </span>
                )}
              </div>
              <div className="template-card__actions">
                <button
                  type="button"
                  onClick={() => handleOpenBatchSend(t.id)}
                  className="cms-btn cms-btn--secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  📨 Manual Dispatch
                </button>
                <button
                  type="button"
                  onClick={() => handleEditClick(t)}
                  className="cms-btn cms-btn--secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to archive this template?')) {
                      archiveMutation.mutate(t.id);
                    }
                  }}
                  className="cms-btn cms-btn--secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to permanently delete this template? All associated triggers and logs will be removed.')) {
                      deleteTemplateMutation.mutate(t.id);
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
          <h4>{editingTemplate ? 'Edit Template' : 'Create New Template'}</h4>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="auth-form__field" style={{ marginBottom: '12px' }}>
              <label htmlFor="tmpl-name">Template Name</label>
              <input
                id="tmpl-name"
                type="text"
                {...register('name', { required: true })}
                placeholder="e.g. Donation Receipt Certificate"
              />
            </div>

            <div className="auth-form__field" style={{ marginBottom: '6px' }}>
              <label htmlFor="tmpl-subject">Email Subject</label>
              <input
                id="tmpl-subject"
                type="text"
                {...register('subject', { required: true })}
                placeholder="e.g. Thank you for your donation {donorName}!"
              />
            </div>

            {/* Token helper chips */}
            <div className="variable-chips-container" style={{ marginBottom: '12px' }}>
              <span className="variable-chips-label">Click placeholders to insert (Subject Only):</span>
              <div className="chips-list">
                {DEFAULT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="var-chip"
                    onClick={() => handleChipClick(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="auth-form__field" style={{ marginBottom: '16px' }}>
              <label>Email Body (Rich HTML)</label>
              <TipTapEditor
                value={bodyHtmlValue}
                onChange={(html) => setValue('bodyHtml', html)}
              />
            </div>

            {/* Certificate layout fields configurator */}
            <div style={{ marginBottom: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
              <h5 style={{ marginBottom: '8px' }}>Certificate PDF Layout (Optional)</h5>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                Upload a background template and configure coordinates below to overlay donor variables.
              </p>

              {/* Background Image Upload Block */}
              <div className="auth-form__field" style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Certificate Background Template (Image)
                </span>
                <input
                  id="cert-bg-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="cms-btn cms-btn--secondary"
                    style={{ fontSize: '11px', padding: '6px 12px' }}
                    onClick={() => document.getElementById('cert-bg-upload').click()}
                  >
                    Select Background Image
                  </button>
                  {uploadedImage && (
                    <button
                      type="button"
                      className="cms-btn cms-btn--danger"
                      onClick={handleRemoveImage}
                      style={{ fontSize: '11px', padding: '6px 12px' }}
                    >
                      Remove Background
                    </button>
                  )}
                </div>
                {uploadedImage && (
                  <div style={{ marginTop: '10px', border: '1px dashed var(--color-border)', padding: '10px', borderRadius: '4px', textAlign: 'center', background: 'var(--color-bg-secondary)' }}>
                    <img
                      src={uploadedImage}
                      alt="Certificate Template Background"
                      style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain' }}
                    />
                  </div>
                )}
              </div>

              {/* Live Preview Canvas */}
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Live Certificate Template Preview (Landscape A4 Aspect Ratio)
                </span>
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '841.89 / 595.28',
                    background: '#ffffff',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {uploadedImage ? (
                    <>
                      <img
                        src={uploadedImage}
                        alt="Certificate Template"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        title="Remove Background Image"
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: 'rgba(239, 68, 68, 0.9)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 10px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          zIndex: 10,
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        🗑️ Delete Background
                      </button>
                    </>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: '12px', position: 'absolute', top: 0, left: 0, background: '#ffffff' }}>
                      <span style={{ opacity: 0.5 }}>Plain White PDF background</span>
                    </div>
                  )}

                  {/* Overlaid preview fields */}
                  {(watchedFields || []).map((field, idx) => {
                    const x = Number(field.x) || 0;
                    const y = Number(field.y) || 0;
                    const size = Number(field.fontSize) || 14;
                    const color = field.color || '#202124';
                    const val = field.value || '';

                    const displayVal = val
                      .replace(/{donorName}/g, 'John Donor')
                      .replace(/{donorEmail}/g, 'john.donor@example.com')
                      .replace(/{amount}/g, '$150.00')
                      .replace(/{date}/g, new Date().toLocaleDateString())
                      .replace(/{tierName}/g, 'Shareholder')
                      .replace(/{milestoneLabel}/g, 'Gold "OMP Friend"');

                    const leftPct = (x / 841.89) * 100;
                    const topPct = (y / 595.28) * 100;
                    const fontSizePct = `calc((${size} / 595.28) * 100%)`;

                    return (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          fontSize: fontSizePct,
                          color: color,
                          transform: 'translate(0, -50%)',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                          fontFamily: 'sans-serif',
                        }}
                      >
                        {displayVal || `[Field ${idx + 1}]`}
                      </div>
                    );
                  })}
                </div>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="pdf-field-row">
                  <input
                    type="text"
                    placeholder="Text / {donorName}"
                    {...register(`fields.${index}.value`)}
                    style={{ fontSize: '11px', padding: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="X"
                    {...register(`fields.${index}.x`, { valueAsNumber: true })}
                    style={{ fontSize: '11px', padding: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="Y"
                    {...register(`fields.${index}.y`, { valueAsNumber: true })}
                    style={{ fontSize: '11px', padding: '4px' }}
                  />
                  <input
                    type="number"
                    placeholder="Size"
                    {...register(`fields.${index}.fontSize`, { valueAsNumber: true })}
                    style={{ fontSize: '11px', padding: '4px' }}
                  />
                  <input
                    type="text"
                    placeholder="#color"
                    {...register(`fields.${index}.color`)}
                    style={{ fontSize: '11px', padding: '4px' }}
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="cms-btn cms-btn--danger"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                  >
                    X
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => append({ type: 'text', x: 100, y: 100, value: '', fontSize: 14, color: '#202124' })}
                className="cms-btn cms-btn--secondary"
                style={{ fontSize: '11px', marginTop: '8px' }}
              >
                + Add Text Field
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              {editingTemplate && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="cms-btn cms-btn--secondary"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="cms-btn cms-btn--primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showBatchSend && (
        <BatchComposer
          templateId={batchTemplateId}
          onClose={() => setShowBatchSend(false)}
        />
      )}
    </div>
  );
}

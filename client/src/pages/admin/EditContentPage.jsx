import { useState, useEffect } from 'react';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { adminApi, publicApi } from '../../lib/api';
import { CONTENT_KEYS } from '../../lib/contentKeys';
import { motion, AnimatePresence } from 'framer-motion';
import MarkdownHelper from '../../components/admin/MarkdownHelper';
import './EditContentPage.css';

const TABS = [
  { id: 'WELCOME', label: 'Welcome Hero', icon: '👋' },
  { id: 'ACTIVE_PROJECTS', label: 'Active Projects', icon: '📂' },
  { id: 'DONATION_BOXES', label: 'Donation Grid', icon: '🎁' },
  { id: 'DONATION_TIERS', label: 'Donation Tiers', icon: '⭐' },
  { id: 'DONATION_ROADMAP', label: 'Roadmap Track', icon: '🏆' },
  { id: 'TANGIBLE_IMPACT', label: 'Impact Targets', icon: '📊' },
  { id: 'FOOTER', label: 'Footer Settings', icon: '📝' },
];

const FIELDS_BY_SECTION = {
  WELCOME: [
    {
      key: CONTENT_KEYS.WELCOME_HEADLINE,
      label: 'Welcome Headline',
      description: 'The main hero headline at the top of the landing page. Wrap text in formatting markers (e.g. **text** for gradient) to apply styles.',
      rows: 2,
    },
    {
      key: CONTENT_KEYS.WELCOME_SUBHEADLINE,
      label: 'Welcome Subheadline',
      description: 'The subtitle copy introducing the monthly donation impact.',
      rows: 2,
    },
    {
      key: CONTENT_KEYS.WELCOME_HERO_INTRO,
      label: 'Mission Overview Paragraph',
      description: 'Detailed introductory text rendered inside our "Our Mission" section.',
      rows: 6,
    },
  ],
  ACTIVE_PROJECTS: [
    {
      key: CONTENT_KEYS.PROJECTS_LABEL,
      label: 'Projects Section Label',
      description: 'The small label above the projects heading. Supports formatting style markers.',
      placeholder: 'e.g. Where Your **Money** Goes',
      rows: 1,
    },
    {
      key: CONTENT_KEYS.PROJECTS_TITLE,
      label: 'Projects Section Title',
      description: 'Main heading above the active projects carousel. Supports all formatting styles.',
      rows: 2,
    },
    {
      key: CONTENT_KEYS.PROJECTS_INTRO,
      label: 'Projects Section Explanation',
      description: 'Paragraph explaining how projects are funded and how progress is tracked.',
      rows: 4,
    },
  ],
  DONATION_BOXES: [
    {
      key: CONTENT_KEYS.BOXES_LABEL,
      label: 'Donation Grid Label',
      description: 'The small label above the donation boxes heading. Supports formatting style markers.',
      placeholder: 'e.g. Make an **Impact**',
      rows: 1,
    },
    {
      key: CONTENT_KEYS.BOXES_TITLE,
      label: 'Donation Grid Title',
      description: 'Main heading above the donation boxes. Supports all formatting styles.',
      rows: 2,
    },
    {
      key: CONTENT_KEYS.BOXES_CTA,
      label: 'Donation Grid Call-To-Action',
      description: 'Main paragraph guiding users to choose a plan.',
      rows: 4,
    },
  ],
  DONATION_TIERS: [
    {
      key: CONTENT_KEYS.TIERS_LABEL,
      label: 'Tiers Section Label',
      description: 'The small label above the donation tiers heading. Supports formatting style markers.',
      placeholder: 'e.g. Your **Benefits**',
      rows: 1,
    },
    {
      key: CONTENT_KEYS.TIERS_TITLE,
      label: 'Tiers Section Title',
      description: 'Heading for the monthly subscription benefit levels. Supports all formatting styles.',
      rows: 2,
    },
    {
      key: CONTENT_KEYS.TIERS_INTRO,
      label: 'Tiers Section Explanation',
      description: 'General description highlighting benefits and connection to the mission.',
      rows: 4,
    },
  ],
  DONATION_ROADMAP: [
    {
      key: CONTENT_KEYS.ROADMAP_LABEL,
      label: 'Roadmap Track Label',
      description: 'The small label above the roadmap track heading. Supports formatting style markers.',
      placeholder: 'e.g. Monthly **Rewards**',
      rows: 1,
    },
    {
      key: CONTENT_KEYS.ROADMAP_TITLE,
      label: 'Roadmap Track Title',
      description: 'Heading for monthly milestones and rewards. Supports all formatting styles.',
      rows: 2,
    },
    {
      key: CONTENT_KEYS.ROADMAP_INTRO,
      label: 'Roadmap Track Explanation',
      description: 'Description detail of how milestones and donor status works.',
      rows: 4,
    },
  ],
  TANGIBLE_IMPACT: [
    {
      key: CONTENT_KEYS.IMPACT_LABEL,
      label: 'Impact Section Label',
      description: 'The small label above the impact section heading. Supports formatting style markers.',
      placeholder: 'e.g. One-Time **Objectives**',
      rows: 1,
    },
    {
      key: CONTENT_KEYS.IMPACT_TITLE,
      label: 'Impact Section Title',
      description: 'Heading for repeatable objectives. Supports all formatting styles.',
      rows: 2,
    },
    {
      key: CONTENT_KEYS.IMPACT_INTRO,
      label: 'Impact Section Explanation',
      description: 'Copy outlining metrics achieved by one-time donations.',
      rows: 4,
    },
  ],
  FOOTER: [
    {
      key: CONTENT_KEYS.FOOTER_BRAND_NAME,
      label: 'Brand Name',
      description: 'The primary brand name displayed in the footer. Supports formatting styles.',
      placeholder: 'e.g. OpenmindProjects',
      rows: 1,
    },
    {
      key: CONTENT_KEYS.FOOTER_BRAND_DESC,
      label: 'Brand Description',
      description: 'The short paragraph text underneath the brand name.',
      rows: 3,
    },
    {
      key: CONTENT_KEYS.FOOTER_TAGLINE,
      label: 'Footer Tagline',
      description: 'The short tagline displayed above or next to copyright info.',
      rows: 2,
    },
  ],
};

/**
 * Standard form textarea input mapper.
 */
function FormField({ field }) {
  const { register } = useFormContext();
  
  return (
    <div className="form-group">
      <label className="form-label">
        {field.label}
        <span className="form-key">({field.key})</span>
      </label>
      <p className="field-hint">{field.description}</p>
      <textarea
        className="form-textarea"
        rows={field.rows}
        placeholder={field.placeholder || `Input markdown formatted copy for ${field.label}...`}
        {...register(field.key, { required: 'This field is required' })}
      />
    </div>
  );
}

/**
 * EditContentPage — Structured tab layout to manage page content fragments.
 * 
 * Why react-hook-form? Manages the global state of all fields across tabs seamlessly
 * while preventing unnecessary re-renders.
 * Why isDirty confirmations? Tab changes are intercepted to prevent accidental loss
 * of uncommitted edits.
 * Why beforeunload listener? Prevents users from accidentally reloading or closing the tab 
 * when the form state is unsaved.
 * 
 * @returns {JSX.Element}
 */
export default function EditContentPage() {
  const [activeTab, setActiveTab] = useState('WELCOME');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  const methods = useForm({
    defaultValues: {},
    mode: 'onChange',
  });

  const { reset, handleSubmit, formState } = methods;
  const { isDirty } = formState;

  // 1. Hydrate content copy on mount
  useEffect(() => {
    const loadContent = async () => {
      try {
        const { data } = await publicApi.get('/content/site-text');
        
        // Populate default fallbacks if database lacks fields
        const hydratedValues = {};
        Object.values(CONTENT_KEYS).forEach((k) => {
          hydratedValues[k] = data[k] || '';
        });

        reset(hydratedValues);
      } catch (error) {
        console.error('Failed to load copy details:', error);
        setAlert({ type: 'error', text: 'Error fetching copy data from the server.' });
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [reset]);

  // 2. Prevent accidental tab closures / page leaves when form is dirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved website copy modifications. Are you sure you want to exit?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  /**
   * Safe tab toggle click interceptor.
   * 
   * Why intercept? Prevents active input changes from being lost since form state 
   * spans across all tabs.
   * 
   * @param {string} targetTabId - Destination section tab ID.
   */
  const handleTabClick = (targetTabId) => {
    if (targetTabId === activeTab) return;

    if (isDirty) {
      const confirmSwitch = window.confirm(
        'Warning: You have unsaved changes in your form. Switching sections now will retain your edits in memory, but you must click "Save Changes" before leaving this page to record them permanently.\n\nSwitch tab?'
      );
      if (!confirmSwitch) return;
    }

    setActiveTab(targetTabId);
  };

  /**
   * Submits the aggregated form data to the server in a single batch.
   * 
   * @param {Object} data - Form data validated by react-hook-form.
   */
  const onSubmit = async (data) => {
    setSaving(true);
    setAlert(null);

    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== '')
    );

    try {
      await adminApi.put('/content/site-text', cleanedData);
      
      // Reset dirty state to current values
      reset(data);
      
      setAlert({ type: 'success', text: 'All page copy fragments updated successfully!' });
      setTimeout(() => setAlert(null), 4000);
    } catch (error) {
      console.error('Batch save content failed:', error);
      setAlert({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update copy. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page-loader">
        <span className="auth-form__spinner" />
        <p>Retrieving site copy keys...</p>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="edit-content-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Manage Page Copy</h1>
            <p className="page-subtitle">Update core section titles, introductory content, and explanatory copy. All fields support Markdown.</p>
          </div>
        </div>

        {alert && (
          <motion.div 
            className={`alert alert--${alert.type}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {alert.type === 'success' ? '✅' : '❌'} {alert.text}
          </motion.div>
        )}

        {/* Tab Navigator */}
        <div className="tabs-bar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`tab-btn ${isActive ? 'tab-btn--active' : ''}`}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="content-form">
          <div className="workspace-container">
            {/* Form Fields Workspace */}
            <div className="fields-workspace">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                  className="fields-card"
                >
                  <h2 className="fields-card__title">
                    {TABS.find((t) => t.id === activeTab)?.label} Settings
                  </h2>
                  <div className="fields-list">
                    {FIELDS_BY_SECTION[activeTab].map((field) => (
                      <FormField key={field.key} field={field} />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Sidebar Markdown Guide */}
            <div className="sidebar-workspace">
              <MarkdownHelper />
            </div>
          </div>

          <div className="form-actions">
            {isDirty && <span className="dirty-badge">⚠️ You have unsaved changes</span>}
            <button 
              type="submit" 
              className="save-btn" 
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="btn-spinner" />
                  Saving Changes...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}

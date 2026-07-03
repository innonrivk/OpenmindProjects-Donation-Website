import { useState } from 'react';
import { motion } from 'framer-motion';
import TemplateManager from './TemplateManager.jsx';
import AutomationConfigurator from './AutomationConfigurator.jsx';
import DispatchLogViewer from './DispatchLogViewer.jsx';
import './CommunicationHub.css';

/**
 * CommunicationHub — Master administration hub for templates, automation rules, and batch dispatch logs.
 *
 * Why? Provides operations admins with a unified command center to construct, test, and monitor
 * automatic notification triggers and manual updates.
 */
export default function CommunicationHub() {
  const [activeTab, setActiveTab] = useState('TEMPLATES'); // 'TEMPLATES' | 'AUTOMATIONS' | 'LOGS'

  return (
    <div className="cms-section">
      <div className="cms-section__header" style={{ marginBottom: '16px', borderBottom: 'none' }}>
        <h2>Communications &amp; Automation Hub</h2>
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
          onClick={() => setActiveTab('TEMPLATES')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'TEMPLATES' ? '2px solid var(--brand-blue)' : '2px solid transparent',
            color: activeTab === 'TEMPLATES' ? 'var(--brand-blue)' : 'var(--color-text-secondary)',
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Templates
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('AUTOMATIONS')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'AUTOMATIONS' ? '2px solid var(--brand-blue)' : '2px solid transparent',
            color: activeTab === 'AUTOMATIONS' ? 'var(--brand-blue)' : 'var(--color-text-secondary)',
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Automation Rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('LOGS')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'LOGS' ? '2px solid var(--brand-blue)' : '2px solid transparent',
            color: activeTab === 'LOGS' ? 'var(--brand-blue)' : 'var(--color-text-secondary)',
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Dispatch Logs
        </button>
      </div>

      {/* Conditionally Render Active Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'TEMPLATES' && <TemplateManager />}
        {activeTab === 'AUTOMATIONS' && <AutomationConfigurator />}
        {activeTab === 'LOGS' && <DispatchLogViewer />}
      </motion.div>
    </div>
  );
}

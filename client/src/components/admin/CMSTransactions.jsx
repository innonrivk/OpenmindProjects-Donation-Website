import { useState } from 'react';
import LedgerTab from './LedgerTab.jsx';
import AnalyticsTab from './AnalyticsTab.jsx';

/**
 * Helper to convert a Date object to local YYYY-MM-DD string format.
 *
 * @param {Date} date
 * @returns {string} Formatted local date.
 */
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * CMSTransactions — Auditing and trends portal for administrator review.
 *
 * Why? Provides the shell interface that integrates a detailed transactional
 * ledger with a high-level analytics line graph. State is lifted up here
 * to support drill-down filtering: clicking a chart node modifies ledger
 * filters and brings the user back to the ledger view seamlessly.
 */
export default function CMSTransactions() {
  const [activeTab, setActiveTab] = useState('LEDGER'); // 'LEDGER' | 'ANALYTICS'

  // Lifted filter states shared with LedgerTab so that Analytics drill-down works
  const [filterMode, setFilterMode] = useState('ALL');
  const [inputStartDate, setInputStartDate] = useState('');
  const [inputEndDate, setInputEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState(null);
  const [appliedEndDate, setAppliedEndDate] = useState(null);
  const [donationType, setDonationType] = useState('ALL');
  const [tierId, setTierId] = useState('ALL');

  /**
   * Action handler called when a user clicks a line node on the analytics chart.
   * Modifies the shared filter variables to reflect the clicked period and
   * switches the active view back to the Detailed Ledger.
   *
   * @param {object} params
   * @param {string} params.start - ISO date string of period start.
   * @param {string} params.end - ISO date string of period end.
   * @param {string} params.label - Display label of clicked node.
   */
  const handleDrillDown = ({ start, end, donationType: chartDonationType, tierId: chartTierId }) => {
    setAppliedStartDate(start);
    setAppliedEndDate(end);

    // Synchronize inputs so the ledger date filter forms visually align
    const startObj = new Date(start);
    const endObj = new Date(end);
    setInputStartDate(formatLocalDate(startObj));
    setInputEndDate(formatLocalDate(endObj));

    setFilterMode('CUSTOM');
    if (chartDonationType) setDonationType(chartDonationType);
    if (chartTierId) setTierId(chartTierId);
    
    setActiveTab('LEDGER');
  };

  return (
    <div className="cms-section">
      <div className="cms-section__header" style={{ marginBottom: '16px', borderBottom: 'none' }}>
        <h2>Donation Activity &amp; Ledger</h2>
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
          onClick={() => setActiveTab('LEDGER')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'LEDGER' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
            color: activeTab === 'LEDGER' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ANALYTICS')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ANALYTICS' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
            color: activeTab === 'ANALYTICS' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Analytics
        </button>
      </div>

      {/* Conditionally Render Active Tab content */}
      {activeTab === 'LEDGER' ? (
        <LedgerTab
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          donationType={donationType}
          setDonationType={setDonationType}
          inputStartDate={inputStartDate}
          setInputStartDate={setInputStartDate}
          inputEndDate={inputEndDate}
          setInputEndDate={setInputEndDate}
          appliedStartDate={appliedStartDate}
          setAppliedStartDate={setAppliedStartDate}
          appliedEndDate={appliedEndDate}
          setAppliedEndDate={setAppliedEndDate}
          tierId={tierId}
          setTierId={setTierId}
        />
      ) : (
        <AnalyticsTab onDrillDown={handleDrillDown} />
      )}
    </div>
  );
}

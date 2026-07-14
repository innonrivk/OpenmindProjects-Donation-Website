import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api.js';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import TransactionRow from './TransactionRow.jsx';
import TransactionFilters from './TransactionFilters.jsx';

/**
 * Resolves a filterMode + optional custom dates into ISO start/end strings.
 *
 * @param {'ALL'|'LAST_MONTH'|'LAST_3_MONTHS'|'LAST_6_MONTHS'|'LAST_YEAR'|'CUSTOM'} mode
 * @param {string|null} start
 * @param {string|null} end
 * @returns {{ startISO: string|null, endISO: string|null }}
 */
function resolveDateRange(mode, start = null, end = null) {
  const now = new Date();

  if (mode === 'LAST_MONTH') {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 1);
    return { startISO: from.toISOString(), endISO: now.toISOString() };
  }
  if (mode === 'LAST_3_MONTHS') {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 3);
    return { startISO: from.toISOString(), endISO: now.toISOString() };
  }
  if (mode === 'LAST_6_MONTHS') {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 6);
    return { startISO: from.toISOString(), endISO: now.toISOString() };
  }
  if (mode === 'LAST_YEAR') {
    const from = new Date(now);
    from.setFullYear(from.getFullYear() - 1);
    return { startISO: from.toISOString(), endISO: now.toISOString() };
  }
  if (mode === 'CUSTOM' && start && end) {
    return { startISO: new Date(start).toISOString(), endISO: new Date(end).toISOString() };
  }
  return { startISO: null, endISO: null };
}

/**
 * LedgerTab Component — Renders the metrics cards and transactional audit ledger.
 *
 * Why? Separating the tabular log views from analytics trend views limits file lines
 * and ensures queries for large ledger pages only fire when this tab is actively mounted.
 */
export default function LedgerTab({
  filterMode,
  setFilterMode,
  donationType,
  setDonationType,
  inputStartDate,
  setInputStartDate,
  inputEndDate,
  setInputEndDate,
  appliedStartDate,
  setAppliedStartDate,
  appliedEndDate,
  setAppliedEndDate,
  tierId,
  setTierId,
}) {
  const { token } = useAdminAuth();
  const isFiltered = !!(appliedStartDate || appliedEndDate);
  const [isExporting, setIsExporting] = useState(false);
  const [showLimitWarning, setShowLimitWarning] = useState(false);

  const handleModeChange = (mode) => {
    setFilterMode(mode);
    if (mode !== 'CUSTOM') {
      const { startISO, endISO } = resolveDateRange(mode);
      setAppliedStartDate(startISO);
      setAppliedEndDate(endISO);
      setInputStartDate('');
      setInputEndDate('');
    }
  };

  const handleApplyCustom = () => {
    const { startISO, endISO } = resolveDateRange('CUSTOM', inputStartDate, inputEndDate);
    setAppliedStartDate(startISO);
    setAppliedEndDate(endISO);
  };

  const handleDonationTypeChange = (type) => {
    setDonationType(type);
    if (type === 'ONE_TIME' && tierId !== 'ALL') {
      setTierId('ALL');
    }
  };

  const handleTierChange = (newTierId) => {
    setTierId(newTierId);
    if (newTierId !== 'ALL') {
      setDonationType('ALL');
    }
  };

  const buildParams = (base = {}) => {
    const params = new URLSearchParams(base);
    if (appliedStartDate) params.set('start_date', appliedStartDate);
    if (appliedEndDate) params.set('end_date', appliedEndDate);
    if (donationType !== 'ALL') params.set('donation_type', donationType);
    if (tierId !== 'ALL') params.set('tierId', tierId);
    return params.toString();
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      setShowLimitWarning(false);

      const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
      const url = `${apiBase}/admin/transactions/export?${buildParams()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`Export request failed: ${response.statusText}`);
      }

      const limitHit = response.headers.get('x-export-limit-hit') === 'true';
      if (limitHit) {
        setShowLimitWarning(true);
      }

      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'Transactions_Export.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'Excel Spreadsheet',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
              }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (saveError) {
          // Handle user cancelling the dialog (AbortError) silently.
          if (saveError.name !== 'AbortError') {
            throw saveError;
          }
        }
      } else {
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
      }
    } catch (error) {
      console.error('Error exporting transactions:', error);
      alert('Failed to export transactions. Please check logs and try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const { data: metrics = {}, isLoading: loadingMetrics } = useQuery({
    queryKey: ['admin-metrics', appliedStartDate, appliedEndDate, donationType, tierId],
    queryFn: async () => {
      const { data } = await adminApi.get(`/transactions/metrics?${buildParams()}`);
      return data;
    },
  });

  const { data: logData = {}, isLoading: loadingLogs } = useQuery({
    queryKey: ['admin-transactions', appliedStartDate, appliedEndDate, donationType, tierId],
    queryFn: async () => {
      const { data } = await adminApi.get(`/transactions?${buildParams({ limit: 25 })}`);
      return data;
    },
  });

  const transactions = logData.transactions || [];

  if (loadingMetrics || loadingLogs) {
    return <div className="admin-loading">Loading transaction records...</div>;
  }

  const cards = [
    {
      title: 'Total Donated',
      value: `$${((metrics.totalDonatedCents || 0) / 100).toLocaleString()}`,
      desc: tierId !== 'ALL'
        ? 'Filtered by active tier'
        : isFiltered ? 'Filtered by date range' : 'Gross receipts',
      isFiltered: isFiltered || tierId !== 'ALL',
    },
    {
      title: 'Total Registered Donors',
      value: metrics.totalDonors || 0,
      desc: tierId !== 'ALL'
        ? 'Filtered by active tier'
        : isFiltered ? 'Filtered by date range' : 'Registered supporters',
      isFiltered: isFiltered || tierId !== 'ALL',
    },
    {
      title: 'Active Subscribers',
      value: donationType === 'ONE_TIME' ? 0 : (metrics.activeSubscribers || 0),
      desc: donationType === 'ONE_TIME'
        ? 'N/A — One-time filter active'
        : tierId !== 'ALL'
          ? 'Filtered by active tier'
          : isFiltered ? 'All-time (unfiltered)' : 'Recurring monthly',
      isFiltered: tierId !== 'ALL',
    },
    {
      title: 'Monthly Projected (MRR)',
      value: donationType === 'ONE_TIME'
        ? '$0'
        : `$${(metrics.projectedMrrUsd || 0).toLocaleString()}`,
      desc: donationType === 'ONE_TIME'
        ? 'N/A — One-time filter active'
        : tierId !== 'ALL'
          ? 'Filtered by active tier'
          : isFiltered ? 'All-time (unfiltered)' : 'Active subscriptions',
      isFiltered: tierId !== 'ALL',
    },
  ];

  const filterLabels = {
    LAST_MONTH: 'Last Month',
    LAST_3_MONTHS: 'Last 3 Months',
    LAST_6_MONTHS: 'Last 6 Months',
    LAST_YEAR: 'Last Year',
    CUSTOM: `${inputStartDate || '?'} → ${inputEndDate || '?'}`,
  };

  return (
    <>
      <TransactionFilters
        filterMode={filterMode}
        donationType={donationType}
        inputStartDate={inputStartDate}
        inputEndDate={inputEndDate}
        onModeChange={handleModeChange}
        onDonationTypeChange={handleDonationTypeChange}
        onStartChange={setInputStartDate}
        onEndChange={setInputEndDate}
        onApply={handleApplyCustom}
        tierId={tierId}
        onTierChange={handleTierChange}
      />

      {(isFiltered && filterMode !== 'ALL' || donationType !== 'ALL' || tierId !== 'ALL') && (
        <div className="tx-filter-badge">
          {filterMode !== 'ALL' && (
            <>📅 <strong>{filterLabels[filterMode] ?? 'Filtered'}</strong></>
          )}
          {filterMode !== 'ALL' && (donationType !== 'ALL' || tierId !== 'ALL') && (
            <span> · </span>
          )}
          {donationType !== 'ALL' && (
            <>🏷️ <strong>{donationType === 'MONTHLY' ? 'Monthly Only' : 'One-Time Only'}</strong></>
          )}
          {donationType !== 'ALL' && tierId !== 'ALL' && (
            <span> · </span>
          )}
          {tierId !== 'ALL' && (
            <>⭐ <strong>Tier Filtered</strong></>
          )}
        </div>
      )}

      <div className="metrics-grid" style={{ marginTop: '20px' }}>
        {cards.map((card, i) => (
          <div key={i} className="metric-card glass">
            <span className="metric-card__title">{card.title}</span>
            <span className="metric-card__value gradient-text">{card.value}</span>
            <span
              className={`metric-card__desc${card.isFiltered && isFiltered ? ' metric-card__desc--filtered' : ''}`}
            >
              {card.desc}
            </span>
          </div>
        ))}
      </div>

      {showLimitWarning && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid #f59e0b',
          color: '#b45309',
          padding: '12px 16px',
          borderRadius: '8px',
          marginTop: '24px',
          fontSize: '13px',
          fontWeight: '500',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ <strong>Export Limit Reached:</strong> Only the first 10,000 transaction records are included in this download. To retrieve older records, please filter by a specific date range, donation type, or tier.</span>
          <button 
            onClick={() => setShowLimitWarning(false)} 
            style={{
              background: 'none',
              border: 'none',
              color: '#b45309',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: 'bold',
              paddingLeft: '12px',
              lineHeight: 1
            }}
            type="button"
          >
            &times;
          </button>
        </div>
      )}

      <div className="cms-table-container" style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>
            {isFiltered ? 'Filtered Transactions' : 'Recent Transactions'}
            {logData.pagination && (
              <span className="tx-pagination-info">
                {' '}({logData.pagination.totalCount} total)
              </span>
            )}
          </h3>
          <button
            type="button"
            data-testid="export-excel-btn"
            className="cms-btn cms-btn--secondary"
            onClick={handleExportExcel}
            disabled={isExporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--font-size-xs)'
            }}
          >
            {isExporting ? (
              <>
                <span className="spinner" style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid currentColor',
                  borderRightColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                Exporting...
              </>
            ) : (
              <>
                📊 Export list to Excel
              </>
            )}
          </button>
        </div>
        <table className="cms-table">
          <thead>
            <tr>
              <th>Invoice/PI ID</th>
              <th>Donor</th>
              <th>Email</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Type</th>
              <th>Subject</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length > 0 ? (
              transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                  No transactions found for this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api.js';
import TransactionRow from './TransactionRow.jsx';
import TransactionFilters from './TransactionFilters.jsx';

/**
 * Resolves a filterMode + optional custom dates into ISO start/end strings.
 *
 * @param {'ALL'|'LAST_MONTH'|'LAST_YEAR'|'CUSTOM'} mode
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
}) {
  const isFiltered = !!(appliedStartDate || appliedEndDate);

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

  const buildParams = (base = {}) => {
    const params = new URLSearchParams(base);
    if (appliedStartDate) params.set('start_date', appliedStartDate);
    if (appliedEndDate) params.set('end_date', appliedEndDate);
    if (donationType !== 'ALL') params.set('donation_type', donationType);
    return params.toString();
  };

  const { data: metrics = {}, isLoading: loadingMetrics } = useQuery({
    queryKey: ['admin-metrics', appliedStartDate, appliedEndDate, donationType],
    queryFn: async () => {
      const { data } = await adminApi.get(`/transactions/metrics?${buildParams()}`);
      return data;
    },
  });

  const { data: logData = {}, isLoading: loadingLogs } = useQuery({
    queryKey: ['admin-transactions', appliedStartDate, appliedEndDate, donationType],
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
      desc: isFiltered ? 'Filtered by date range' : 'Gross receipts',
      isFiltered,
    },
    {
      title: 'Total Registered Donors',
      value: metrics.totalDonors || 0,
      desc: isFiltered ? 'Filtered by date range' : 'Registered supporters',
      isFiltered,
    },
    {
      title: 'Active Subscribers',
      value: donationType === 'ONE_TIME' ? 0 : (metrics.activeSubscribers || 0),
      desc: donationType === 'ONE_TIME'
        ? 'N/A — One-time filter active'
        : isFiltered ? 'All-time (unfiltered)' : 'Recurring monthly',
      isFiltered: false,
    },
    {
      title: 'Monthly Projected (MRR)',
      value: donationType === 'ONE_TIME'
        ? '$0'
        : `$${(metrics.projectedMrrUsd || 0).toLocaleString()}`,
      desc: donationType === 'ONE_TIME'
        ? 'N/A — One-time filter active'
        : isFiltered ? 'All-time (unfiltered)' : 'Active subscriptions',
      isFiltered: false,
    },
  ];

  const filterLabels = {
    LAST_MONTH: 'Last Month',
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
        onDonationTypeChange={setDonationType}
        onStartChange={setInputStartDate}
        onEndChange={setInputEndDate}
        onApply={handleApplyCustom}
      />

      {(isFiltered && filterMode !== 'ALL' || donationType !== 'ALL') && (
        <div className="tx-filter-badge">
          {filterMode !== 'ALL' && (
            <>📅 <strong>{filterLabels[filterMode] ?? 'Filtered'}</strong></>
          )}
          {filterMode !== 'ALL' && donationType !== 'ALL' && (
            <span> · </span>
          )}
          {donationType !== 'ALL' && (
            <>🏷️ <strong>{donationType === 'MONTHLY' ? 'Monthly Only' : 'One-Time Only'}</strong></>
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

      <div className="cms-table-container" style={{ marginTop: '32px' }}>
        <h3>
          {isFiltered ? 'Filtered Transactions' : 'Recent Transactions'}
          {logData.pagination && (
            <span className="tx-pagination-info">
              {' '}({logData.pagination.totalCount} total)
            </span>
          )}
        </h3>
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

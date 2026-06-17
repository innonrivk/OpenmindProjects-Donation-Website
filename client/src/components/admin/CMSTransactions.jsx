import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import TransactionRow from './TransactionRow';

/**
 * CMSTransactions — Auditing interface displaying live donor stats and logs.
 */
export default function CMSTransactions() {
  // 1. Fetch metrics
  const { data: metrics = {}, isLoading: loadingMetrics } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const { data } = await adminApi.get('/transactions/metrics');
      return data;
    },
  });

  // 2. Fetch transaction logs
  const { data: logData = {}, isLoading: loadingLogs } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
      const { data } = await adminApi.get('/transactions?limit=25');
      return data;
    },
  });

  const transactions = logData.transactions || [];

  if (loadingMetrics || loadingLogs) {
    return <div className="admin-loading">Loading transaction records...</div>;
  }

  const cards = [
    { title: 'Total Donated', value: `$${((metrics.totalDonatedCents || 0) / 100).toLocaleString()}`, desc: 'Gross receipts' },
    { title: 'Total Registered Donors', value: metrics.totalDonors || 0, desc: 'Registered supporters' },
    { title: 'Active Subscribers', value: metrics.activeSubscribers || 0, desc: 'Recurring monthly' },
    { title: 'Monthly Projected (MRR)', value: `$${(metrics.projectedMrrUsd || 0).toLocaleString()}`, desc: 'Active subscriptions' },
  ];

  return (
    <div className="cms-section">
      <div className="cms-section__header" style={{ marginBottom: '24px' }}>
        <h2>Donation Activity & Ledger</h2>
      </div>

      <div className="metrics-grid">
        {cards.map((card, i) => (
          <div key={i} className="metric-card glass">
            <span className="metric-card__title">{card.title}</span>
            <span className="metric-card__value gradient-text">{card.value}</span>
            <span className="metric-card__desc">{card.desc}</span>
          </div>
        ))}
      </div>

      <div className="cms-table-container" style={{ marginTop: '32px' }}>
        <h3>Recent Transactions</h3>
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
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { adminApi } from '../../lib/api.js';
import { Line } from 'react-chartjs-2';
import {
  backgroundPlugin,
  datalabelsPlugin,
  getChartData,
  getChartOptions,
} from './analyticsConfig.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * AnalyticsTab Component — Renders historical donation trends in a Chart.js Line chart.
 *
 * Why? Provides administrators with visual insight into recurring vs one-time donation
 * trajectories. Supports toggling views, exporting Excel sheets, and downloading the chart as a photo.
 *
 * @param {object} props - Component props.
 * @param {function} props.onDrillDown - Callback triggered on data point clicks.
 */
export default function AnalyticsTab({ onDrillDown }) {
  const [view, setView] = useState('MONTHLY'); // 'MONTHLY' | 'YEARLY'

  const { data: analytics = { monthly: [], yearly: [] }, isLoading } = useQuery({
    queryKey: ['admin-analytics-donations'],
    queryFn: async () => {
      const { data } = await adminApi.get('/transactions/analytics/donations');
      return data;
    },
  });

  if (isLoading) {
    return <div className="admin-loading">Loading donation analytics...</div>;
  }

  const activeSeries = view === 'MONTHLY' ? analytics.monthly : analytics.yearly;
  const labels = activeSeries.map((item) => item.period);
  const monthlyAmounts = activeSeries.map((item) => item.monthly);
  const oneTimeAmounts = activeSeries.map((item) => item.oneTime);

  const chartData = getChartData(labels, monthlyAmounts, oneTimeAmounts);
  const options = getChartOptions(onDrillDown, monthlyAmounts, oneTimeAmounts);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Donation Trends</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* View Toggles */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              padding: '3px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <button
              type="button"
              onClick={() => setView('MONTHLY')}
              style={{
                border: 'none',
                background: view === 'MONTHLY' ? 'var(--color-accent-gradient)' : 'transparent',
                color: view === 'MONTHLY' ? 'var(--color-text-on-accent)' : 'var(--color-text-secondary)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Last 12 Months
            </button>
            <button
              type="button"
              onClick={() => setView('YEARLY')}
              style={{
                border: 'none',
                background: view === 'YEARLY' ? 'var(--color-accent-gradient)' : 'transparent',
                color: view === 'YEARLY' ? 'var(--color-text-on-accent)' : 'var(--color-text-secondary)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Last 10 Years
            </button>
          </div>
        </div>
      </div>

      <div
        className="glass"
        style={{
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-card)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ position: 'relative', height: '400px', width: '100%' }}>
          <Line
            data={chartData}
            options={options}
            plugins={[backgroundPlugin, datalabelsPlugin]}
          />
        </div>
        <div
          style={{
            marginTop: '16px',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          💡 Tip: Click any data point on the chart lines to filter and inspect detailed ledger transactions for that period.
        </div>
      </div>
    </motion.div>
  );
}

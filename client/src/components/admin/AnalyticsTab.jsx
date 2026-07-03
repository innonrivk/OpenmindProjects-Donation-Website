import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { adminApi } from '../../lib/api.js';
import { Line } from 'react-chartjs-2';
import AnalyticsFilters from './AnalyticsFilters.jsx';
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
 * Resolves a filterMode into start/end ISO date strings.
 */
function resolveDateRange(mode, start = null, end = null) {
  const now = new Date();
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
  if (mode === 'LAST_10_YEARS') {
    const from = new Date(now);
    from.setFullYear(from.getFullYear() - 10);
    return { startISO: from.toISOString(), endISO: now.toISOString() };
  }
  if (mode === 'CUSTOM' && start && end) {
    return { startISO: new Date(start).toISOString(), endISO: new Date(end).toISOString() };
  }
  return { startISO: null, endISO: null };
}

/**
 * AnalyticsTab Component — Renders historical donation trends in a Chart.js Line chart.
 *
 * Why? Provides administrators with visual insight into recurring vs one-time donation
 * trajectories. Supports dynamic filters, custom dates, and download functions.
 *
 * @param {object} props - Component props.
 * @param {function} props.onDrillDown - Callback triggered on data point clicks.
 */
export default function AnalyticsTab({ onDrillDown }) {
  const [filterMode, setFilterMode] = useState('ALL');
  const [donationType, setDonationType] = useState('ALL');
  const [tierId, setTierId] = useState('ALL');

  const [inputStartDate, setInputStartDate] = useState('');
  const [inputEndDate, setInputEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState(null);
  const [appliedEndDate, setAppliedEndDate] = useState(null);

  const [showMonthly, setShowMonthly] = useState(true);
  const [showOneTime, setShowOneTime] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const chartRef = useRef(null);

  // Sync line visibility with donation type filter selection
  useEffect(() => {
    if (donationType === 'MONTHLY') {
      setShowMonthly(true);
      setShowOneTime(false);
    } else if (donationType === 'ONE_TIME') {
      setShowMonthly(false);
      setShowOneTime(true);
    } else {
      setShowMonthly(true);
      setShowOneTime(true);
    }
  }, [donationType]);

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

  const handleDownloadChart = async () => {
    try {
      if (!chartRef.current) {
        alert('Chart is not ready. Please try again.');
        return;
      }
      setIsDownloading(true);

      const dataUrl = chartRef.current.toBase64Image();
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      
      const granularityLabel = (analytics.granularity || 'monthly').toLowerCase();
      const filename = `donation_chart_${granularityLabel}.png`;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'PNG Image',
              accept: { 'image/png': ['.png'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (saveError) {
          if (saveError.name !== 'AbortError') throw saveError;
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
      console.error('Error downloading chart:', error);
      alert('Failed to download chart image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const { data: analytics = { series: [], granularity: 'monthly' }, isLoading } = useQuery({
    queryKey: ['admin-analytics-donations', appliedStartDate, appliedEndDate, donationType, tierId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedStartDate) params.set('start_date', appliedStartDate);
      if (appliedEndDate) params.set('end_date', appliedEndDate);
      if (donationType !== 'ALL') params.set('donation_type', donationType);
      if (tierId !== 'ALL') params.set('tierId', tierId);
      const { data } = await adminApi.get(`/transactions/analytics/donations?${params.toString()}`);
      return data;
    },
  });

  if (isLoading) {
    return <div className="admin-loading">Loading donation analytics...</div>;
  }

  const activeSeries = analytics.series || [];
  const labels = activeSeries.map((item) => item.period);
  const monthlyAmounts = activeSeries.map((item) => item.monthly);
  const oneTimeAmounts = activeSeries.map((item) => item.oneTime);

  const chartData = getChartData(labels, monthlyAmounts, oneTimeAmounts, showMonthly, showOneTime);

  const handleChartDrillDown = (drillData) => {
    onDrillDown({
      ...drillData,
      donationType,
      tierId
    });
  };

  const options = getChartOptions(
    handleChartDrillDown,
    analytics.granularity || 'monthly',
    showMonthly ? monthlyAmounts : [],
    showOneTime ? oneTimeAmounts : []
  );

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
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Donation Trends</h3>
          {/* Series visibility toggles */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowMonthly((v) => !v)}
              title={showMonthly ? 'Hide monthly donations line' : 'Show monthly donations line'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '999px',
                border: `1.5px solid #4285f4`,
                background: showMonthly ? '#4285f4' : 'transparent',
                color: showMonthly ? '#fff' : '#4285f4',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: showMonthly ? 1 : 0.55,
                transition: 'all 0.18s ease',
              }}
            >
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: showMonthly ? '#fff' : '#4285f4',
                flexShrink: 0,
              }} />
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setShowOneTime((v) => !v)}
              title={showOneTime ? 'Hide one-time donations line' : 'Show one-time donations line'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '999px',
                border: `1.5px solid #34a853`,
                background: showOneTime ? '#34a853' : 'transparent',
                color: showOneTime ? '#fff' : '#34a853',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: showOneTime ? 1 : 0.55,
                transition: 'all 0.18s ease',
              }}
            >
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: showOneTime ? '#fff' : '#34a853',
                flexShrink: 0,
              }} />
              One-Time
            </button>
          </div>
        </div>
        <div>
          {/* Download Button */}
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            onClick={handleDownloadChart}
            disabled={isDownloading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--font-size-xs)'
            }}
          >
            {isDownloading ? 'Downloading...' : '🖼️ Download Chart'}
          </button>
        </div>
      </div>

      <AnalyticsFilters
        filterMode={filterMode}
        donationType={donationType}
        inputStartDate={inputStartDate}
        inputEndDate={inputEndDate}
        onModeChange={handleModeChange}
        onDonationTypeChange={setDonationType}
        onStartChange={setInputStartDate}
        onEndChange={setInputEndDate}
        onApply={handleApplyCustom}
        tierId={tierId}
        onTierChange={setTierId}
      />

      <div
        className="glass"
        style={{
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-card)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ position: 'relative', height: '520px', width: '100%' }}>
          <Line
            ref={chartRef}
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

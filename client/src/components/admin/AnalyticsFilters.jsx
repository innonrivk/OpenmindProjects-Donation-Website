import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api.js';

/**
 * AnalyticsFilters — Filter control strip for AnalyticsTab.
 *
 * Why? Isolating filter-specific rendering logic keeps AnalyticsTab.jsx under
 * the 250-line file limit while maintaining design parity with LedgerTab's filters.
 *
 * @param {Object}   props
 * @param {string}   props.filterMode          - Active mode: 'ALL' | 'LAST_3_MONTHS' | 'LAST_6_MONTHS' | 'LAST_YEAR' | 'LAST_10_YEARS' | 'CUSTOM'
 * @param {string}   props.donationType        - Active type: 'ALL' | 'MONTHLY' | 'ONE_TIME'
 * @param {string}   props.inputStartDate      - Raw value of the start date <input>
 * @param {string}   props.inputEndDate        - Raw value of the end date <input>
 * @param {function} props.onModeChange        - Called with new mode string on <select> change
 * @param {function} props.onDonationTypeChange - Called with new donation type string
 * @param {function} props.onStartChange       - Called with new start date string
 * @param {function} props.onEndChange         - Called with new end date string
 * @param {function} props.onApply             - Called when "Apply Range" button is clicked
 * @param {string}   props.tierId              - Active tier ID filter value
 * @param {function} props.onTierChange        - Called with new tier ID string
 */
export default function AnalyticsFilters({
  filterMode,
  donationType,
  inputStartDate,
  inputEndDate,
  onModeChange,
  onDonationTypeChange,
  onStartChange,
  onEndChange,
  onApply,
  tierId,
  onTierChange,
}) {
  const isCustom = filterMode === 'CUSTOM';
  const isApplyDisabled = !inputStartDate || !inputEndDate;

  // Fetch tiers dynamically from the CMS Tier API
  const { data: tiers = [] } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async () => {
      const { data } = await adminApi.get('/tiers');
      return data;
    },
  });

  const selectedTier = tiers.find((t) => String(t.id) === String(tierId));

  const subscriptionTiers = [...tiers]
    .filter((t) => t.isAutoAppliedBySum)
    .sort((a, b) => a.minAmount - b.minAmount);

  const manualTiers = [...tiers]
    .filter((t) => !t.isAutoAppliedBySum);

  const isFiltered = filterMode !== 'ALL' || donationType !== 'ALL' || tierId !== 'ALL';

  const filterLabels = {
    LAST_3_MONTHS: 'Last 3 Months',
    LAST_6_MONTHS: 'Last 6 Months',
    LAST_YEAR: 'Last 12 Months',
    LAST_10_YEARS: 'Last 10 Years',
    CUSTOM: `${inputStartDate || '?'} → ${inputEndDate || '?'}`,
  };

  return (
    <div className="tx-filters" style={{ marginBottom: '20px' }}>
      <div className="tx-filters__row">
        <label className="tx-filters__label" htmlFor="analytics-filter-mode">
          Date Range
        </label>

        <select
          id="analytics-filter-mode"
          className="tx-filters__select"
          value={filterMode}
          onChange={(e) => onModeChange(e.target.value)}
        >
          <option value="ALL">Everything (All Time)</option>
          <option value="LAST_3_MONTHS">Last 3 Months</option>
          <option value="LAST_6_MONTHS">Last 6 Months</option>
          <option value="LAST_YEAR">Last 12 Months</option>
          <option value="LAST_10_YEARS">Last 10 Years</option>
          <option value="CUSTOM">Custom Date Range</option>
        </select>

        <label className="tx-filters__label" htmlFor="analytics-donation-type">
          Donation Type
        </label>

        <select
          id="analytics-donation-type"
          className="tx-filters__select"
          value={donationType}
          onChange={(e) => onDonationTypeChange(e.target.value)}
        >
          <option value="ALL">Everything</option>
          <option value="MONTHLY">Monthly Only</option>
          <option value="ONE_TIME">One-Time Only</option>
        </select>

        <label className="tx-filters__label" htmlFor="analytics-tier-filter">
          User Tier
        </label>
        <select
          id="analytics-tier-filter"
          className="tx-filters__select"
          value={tierId}
          onChange={(e) => onTierChange(e.target.value)}
        >
          <option value="ALL">All Tiers</option>
          {subscriptionTiers.length > 0 && (
            <optgroup label="Subscription-Based">
              {subscriptionTiers.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
          {manualTiers.length > 0 && (
            <optgroup label="Special / Manual Overrides">
              {manualTiers.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        {selectedTier && selectedTier.isAutoAppliedBySum && (
          <span style={{ fontSize: '11px', color: 'var(--brand-blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Range: ${selectedTier.minAmount}{selectedTier.maxAmount !== null ? ` – $${selectedTier.maxAmount}` : '+'}/mo
          </span>
        )}

        <AnimatePresence>
          {isCustom && (
            <motion.div
              className="tx-filters__custom"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <input
                type="date"
                id="analytics-start-date"
                aria-label="Start date"
                className="tx-filters__date-input"
                value={inputStartDate}
                onChange={(e) => onStartChange(e.target.value)}
              />
              <span className="tx-filters__date-sep">→</span>
              <input
                type="date"
                id="analytics-end-date"
                aria-label="End date"
                className="tx-filters__date-input"
                value={inputEndDate}
                onChange={(e) => onEndChange(e.target.value)}
              />
              <button
                type="button"
                className="cms-btn cms-btn--primary tx-filters__apply-btn"
                onClick={onApply}
                disabled={isApplyDisabled}
                title={isApplyDisabled ? 'Select both dates to apply' : 'Apply date range'}
              >
                Apply Range
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isFiltered && (
        <div className="tx-filter-badge" style={{ marginTop: '10px' }}>
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
            <>⭐ <strong>Tier: {selectedTier?.name || 'Filtered'}</strong></>
          )}
        </div>
      )}
    </div>
  );
}

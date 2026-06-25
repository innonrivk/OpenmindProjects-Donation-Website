import { motion, AnimatePresence } from 'framer-motion';

/**
 * TransactionFilters — Presentational filter control strip for CMSTransactions.
 *
 * Why extracted? Keeps CMSTransactions below the 250-line file rule while
 * isolating filter-specific rendering logic in a single-responsibility component.
 *
 * @param {Object}   props
 * @param {string}   props.filterMode          - Active mode: 'ALL' | 'LAST_MONTH' | 'LAST_YEAR' | 'CUSTOM'
 * @param {string}   props.donationType        - Active type: 'ALL' | 'MONTHLY' | 'ONE_TIME'
 * @param {string}   props.inputStartDate      - Raw value of the start date <input>
 * @param {string}   props.inputEndDate        - Raw value of the end date <input>
 * @param {function} props.onModeChange        - Called with new mode string on <select> change
 * @param {function} props.onDonationTypeChange - Called with new donation type string
 * @param {function} props.onStartChange       - Called with new start date string
 * @param {function} props.onEndChange         - Called with new end date string
 * @param {function} props.onApply             - Called when "Apply Range" button is clicked
 */
export default function TransactionFilters({
  filterMode,
  donationType,
  inputStartDate,
  inputEndDate,
  onModeChange,
  onDonationTypeChange,
  onStartChange,
  onEndChange,
  onApply,
}) {
  const isCustom = filterMode === 'CUSTOM';
  const isApplyDisabled = !inputStartDate || !inputEndDate;

  return (
    <div className="tx-filters">
      <div className="tx-filters__row">
        <label className="tx-filters__label" htmlFor="tx-filter-mode">
          Date Range
        </label>

        <select
          id="tx-filter-mode"
          className="tx-filters__select"
          value={filterMode}
          onChange={(e) => onModeChange(e.target.value)}
        >
          <option value="ALL">Everything</option>
          <option value="LAST_MONTH">Last Month</option>
          <option value="LAST_YEAR">Last Year</option>
          <option value="CUSTOM">Custom Date Range</option>
        </select>

        <label className="tx-filters__label" htmlFor="tx-donation-type">
          Donation Type
        </label>

        {/* Adjacent to date select — flex row handles alignment automatically */}
        <select
          id="tx-donation-type"
          className="tx-filters__select"
          value={donationType}
          onChange={(e) => onDonationTypeChange(e.target.value)}
        >
          <option value="ALL">Everything</option>
          <option value="MONTHLY">Monthly</option>
          <option value="ONE_TIME">One-Time</option>
        </select>

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
                id="tx-start-date"
                aria-label="Start date"
                className="tx-filters__date-input"
                value={inputStartDate}
                onChange={(e) => onStartChange(e.target.value)}
              />
              <span className="tx-filters__date-sep">→</span>
              <input
                type="date"
                id="tx-end-date"
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
    </div>
  );
}

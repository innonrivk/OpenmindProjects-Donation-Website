import { useState, useEffect, useRef } from 'react';

/**
 * ExpiryDatePicker Component
 * 
 * Provides a text input field for credit card expiration date (MM/YY)
 * with auto-masking/formatting as the user types, combined with a
 * premium month/year grid popover picker.
 * 
 * @param {Object} props
 * @param {string} props.value - The current MM/YY value.
 * @param {function} props.onChange - Callback when value changes.
 * @param {string} props.error - Current validation error, if any.
 * @param {boolean} props.isValid - True if value is fully validated.
 */
export default function ExpiryDatePicker({ value, onChange, error, isValid }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse month and year from current value if valid
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  const currentValMonth = match ? parseInt(match[1], 10) : null;
  const currentValYear = match ? 2000 + parseInt(match[2], 10) : null;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth(); // 0-11

  // Popover calendar state
  const [pickerYear, setPickerYear] = useState(currentValYear || currentYear);

  const containerRef = useRef(null);

  // Sync picker year with input value when it changes externally
  useEffect(() => {
    if (currentValYear) {
      setPickerYear(currentValYear);
    }
  }, [currentValYear]);

  // Close popover on outside click
  useEffect(() => {
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Handle keyboard ESC key to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); // keep digits only
    if (val.length > 4) {
      val = val.slice(0, 4);
    }

    // Auto-mask MM/YY
    let formatted = val;
    if (val.length > 2) {
      formatted = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    onChange(formatted);
  };

  const handleYearChange = (increment) => {
    const nextYear = pickerYear + increment;
    if (nextYear >= currentYear && nextYear <= currentYear + 20) {
      setPickerYear(nextYear);
    }
  };

  const handleMonthSelect = (monthIdx) => {
    const mm = String(monthIdx + 1).padStart(2, '0');
    const yy = String(pickerYear % 100).padStart(2, '0');
    onChange(`${mm}/${yy}`);
    setIsOpen(false);
  };

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '50%' }}>
      <input
        type="text"
        placeholder="MM/YY"
        value={value}
        onChange={handleInputChange}
        maxLength={5}
        aria-label="Card Expiration Date"
        style={{
          width: '100%',
          padding: '12px 40px 12px 16px', // Right padding to prevent text overlapping the icon
          border: isValid
            ? '1px solid #34a853'
            : (error ? '1px solid var(--color-error)' : '1px solid var(--color-border)'),
          boxShadow: isValid ? '0 0 0 3px rgba(52, 168, 83, 0.15)' : 'none',
          transition: 'all 0.2s ease',
          borderRadius: '8px',
          backgroundColor: '#ffffff',
          color: 'var(--color-text-primary)',
          fontSize: '16px',
          fontFamily: 'Inter, sans-serif',
          boxSizing: 'border-box',
        }}
      />
      
      {/* Calendar Icon Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Choose expiration date"
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-secondary)',
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-blue)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Popover Expiry Picker Modal Overlay */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Expiration Date Picker"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 1000,
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            padding: '16px',
            width: '240px',
            fontFamily: 'Inter, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          {/* Year selector header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              borderBottom: '1px solid var(--color-bg-tertiary)',
              paddingBottom: '8px',
            }}
          >
            <button
              type="button"
              disabled={pickerYear <= currentYear}
              onClick={() => handleYearChange(-1)}
              style={{
                background: 'none',
                border: 'none',
                cursor: pickerYear <= currentYear ? 'default' : 'pointer',
                opacity: pickerYear <= currentYear ? 0.3 : 1,
                fontSize: '16px',
                color: 'var(--color-text-primary)',
                padding: '4px 8px',
              }}
            >
              &larr;
            </button>
            <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--color-text-primary)' }}>
              {pickerYear}
            </span>
            <button
              type="button"
              disabled={pickerYear >= currentYear + 20}
              onClick={() => handleYearChange(1)}
              style={{
                background: 'none',
                border: 'none',
                cursor: pickerYear >= currentYear + 20 ? 'default' : 'pointer',
                opacity: pickerYear >= currentYear + 20 ? 0.3 : 1,
                fontSize: '16px',
                color: 'var(--color-text-primary)',
                padding: '4px 8px',
              }}
            >
              &rarr;
            </button>
          </div>

          {/* Month grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            {months.map((monthName, idx) => {
              const isPastMonth = pickerYear === currentYear && idx < currentMonthIdx;
              const isSelected = currentValMonth === (idx + 1) && currentValYear === pickerYear;

              return (
                <button
                  key={monthName}
                  type="button"
                  disabled={isPastMonth}
                  onClick={() => handleMonthSelect(idx)}
                  style={{
                    padding: '8px 4px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: isSelected ? '600' : '400',
                    cursor: isPastMonth ? 'default' : 'pointer',
                    backgroundColor: isSelected
                      ? 'var(--brand-blue)'
                      : 'transparent',
                    color: isPastMonth
                      ? 'var(--color-text-muted)'
                      : (isSelected ? '#ffffff' : 'var(--color-text-primary)'),
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isPastMonth && !isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPastMonth && !isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {monthName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

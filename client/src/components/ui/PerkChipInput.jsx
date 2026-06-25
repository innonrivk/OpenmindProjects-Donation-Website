import { useState, useId } from 'react';
import './PerkChipInput.css';

/**
 * PerkChipInput — A reusable UI component for tag-style text inputs.
 * Allows adding items via Enter or Tab, and removing them by clicking a delete button.
 *
 * Why custom input instead of a raw textarea?
 * Tag-based chip input prevents errors from typing pipe delimiters manually
 * and provides clear visual feedback of distinct perks.
 *
 * Why raw value/onChange props?
 * Detaches the input component from react-hook-form's internals, keeping it generic
 * and reusable across both CMSTiers and CMSDonationBoxes sections.
 *
 * @param {Object} props
 * @param {string[]} props.value - Array of perk strings
 * @param {function} props.onChange - Callback triggered when perks list changes
 * @param {boolean} [props.disabled=false] - If true, restricts edit/delete actions and shows locked state
 * @param {string} [props.placeholder] - Text shown in the input box when empty
 */
export default function PerkChipInput({
  value = [],
  onChange,
  disabled = false,
  placeholder = 'Type a perk and press Enter...',
}) {
  const [inputValue, setInputValue] = useState('');
  // Why useId? Generates stable, unique ID for accessibility (aria-describedby)
  const helpTextId = useId();

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const trimmedValue = inputValue.trim();

      // Why check length and duplicates?
      // Avoids saving blank values or repeating the same perk, ensuring clean data arrays.
      if (trimmedValue && !value.includes(trimmedValue)) {
        const updated = [...value, trimmedValue];
        onChange(updated);
        setInputValue('');
      }
    }
  };

  const handleRemoveChip = (indexToRemove) => {
    if (disabled) return;
    const updated = value.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  const handleBlur = () => {
    if (disabled) return;
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !value.includes(trimmedValue)) {
      const updated = [...value, trimmedValue];
      onChange(updated);
      setInputValue('');
    }
  };

  return (
    <div className="perk-chip-input-container">
      <div className={`perk-chip-input ${disabled ? 'perk-chip-input--disabled' : ''}`}>
        <div className="perk-chip-input__wrapper">
          {value.map((chip, idx) => (
            <div
              key={idx}
              className={`perk-chip-input__chip ${disabled ? 'perk-chip-input__chip--disabled' : ''}`}
            >
              {disabled && (
                <svg
                  className="perk-chip-input__lock-icon"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              <span className="perk-chip-input__chip-text">{chip}</span>
              {!disabled && (
                <button
                  type="button"
                  className="perk-chip-input__remove-btn"
                  onClick={() => handleRemoveChip(idx)}
                  aria-label={`Remove perk: ${chip}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <input
              type="text"
              className="perk-chip-input__field"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={value.length === 0 ? placeholder : ''}
              aria-describedby={helpTextId}
            />
          )}
        </div>
      </div>
      {!disabled && (
        <span id={helpTextId} className="perk-chip-input__help-text">
          Press "Enter" to add the chip.
        </span>
      )}
    </div>
  );
}

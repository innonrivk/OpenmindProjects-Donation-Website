import { useState, useRef, useEffect } from 'react';
import { formatContentInline } from '../../utils/formatContent';
import './DonationCard.css';

export default function DonationCard({ box, onDonate, isPopular = false, isExpanded = false, onToggleExpand }) {
  const [isHovered, setIsHovered] = useState(false);
  const [scrollHeight, setScrollHeight] = useState(300);
  const perksRef = useRef(null);

  const perksList = Array.isArray(box.perks) ? box.perks : [];

  const detailsText = box.tierDetails || '';

  const isOpen = isExpanded || isHovered;

  useEffect(() => {
    if (perksRef.current) {
      setScrollHeight(perksRef.current.scrollHeight);
    }
  }, [isOpen, box.perks, box.tierDetails]);

  // dynamic height: 120px is exact collapsed threshold to fit description and first 2 perks beautifully
  const dynamicHeight = isOpen
    ? `${scrollHeight}px`
    : '120px';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Bypasses expanding if user triggered key event on the button itself
      if (e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        onToggleExpand();
      }
    }
  };

  if (box.isCustomAmount) {
    return null; // Custom amount card is handled separately
  }

  return (
    <div
      className={`donation-card ${isPopular ? 'donation-card--popular' : ''} ${isExpanded ? 'donation-card--expanded' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onToggleExpand()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: 'pointer' }}
    >
      {isPopular && (
        <div className="donation-card__badge">Most Popular</div>
      )}
      <div className="donation-card__header">
        <h3 className="donation-card__title">{formatContentInline(box.title)}</h3>
        <div className="donation-card__price">
          <span className="donation-card__currency">$</span>
          <span className="donation-card__amount">{box.amount}</span>
          {box.isRecurring !== false && <span className="donation-card__period">/mo</span>}
        </div>
      </div>
      
      <div
        className="donation-card__content-wrap"
        style={{ maxHeight: dynamicHeight }}
        ref={perksRef}
      >
        {detailsText && <p className="donation-card__details">{formatContentInline(detailsText)}</p>}
        <div className="donation-card__divider" />
        <ul className="donation-card__perks">
          {perksList.map((perk, i) => (
            <li key={i} className="donation-card__perk">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {formatContentInline(perk.trim())}
            </li>
          ))}
        </ul>
        <div className="donation-card__fade-mask" />
      </div>

      <button
        className="donation-card__btn"
        onClick={(e) => {
          e.stopPropagation(); // Prevent toggling height when clicking Donate button
          onDonate(box.amount, box.isRecurring !== false, box);
        }}
      >
        {box.buttonText ? formatContentInline(box.buttonText) : `Donate $${box.amount}/mo`}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  );
}

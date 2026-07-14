import React from 'react';
import { formatContentInline } from '../../utils/formatContent';
/**
 * LifetimeMilestonesCard renders historical achievement goals for the donor.
 * Allows unlocking and claiming certs/rewards.
 * 
 * @param {Object} props
 * @param {Array} props.milestones - All system Milestones
 * @param {number} props.lifetimeMonthlyTotal - Total recurring money donated historically in USD
 * @param {number} props.lifetimeOneTimeTotal - Total one-time money donated historically in USD
 * @param {Array} props.claimedMilestones - User claimed milestones relations
 * @param {number|string|null} props.claimingId - Currently loading claim state ID
 * @param {Function} props.onClaimMilestone - Action handler when claim button is clicked
 */
import { Award } from 'lucide-react';

export default function LifetimeMilestonesCard({
  milestones,
  lifetimeMonthlyTotal,
  lifetimeOneTimeTotal,
  claimedMilestones,
  claimingId,
  onClaimMilestone,
}) {
  /**
   * Counts how many times this specific milestone has been claimed by the user.
   */
  const getClaimCount = (milestoneId) =>
    claimedMilestones?.filter((cm) => cm.milestoneId === milestoneId).length || 0;

  return (
    <section className="dash-card dash-card--milestones animate-fade-in-up animate-delay-1">
      <h3 className="dash-card__title">
        <Award size={20} strokeWidth={2} />
        Lifetime Milestones
      </h3>

      <div className="dash-milestones-list">
        {milestones?.map((m) => {
          const claimCount = getClaimCount(m.id);
          const currentTotal = m.isRepeatable ? lifetimeOneTimeTotal : lifetimeMonthlyTotal;
          const target = m.amountUsd;
          
          let progress, isUnlocked, claimedPermanently;

          if (m.isRepeatable) {
            const creditUsed = claimCount * target;
            const remainingCredit = Math.max(0, currentTotal - creditUsed);
            progress = Math.min((remainingCredit / target) * 100, 100);
            isUnlocked = remainingCredit >= target;
            claimedPermanently = false;
          } else {
            progress = Math.min((currentTotal / target) * 100, 100);
            isUnlocked = currentTotal >= target;
            claimedPermanently = claimCount >= 1;
          }

          return (
            <div key={m.id} className={`dash-milestone ${isUnlocked ? 'dash-milestone--unlocked' : ''}`}>
              <div className="dash-milestone__header">
                <span className="dash-milestone__label" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  {formatContentInline(m.label)}
                  {m.isRepeatable && claimCount > 0 && (
                    <span className="dash-milestone__repeat-count" style={{ fontSize: '11px', opacity: 0.8 }}>
                      🔁 {claimCount}×
                    </span>
                  )}
                  <span className="dash-milestone__track-tag" style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: m.isRepeatable ? 'rgba(49, 151, 149, 0.1)' : 'rgba(49, 130, 206, 0.1)',
                    color: m.isRepeatable ? '#319795' : '#3182ce'
                  }}>
                    {m.isRepeatable ? 'One-Time Objective' : 'Monthly Roadmap'}
                  </span>
                </span>
                <span className="dash-milestone__target">${target}</span>
              </div>
              <div className="dash-milestone__bar">
                <div className="dash-milestone__fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="dash-milestone__desc">{formatContentInline(m.description)}</p>
              {isUnlocked && !claimedPermanently && (
                <button
                  className="dash-milestone__claim"
                  onClick={() => onClaimMilestone(m.id)}
                  disabled={claimingId !== null && claimingId !== undefined}
                >
                  {claimingId === m.id ? 'Claiming...' : '🎉 Claim Reward'}
                </button>
              )}
              {claimedPermanently && (
                <span className="dash-milestone__claimed">✓ Claimed</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

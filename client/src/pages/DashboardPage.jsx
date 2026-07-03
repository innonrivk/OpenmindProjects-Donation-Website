import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardNav from '../components/layout/DashboardNav';
import CustomAmountCard from '../components/donation/CustomAmountCard';
import UserSummaryCard from '../components/dashboard/UserSummaryCard';
import LifetimeMilestonesCard from '../components/dashboard/LifetimeMilestonesCard';
import DashboardHistorySection from '../components/dashboard/DashboardHistorySection';
import DashboardModals from '../components/dashboard/DashboardModals';
import UserTiersCard from '../components/dashboard/UserTiersCard';
import { useDonationState } from '../hooks/useDonationState';
import * as api from '../services/api';
import { formatContentInline } from '../utils/formatContent';
import './DashboardPage.css';

/**
 * DashboardPage is the donor control center.
 *
 * Why? Orchestrates profile summaries, achievement tracking, donation updates,
 * and history rendering. Split into sub-components to strictly respect file size limits.
 *
 * @returns {JSX.Element}
 */
export default function DashboardPage() {
  const { profileData, refreshUser } = useAuth();
  const {
    updateLoading,
    cancelLoading,
    rolloverLoading,
    updateMsg,
    setUpdateMsg,
    updateDonation,
    cancelScheduled,
    simulateMockRollover,
  } = useDonationState();

  const [claimingId, setClaimingId] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [selectedReceiptTx, setSelectedReceiptTx] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAmount, setPendingAmount] = useState(null);

  const isDev = import.meta.env.DEV;
  const data = profileData;

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Poll every 60 seconds while a scheduled update is pending (mock/webhook sync rollover)
  useEffect(() => {
    if (!data?.scheduledAmount) return;
    const interval = setInterval(() => {
      refreshUser();
    }, 60000);
    return () => clearInterval(interval);
  }, [data?.scheduledAmount, refreshUser]);

  // Clear stale updateMsg when rollover resolves
  useEffect(() => {
    if (!data?.scheduledAmount) {
      setUpdateMsg({ type: '', text: '' });
    }
  }, [data?.scheduledAmount, setUpdateMsg]);

  if (!data) {
    return (
      <div className="dashboard-page">
        <DashboardNav />
        <div className="dashboard-loading">
          <div className="fullpage-spinner__ring" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { user, tier, monthlyAmount, lifetimeTotal, lifetimeMonthlyTotal, lifetimeOneTimeTotal, transactions, claimedMilestones, milestones, tiers } = data;

  const handleClaimMilestone = async (milestoneId) => {
    setClaimingId(milestoneId);
    try {
      await api.claimMilestone({ milestoneId });
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3000);
      await refreshUser();
    } catch (err) {
      alert(err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const handleStartDonation = async (amount) => {
    if (updateLoading) return;
    if (monthlyAmount > 0) {
      setPendingAmount(amount);
      setShowConfirmModal(true);
    } else {
      setSelectedAmount(amount);
      setCheckoutOpen(true);
    }
  };

  const handleConfirmUpdate = async () => {
    setShowConfirmModal(false);
    if (!pendingAmount) return;
    await updateDonation(pendingAmount);
    setPendingAmount(null);
  };

  return (
    <div className="dashboard-page">
      <DashboardNav />

      {confetti && (
        <div className="confetti-overlay">
          {Array.from({ length: 50 }).map((_, i) => {
            const left = (i * 17) % 100;
            const delay = ((i * 7) % 10) / 20;
            const colorIndex = (i * 3) % 4;
            const colors = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
            return (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${left}%`,
                  animationDelay: `${delay}s`,
                  backgroundColor: colors[colorIndex],
                }}
              />
            );
          })}
        </div>
      )}

      <main className="dashboard-main container">
        {data.scheduledAmount && (
          <div className="dash-scheduled-banner animate-fade-in">
            <div className="dash-scheduled-banner__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="dash-scheduled-banner__text">
              Your monthly donation update to <strong>${data.scheduledAmount}/mo</strong>
              {(() => {
                const scheduledTier = tiers?.find(t =>
                  data.scheduledAmount >= t.minAmount &&
                  (t.maxAmount === null || data.scheduledAmount <= t.maxAmount)
                );
                return scheduledTier ? <> ({formatContentInline(scheduledTier.name)} tier)</> : null;
              })()} has been scheduled and will take effect at the end of the current billing cycle.
            </div>
            {isDev && (
              <button
                className="dash-simulate-btn"
                onClick={simulateMockRollover}
                disabled={rolloverLoading}
                title="Dev only: simulate billing cycle rollover"
              >
                {rolloverLoading ? '⏳ Rolling over...' : '🧪 Simulate Billing Rollover'}
              </button>
            )}
            <div className="dash-scheduled-banner__pulse" />
          </div>
        )}

        <div className="dashboard-grid">
          <UserSummaryCard
            user={user}
            tier={tier}
            monthlyAmount={monthlyAmount}
            scheduledAmount={data.scheduledAmount}
            scheduledAmountEffectiveDate={data.scheduledAmountEffectiveDate}
            lifetimeTotal={lifetimeTotal}
          />

          <div className="dashboard-col-left">
            <div className="dash-notice-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Updating your donation <strong>won't charge you</strong> until your next month's billing cycle.</span>
            </div>

            <section className="dash-card dash-card--update animate-fade-in-up animate-delay-1">
              <CustomAmountCard
                onDonate={handleStartDonation}
                title="Change monthly donation"
                desc="The amount you choose will set your new OMP monthly donation portion (excluding Add-ons)."
                buttonLabel={updateLoading ? "Updating..." : "Change Donation Amount"}
                presetAmounts={[10, 85, 170]}
              >
                {updateMsg.text && (
                  <div className={`dash-msg dash-msg--${updateMsg.type}`}>
                    {updateMsg.text}
                  </div>
                )}

                <div className="dash-tiers-desc">
                  <span className="dash-tiers-label">Available Tiers (Click to select)</span>
                  
                  <div 
                    className="dash-tier-row" 
                    onClick={() => handleStartDonation(10)} 
                    style={{ borderLeft: '3px solid #4285f4', cursor: 'pointer' }}
                  >
                    <strong>Regular — $10+/mo</strong>
                    <p>Newsletter · Voting seeds · Discounted OMP tours</p>
                  </div>
                  
                  <div 
                    className="dash-tier-row" 
                    onClick={() => handleStartDonation(85)} 
                    style={{ borderLeft: '3px solid #34a853', cursor: 'pointer' }}
                  >
                    <strong>Shareholder — $85+/mo</strong>
                    <p>All Regular perks · Quarter meetings · Campaign voting · Extra votes per $10 above $75</p>
                  </div>
                  
                  <div 
                    className="dash-tier-row" 
                    onClick={() => handleStartDonation(170)} 
                    style={{ borderLeft: '3px solid #fbbc04', cursor: 'pointer' }}
                  >
                    <strong>Patron — $170+/mo</strong>
                    <p>All Shareholder perks · Name on camp t-shirts · Social media shout-outs</p>
                  </div>
                </div>
              </CustomAmountCard>
            </section>

            {user.tiers?.length > 0 && (
              <UserTiersCard tiers={user.tiers} onTierCancelled={refreshUser} />
            )}
          </div>

          <div className="dashboard-col-right">
            <LifetimeMilestonesCard
              milestones={milestones}
              lifetimeMonthlyTotal={lifetimeMonthlyTotal}
              lifetimeOneTimeTotal={lifetimeOneTimeTotal}
              claimedMilestones={claimedMilestones}
              claimingId={claimingId}
              onClaimMilestone={handleClaimMilestone}
            />

            <DashboardHistorySection
              transactions={transactions}
              scheduledAmount={data.scheduledAmount}
              scheduledAmountEffectiveDate={data.scheduledAmountEffectiveDate}
              cancelScheduled={cancelScheduled}
              cancelLoading={cancelLoading}
              setSelectedReceiptTx={setSelectedReceiptTx}
              currentAmount={monthlyAmount}
            />
          </div>
        </div>
      </main>

      <DashboardModals
        checkoutOpen={checkoutOpen}
        setCheckoutOpen={setCheckoutOpen}
        selectedAmount={selectedAmount}
        refreshUser={refreshUser}
        selectedReceiptTx={selectedReceiptTx}
        setSelectedReceiptTx={setSelectedReceiptTx}
        user={user}
        tiers={tiers}
        showConfirmModal={showConfirmModal}
        setShowConfirmModal={setShowConfirmModal}
        monthlyAmount={monthlyAmount}
        pendingAmount={pendingAmount}
        setPendingAmount={setPendingAmount}
        handleConfirmUpdate={handleConfirmUpdate}
        updateLoading={updateLoading}
      />
    </div>
  );
}

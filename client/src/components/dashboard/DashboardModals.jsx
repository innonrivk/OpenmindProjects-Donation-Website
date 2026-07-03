import CheckoutModal from '../checkout/CheckoutModal';
import Modal from '../ui/Modal';
import DonationReceipt from '../donation/DonationReceipt';
import Button from '../ui/Button';

/**
 * Container component managing all modals related to user donations and checkouts.
 *
 * Why? Isolating modal declarations prevents bloated markup in DashboardPage
 * and organizes modal controls in a single, focused component.
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.checkoutOpen - Checkout modal visibility.
 * @param {Function} props.setCheckoutOpen - Setter for checkout visibility.
 * @param {number|null} props.selectedAmount - Selected payment amount in USD.
 * @param {Function} props.refreshUser - Refreshes Auth context user data.
 * @param {Object|null} props.selectedReceiptTx - Currently viewed transaction for receipt.
 * @param {Function} props.setSelectedReceiptTx - Setter for receipt modal transaction.
 * @param {Object} props.user - Active user data object.
 * @param {Array} props.tiers - Array of active pricing tiers.
 * @param {boolean} props.showConfirmModal - Confirm update modal visibility.
 * @param {Function} props.setShowConfirmModal - Setter for confirm update visibility.
 * @param {number} props.monthlyAmount - Active monthly donation amount.
 * @param {number|null} props.pendingAmount - Prospective donation amount to update to.
 * @param {Function} props.setPendingAmount - Setter for prospective donation amount.
 * @param {Function} props.handleConfirmUpdate - Execution handler for confirm update.
 * @param {boolean} props.updateLoading - Loading state of the update API action.
 * @returns {JSX.Element}
 */
export default function DashboardModals({
  checkoutOpen,
  setCheckoutOpen,
  selectedAmount,
  refreshUser,
  selectedReceiptTx,
  setSelectedReceiptTx,
  user,
  tiers,
  showConfirmModal,
  setShowConfirmModal,
  monthlyAmount,
  pendingAmount,
  setPendingAmount,
  handleConfirmUpdate,
  updateLoading,
}) {
  return (
    <>
      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => { setCheckoutOpen(false); refreshUser(); }}
        amount={selectedAmount}
      />

      <Modal
        isOpen={!!selectedReceiptTx}
        onClose={() => setSelectedReceiptTx(null)}
        title="Donation Receipt"
        size="lg"
      >
        {selectedReceiptTx && (
          <DonationReceipt
            referenceId={selectedReceiptTx.id}
            dateStr={new Date(selectedReceiptTx.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
            amount={Math.round(selectedReceiptTx.amount / 100)}
            donorName={`${user.firstName} ${user.lastName}`}
            donorEmail={user.email}
            country={user.country}
            tierName={
              tiers.find(t => {
                const amt = Math.round(selectedReceiptTx.amount / 100);
                return amt >= t.minAmount && (t.maxAmount === null || amt <= t.maxAmount);
              })?.name || 'Regular'
            }
            tierPerks={
              (() => {
                const matchingTier = tiers.find(t => {
                  const amt = Math.round(selectedReceiptTx.amount / 100);
                  return amt >= t.minAmount && (t.maxAmount === null || amt <= t.maxAmount);
                });
                if (matchingTier) {
                  try {
                    return typeof matchingTier.perks === 'string'
                      ? JSON.parse(matchingTier.perks)
                      : (Array.isArray(matchingTier.perks) ? matchingTier.perks : []);
                  } catch {
                    return [];
                  }
                }
                return [];
              })()
            }
            showPrintButton={true}
            onClose={() => setSelectedReceiptTx(null)}
          />
        )}
      </Modal>

      <Modal
        isOpen={showConfirmModal}
        onClose={() => { setShowConfirmModal(false); setPendingAmount(null); }}
        title="Update Donation"
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(() => {
            const addOns = user?.tiers?.filter(t => t.assignedBy === 'MANUAL') || [];
            const totalAddOnCost = addOns.reduce((sum, t) => sum + (t.minAmount || 0), 0);
            const currentGeneral = Math.max(0, (monthlyAmount || 0) - totalAddOnCost);
            const totalNewAmount = pendingAmount ? (pendingAmount + totalAddOnCost) : 0;

            return (
              <p style={{ margin: 0, fontSize: '15px', color: 'var(--color-text-primary)', lineHeight: '1.5' }}>
                Are you sure you want to update your OMP monthly donation
                {monthlyAmount > 0 ? ` from $${currentGeneral}/mo` : ''} to
                <strong> ${pendingAmount}/mo</strong>?
                {totalAddOnCost > 0 && (
                  <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted, #6b7280)', marginTop: '8px', padding: '8px', border: '1px dashed var(--color-border)', borderRadius: '6px' }}>
                    Your active Add-ons (${totalAddOnCost}/mo) remain unchanged, bringing your new total monthly billing to <strong>${totalNewAmount}/mo</strong>.
                  </span>
                )}
              </p>
            );
          })()}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button
              variant="secondary"
              onClick={() => { setShowConfirmModal(false); setPendingAmount(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmUpdate}
              disabled={updateLoading || !pendingAmount}
            >
              {updateLoading ? 'Updating...' : 'Yes, Update'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

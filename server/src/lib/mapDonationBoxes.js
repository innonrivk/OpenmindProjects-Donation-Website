/**
 * Maps raw DonationBox records to include resolved perks.
 *
 * Why? DonationBoxes need a flat `perks` array for the frontend to render
 * perk lists. With the tierId FK relation, Prisma can now include the tier
 * data natively (via `include: { tier: true }`), so we resolve perks from
 * the included tier object first. Falls back to legacy tierDetails pipe-
 * delimited string for boxes that have not yet been migrated to the FK
 * relation.
 *
 * @param {Array} donationBoxes - DonationBox records (with optional included tier).
 * @returns {Array} Mapped donation boxes with resolved perks arrays.
 */
export function mapDonationBoxes(donationBoxes) {
  return donationBoxes.map(box => {
    const plainBox = { ...box };

    // 1. Resolve perks: inherit from tier if connected to a tier
    let boxPerks = [];
    try {
      boxPerks = typeof plainBox.perks === 'string'
        ? JSON.parse(plainBox.perks)
        : (Array.isArray(plainBox.perks) ? plainBox.perks : []);
    } catch {
      boxPerks = [];
    }

    if (plainBox.tier && !plainBox.isCustomAmount) {
      let tierPerks = [];
      try {
        tierPerks = typeof plainBox.tier.perks === 'string'
          ? JSON.parse(plainBox.tier.perks)
          : (Array.isArray(plainBox.tier.perks) ? plainBox.tier.perks : []);
      } catch {
        tierPerks = [];
      }
      plainBox.perks = tierPerks;
      plainBox.title = plainBox.tier.name;

      // Resolve amount: inherit tier minAmount if box amount is 0/unset, otherwise use the edited override amount
      if (plainBox.amount === 0 || plainBox.amount === null || plainBox.amount === undefined) {
        plainBox.amount = plainBox.tier.minAmount;
      }
    } else {
      plainBox.perks = boxPerks;
    }

    // 2. Resolve button text: default to "Donate $[amount]/mo" (or "Donate $[amount]" if one-time) if it is empty, null, or the default "Donate"
    const hasCustomButtonText = plainBox.buttonText && plainBox.buttonText !== 'Donate' && plainBox.buttonText.trim() !== '';
    if (!hasCustomButtonText) {
      if (plainBox.isCustomAmount) {
        plainBox.buttonText = plainBox.isRecurring ? 'Donate Monthly' : 'Donate One-Time';
      } else {
        const suffix = plainBox.isRecurring !== false ? '/mo' : '';
        plainBox.buttonText = `Donate $${plainBox.amount}${suffix}`;
      }
    }

    return plainBox;
  });
}

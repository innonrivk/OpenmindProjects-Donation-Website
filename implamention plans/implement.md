# Fix: Tier Calculation Isolation & User Self-Management

## The Two Rules This Plan Enforces

| Class | `isAutoAppliedBySum` | Who assigns it | Who removes it |
|---|---|---|---|
| **Subscription tiers** (Regular, Shareholder, Patron) | `true` | System only via `recalculateUserTiers` | System only |
| **Standalone tiers** (VIP Patron, bob, etc.) | `false` | Admin manually, or Donation Box checkout | Admin **or the user themselves** |

### Core Invariants
1. **No admin or checkout flow may manually assign a subscription tier.** *(Already implemented)*
2. **A standalone tier's `minAmount` must be deducted from the user's `monthlyAmount` before calculating which subscription tier they qualify for.** *(Not yet implemented)*
3. **When a subscription is cancelled (`monthlyAmount → 0`), all standalone manual tiers are automatically removed.** *(Not yet implemented)*
4. **Users can self-cancel their own standalone tiers from the dashboard.** *(New feature)*

---

## What Is Already Done ✅

- `adminUserController.js` → 409 guard blocks manual assignment of auto-tiers
- `removeTierFromUser` → 409 guard prevents removing auto-tiers manually
- `oneTimeController.js` → skips `userTier.upsert` if `isAutoAppliedBySum = true`
- `CMSDonorsTiers.jsx` → admin dropdown filters out auto-tiers

---

## User Review Required

> [!WARNING]
> **Subscription cancellation will automatically remove all standalone manual tiers.** When a user's Stripe subscription is cancelled and `monthlyAmount` resets to 0, any `MANUAL` assigned tiers (VIP Patron, bob, etc.) will be deleted atomically. This is intentional — manual tiers paid by subscription amount can't survive a cancelled subscription.

> [!IMPORTANT]
> **The deduction formula**: `effectiveAmount = monthlyAmount - Σ(standalone tier minAmounts)`. The result is floored at 0. This is used *only* internally for auto-tier qualification — Stripe always receives the full `monthlyAmount`.

---

## Proposed Changes

---

### 1. Core Logic — `tierAssignmentService.js`

**This is the most critical fix.** The service currently reads `user.monthlyAmount` raw. It needs to deduct standalone manual tier `minAmount` values before computing qualification.

#### [MODIFY] [tierAssignmentService.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/services/tierAssignmentService.js)

```javascript
export async function recalculateUserTiers(userId, tx = prisma, preFetchedTiers = null) {
  try {
    // Fetch user + their active MANUAL tiers in a single query
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        monthlyAmount: true,
        userTiers: {
          where: { assignedBy: 'MANUAL' },
          include: { tier: { select: { id: true, minAmount: true, isAutoAppliedBySum: true } } },
        },
      },
    });
    if (!user) return;

    // Deduct standalone manual tier minAmounts from the monthly total.
    // Why? A user who pays $80 base + holds a $66-minAmount standalone tier
    // has a total monthlyAmount of $180, but only $80 of that is "auto-tier qualifying".
    // Stripe receives the full $180; this deduction is internal only.
    const standaloneTierDeduction = user.userTiers
      .filter(ut => !ut.tier.isAutoAppliedBySum)
      .reduce((sum, ut) => sum + ut.tier.minAmount, 0);

    const effectiveAmount = Math.max(0, user.monthlyAmount - standaloneTierDeduction);

    const tiers = preFetchedTiers || await tx.tier.findMany();
    const autoAppliedTiers = tiers.filter(t => t.isAutoAppliedBySum);

    const qualifyingTiers = autoAppliedTiers.filter(t => {
      const meetsMin = effectiveAmount >= t.minAmount;
      const meetsMax = t.maxAmount === null || effectiveAmount <= t.maxAmount;
      return meetsMin && meetsMax;
    });

    // ... rest of assignment/removal logic unchanged ...
  }
}
```

**Also update `recalculateAllUsersTiers`**: Remove pre-fetching user data from the batch call since per-user manual tier data cannot be pre-fetched globally. Each `recalculateUserTiers(userId)` call will query its own user's manual tiers.

```javascript
export async function recalculateAllUsersTiers() {
  try {
    const tiers = await prisma.tier.findMany();
    const users = await prisma.user.findMany({ select: { id: true } });

    const batchSize = 20;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      // Note: preFetchedTiers still passed to avoid re-fetching tier definitions.
      // Manual tier data is fetched per-user inside recalculateUserTiers.
      await Promise.all(batch.map(u => recalculateUserTiers(u.id, prisma, tiers)));
    }
  } catch (error) {
    console.error('Error recalculating tiers for all users:', error);
  }
}
```

---

### 2. Subscription Cancellation — Auto-Remove Standalone Tiers

#### [MODIFY] [webhooksController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/public/webhooksController.js)

In `handleSubscriptionDeleted`, after resetting `monthlyAmount → 0`, delete all `MANUAL` UserTier rows for this user **before** calling `recalculateUserTiers`. This prevents negative effective amounts.

```javascript
async function handleSubscriptionDeleted(subscription) {
  // ... existing user lookup ...
  if (user) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { monthlyAmount: 0, scheduledAmount: null, scheduledAmountEffectiveDate: null },
      });

      // Why? Standalone tiers are tied to the subscription payment context.
      // When a subscription is cancelled, there's nothing left to fund them.
      await tx.userTier.deleteMany({
        where: { userId: user.id, assignedBy: 'MANUAL' },
      });
    });

    await recalculateUserTiers(user.id); // Now guaranteed to produce 0 deduction
  }
}
```

---

### 3. Subscribe Route Fix — `donations.js`

#### [MODIFY] [donations.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/routes/public/donations.js)

The `/subscribe` route still does a raw `userTier.upsert` without checking `isAutoAppliedBySum` (lines 121-144). This is the same bug that was fixed in `oneTimeController.js`. Apply the same fix:

```javascript
if (donationBoxId) {
  const dbBox = await tx.donationBox.findUnique({
    where: { id: donationBoxId },
    select: { tierId: true, tier: { select: { isAutoAppliedBySum: true } } },
  });

  // Only assign standalone tiers manually. Subscription tiers are handled by recalculateUserTiers.
  if (dbBox && dbBox.tierId && !dbBox.tier?.isAutoAppliedBySum) {
    await tx.userTier.upsert({ ... });
  }
}
```

---

### 4. New Public Endpoint — User Self-Cancel Tier

#### [NEW] Server route in [subscriptions.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/routes/public/subscriptions.js)

```
DELETE /api/v1/subscriptions/tiers/:tierId
```

Logic:
1. Authenticate via `requireAuth`.
2. Fetch the `UserTier` record for `req.user.userId + tierId`.
3. Reject with `409` if `assignedBy === 'AUTO_SUM'` (can't self-remove auto-tiers).
4. Delete the row.
5. Call `recalculateUserTiers(userId)` so auto-tier re-evaluates without the deducted `minAmount`.

---

### 5. Profile Response — Expose `assignedBy` Metadata

#### [MODIFY] [authController.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/src/controllers/public/authController.js)

The profile response currently maps `user.userTiers` to a flat array of `tier` objects, stripping the `UserTier` record metadata. Update it to expose `assignedBy` so the dashboard can distinguish auto vs manual.

```javascript
// Before:
const activeTiers = user.userTiers.map(ut => ut.tier).sort(...)

// After:
const activeTiers = user.userTiers
  .sort((a, b) => b.tier.tierLevel - a.tier.tierLevel)
  .map(ut => ({
    ...ut.tier,
    assignedBy: ut.assignedBy,  // 'AUTO_SUM' | 'MANUAL'
    userTierId: ut.id,          // Needed for delete endpoint
  }));
```

Update the profile response: `user.tiers: activeTiers`.

---

### 6. User Dashboard — "My Tiers" Card

#### [NEW] [UserTiersCard.jsx](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/client/src/components/dashboard/UserTiersCard.jsx)

A new card in the user dashboard showing all active tiers with:
- **Badge**: `Auto` (green, locked) or `Manual` (blue, cancellable)
- **Cancel button** on manual-only tiers
- **Confirmation modal** ("Are you sure you want to leave the [Tier Name] tier?")
- On confirm: calls `DELETE /api/v1/subscriptions/tiers/:tierId`, then `refreshUser()`

Display condition: only shown if `user.tiers.length > 0`.

#### [MODIFY] [DashboardPage.jsx](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/client/src/pages/DashboardPage.jsx)

Add `<UserTiersCard tiers={user.tiers} onTierCancelled={refreshUser} />` to the dashboard grid.

---

### 7. Database Cleanup Script

#### [NEW] [cleanupManualTiers.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/scripts/cleanupManualTiers.js)

One-off script to delete `MANUAL` assignments of auto-applied tiers. Supports `--dry-run`. Writes `AuditLog` entries per deleted row. Idempotent.

---

### 8. Unit Tests

#### [MODIFY] [tierAssignment.test.js](file:///c:/Users/Lenovo/OneDrive/Documents/Donation%20site/Donation-Site-Project/server/tests/unit/tierAssignment.test.js)

Replace the broken L124 test with:

1. **Deduction test**: User with `monthlyAmount = 180`, holds standalone tier (`minAmount = 66`) → qualifies for Shareholder ($80-$169 range after $180-$66=$114), NOT Patron.
2. **Floor test**: User with `monthlyAmount = 50`, holds standalone tier (`minAmount = 66`) → `effectiveAmount = 0` → no auto-tier assigned.
3. **Subscription cancellation test**: After `handleSubscriptionDeleted`, user has no manual tiers and no auto-tiers.
4. **Auto-tier guard test**: Controller returns 409 for `isAutoAppliedBySum = true`.
5. **Standalone tier assignment test**: Controller returns 200 for `isAutoAppliedBySum = false`.

---

## Verification Plan

### Automated Tests
```bash
cd server && node --test tests/unit/tierAssignment.test.js
```

### Manual Verification
1. User with $180/mo total + "bob" tier (minAmount $66) → effective = $114 → **Shareholder**, not Patron.
2. Cancel subscription → "bob" tier disappears, Shareholder disappears.
3. Admin assigns VIP Patron → `200 OK`.
4. Admin assigns Patron (auto) → `409 Conflict`.
5. Dashboard "My Tiers" card shows: Shareholder (Auto, no cancel) + bob (Manual, cancel button).
6. Click cancel on "bob" → confirmation modal → confirm → tier removed → auto-tier recalculates.

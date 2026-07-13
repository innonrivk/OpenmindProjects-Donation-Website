import prisma from '../../lib/prismaPublic.js';
import prismaWrite from '../../lib/prisma.js';
import { stripe, isMockMode, listActiveSubscriptions } from '../../services/stripe.js';
import { sendAmountChangedEmail, sendCancelScheduledEmail } from '../../services/email.js';
import { recalculateUserTiers } from '../../services/tierAssignmentService.js';

/**
 * Handle updating the user's monthly subscription.
 *
 * Why? Performs critical backend validation on incoming dollar amounts
 * (ensuring integers of at least $1) before scheduling update transactions
 * in either Stripe or mock database mode.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function updateSubscription(req, res, next) {
  try {
    const { amount } = req.body; // in dollars (donation type portion)

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount < 1) {
      return res.status(400).json({ error: 'validation_error', message: 'Amount must be a whole number of at least $1.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user?.stripeCustomerId) {
      return res.status(404).json({ error: 'no_subscription', message: 'No active subscription found.' });
    }

    // Fetch manual tiers to calculate the add-on total
    const userTiers = await prisma.userTier.findMany({
      where: { userId: user.id, assignedBy: 'MANUAL' },
      include: { tier: true },
    });
    const addOnsTotal = userTiers
      .filter(ut => !ut.tier.isAutoAppliedBySum)
      .reduce((sum, ut) => sum + ut.tier.minAmount, 0);

    const totalAmount = parsedAmount + addOnsTotal;
    const amountCents = totalAmount * 100;
    const donorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Donor';

    if (isMockMode) {
      const now = new Date();
      const effectiveDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          scheduledAmount: totalAmount,
          scheduledAmountEffectiveDate: effectiveDate,
        },
      });

      await sendAmountChangedEmail({
        to: user.email,
        donorName,
        oldAmount: user.monthlyAmount,
        newAmount: totalAmount,
        effectiveDate,
      });

      process.stdout.write(JSON.stringify({
        level: 'INFO',
        ts: new Date().toISOString(),
        event: 'MOCK_SUBSCRIPTION_UPDATE_SCHEDULED',
        userId: user.id,
        email: user.email,
        amountDollars: totalAmount,
      }) + '\n');

      return res.status(200).json({
        status: 'SCHEDULED',
        message: 'Your donation update has been scheduled and will take effect at the end of the current billing period.',
        newAmount: totalAmount,
      });
    }

    // Real Stripe: Find active subscription and update
    const activeSubs = await listActiveSubscriptions(user.stripeCustomerId);
    if (activeSubs.length === 0) {
      return res.status(404).json({ error: 'no_subscription', message: 'No active subscription found.' });
    }

    const subscription = activeSubs[0];
    const subscriptionItemId = subscription.items.data[0].id;
    const effectiveDate = new Date(subscription.current_period_end * 1000);

    // Update Stripe subscription without proration (takes effect at end of period)
    await stripe.subscriptions.update(subscription.id, {
      items: [{
        id: subscriptionItemId,
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Monthly Donation - OpenmindProjects',
          },
          unit_amount: amountCents,
          recurring: { interval: 'month' },
        },
      }],
      proration_behavior: 'none',
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        scheduledAmount: totalAmount,
        scheduledAmountEffectiveDate: effectiveDate,
      },
    });

    await sendAmountChangedEmail({
      to: user.email,
      donorName,
      oldAmount: user.monthlyAmount,
      newAmount: totalAmount,
      effectiveDate,
    });

    return res.status(200).json({
      status: 'SCHEDULED',
      message: 'Your donation update has been scheduled and will take effect at the end of the current billing period.',
      newAmount: totalAmount,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle full cancellation of subscription at current cycle end.
 *
 * Why? Reverts billing records immediately on Stripe to avoid next cycle charges
 * and schedules database status update.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function cancelSubscription(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user?.stripeCustomerId) {
      return res.status(404).json({ error: 'no_subscription', message: 'No active subscription found.' });
    }

    if (isMockMode) {
      process.stdout.write(JSON.stringify({
        level: 'INFO',
        ts: new Date().toISOString(),
        event: 'MOCK_SUBSCRIPTION_CANCEL',
        userId: user.id,
        email: user.email,
      }) + '\n');

      await prismaWrite.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            monthlyAmount: 0,
            scheduledAmount: null,
            scheduledAmountEffectiveDate: null,
          },
        });
        await tx.userTier.deleteMany({
          where: { userId: user.id, assignedBy: 'MANUAL' },
        });
      });

      try {
        await recalculateUserTiers(user.id);
      } catch (err) {
        console.error('Failed to recalculate user tiers on mock subscription cancel:', err);
      }

      return res.status(200).json({
        status: 'CANCELLED',
        message: 'Subscription will be cancelled at the end of the current billing period.',
      });
    }

    const activeSubs = await listActiveSubscriptions(user.stripeCustomerId);
    if (activeSubs.length === 0) {
      return res.status(404).json({ error: 'no_subscription', message: 'No active subscription found.' });
    }

    await stripe.subscriptions.update(activeSubs[0].id, {
      cancel_at_period_end: true,
    });

    await prismaWrite.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          monthlyAmount: 0,
          scheduledAmount: null,
          scheduledAmountEffectiveDate: null,
        },
      });
      await tx.userTier.deleteMany({
        where: { userId: user.id, assignedBy: 'MANUAL' },
      });
    });

    try {
      await recalculateUserTiers(user.id);
    } catch (err) {
      console.error('Failed to recalculate user tiers on subscription cancel:', err);
    }

    return res.status(200).json({
      status: 'CANCELLED',
      message: 'Subscription will be cancelled at the end of the current billing period.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel a scheduled subscription price change before it takes effect.
 *
 * Why? Reverts the scheduled price back to the user's active monthlyAmount
 * on Stripe to maintain sync, and resets DB fields.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function cancelScheduledSubscription(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found.' });
    }
    if (user.scheduledAmount === null) {
      return res.status(400).json({ error: 'no_scheduled_change', message: 'No scheduled donation update found.' });
    }

    // Revert the price on Stripe to monthlyAmount before resetting DB fields.
    if (!isMockMode && user.stripeCustomerId) {
      const activeSubs = await listActiveSubscriptions(user.stripeCustomerId);
      if (activeSubs.length > 0) {
        const subscription = activeSubs[0];
        const subscriptionItemId = subscription.items.data[0].id;
        await stripe.subscriptions.update(subscription.id, {
          items: [{
            id: subscriptionItemId,
            price_data: {
              currency: 'usd',
              product_data: { name: 'Monthly Donation - OpenmindProjects' },
              unit_amount: user.monthlyAmount * 100, // Revert to current monthlyAmount in cents
              recurring: { interval: 'month' },
            },
          }],
          proration_behavior: 'none',
        });
      }
    }

    // Reset scheduled fields in the DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        scheduledAmount: null,
        scheduledAmountEffectiveDate: null,
      },
    });

    const donorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Donor';

    await sendCancelScheduledEmail({
      to: user.email,
      donorName,
      amount: user.monthlyAmount,
    });

    return res.status(200).json({
      status: 'CANCELLED_SCHEDULED',
      message: 'Your scheduled monthly donation change has been cancelled.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Manually trigger mock billing cycle rollover.
 *
 * Why? Simulates the rollover of the deferred donation in mock/dev environment
 * without waiting. Relies on the Prisma hook to trigger the receipt email safely.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function simulateRollover(req, res, next) {
  if (!isMockMode) {
    return res.status(403).json({ error: 'forbidden', message: 'This endpoint is only available in mock mode.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found.' });
    }
    if (user.scheduledAmount === null) {
      return res.status(400).json({ error: 'no_scheduled_change', message: 'No scheduled donation update to roll over.' });
    }

    const scheduledAmt = user.scheduledAmount;
    const scheduledAmtCents = Math.round(scheduledAmt * 100);

    // Execute rollover inside an atomic transaction
    await prisma.$transaction(async (tx) => {
      // Create a new transaction record representing the rollover payment
      await tx.transaction.create({
        data: {
          userId: user.id,
          amount: scheduledAmtCents,
          status: 'SUCCEEDED',
          stripePaymentIntentId: `pi_mock_rollover_${Date.now()}`,
          isRecurring: true,
        },
      });

      // Promote scheduledAmount → monthlyAmount and clear scheduled fields
      await tx.user.update({
        where: { id: user.id },
        data: {
          monthlyAmount: scheduledAmt,
          scheduledAmount: null,
          scheduledAmountEffectiveDate: null,
        },
      });
    });

    try {
      await recalculateUserTiers(user.id);
    } catch (err) {
      console.error('Failed to recalculate user tiers on simulate rollover:', err);
    }

    process.stdout.write(JSON.stringify({
      level: 'INFO',
      ts: new Date().toISOString(),
      event: 'MOCK_BILLING_ROLLOVER_SIMULATED',
      userId: user.id,
      email: user.email,
      newAmountDollars: scheduledAmt,
    }) + '\n');

    return res.status(200).json({
      status: 'ROLLED_OVER',
      message: `Billing cycle simulated. Donation updated to $${scheduledAmt}/mo.`,
      newAmount: scheduledAmt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle user self-cancellation of their standalone manual tiers.
 *
 * Why? Allow users to cancel standalone manual tiers from their dashboard,
 * triggering auto-tier recalculation.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function cancelUserTier(req, res, next) {
  try {
    const userId = req.user.userId;
    const tierId = parseInt(req.params.tierId, 10);

    if (isNaN(tierId)) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid Tier ID.' });
    }

    const existing = await prisma.userTier.findUnique({
      where: {
        userId_tierId: {
          userId,
          tierId,
        },
      },
      include: {
        tier: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'You do not hold this tier.' });
    }

    if (existing.assignedBy === 'AUTO_SUM') {
      return res.status(409).json({
        error: 'conflict',
        message: 'This tier is automatically assigned based on subscription amount and cannot be removed manually.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, monthlyAmount: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'User not found.' });
    }

    const newMonthlyAmount = Math.max(0, user.monthlyAmount - existing.tier.minAmount);

    // Update Stripe subscription
    if (newMonthlyAmount === 0) {
      if (!isMockMode && user.stripeCustomerId) {
        const activeSubs = await listActiveSubscriptions(user.stripeCustomerId);
        if (activeSubs.length > 0) {
          await stripe.subscriptions.update(activeSubs[0].id, {
            cancel_at_period_end: true,
          });
        }
      }
    } else {
      if (!isMockMode && user.stripeCustomerId) {
        const activeSubs = await listActiveSubscriptions(user.stripeCustomerId);
        if (activeSubs.length > 0) {
          const subscription = activeSubs[0];
          const subscriptionItemId = subscription.items.data[0].id;
          await stripe.subscriptions.update(subscription.id, {
            items: [{
              id: subscriptionItemId,
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'Monthly Donation - OpenmindProjects',
                },
                unit_amount: newMonthlyAmount * 100,
                recurring: { interval: 'month' },
              },
            }],
            proration_behavior: 'none',
          });
        }
      }
    }

    if (isMockMode) {
      process.stdout.write(JSON.stringify({
        level: 'INFO',
        ts: new Date().toISOString(),
        event: 'MOCK_SUBSCRIPTION_REDUCED_BY_TIER_CANCEL',
        userId: userId,
        email: user.email,
        oldAmountDollars: user.monthlyAmount,
        newAmountDollars: newMonthlyAmount,
      }) + '\n');
    }

    await prismaWrite.$transaction([
      prismaWrite.userTier.delete({
        where: {
          userId_tierId: {
            userId,
            tierId,
          },
        },
      }),
      prismaWrite.user.update({
        where: { id: userId },
        data: {
          monthlyAmount: newMonthlyAmount,
          scheduledAmount: null,
          scheduledAmountEffectiveDate: null,
        },
      }),
      prismaWrite.auditLog.create({
        data: {
          actorId: userId,
          targetUserId: userId,
          action: 'USER_SELF_CANCEL_TIER',
          oldValue: `Tier: "${existing.tier.name}" (ID: ${tierId}) — monthlyAmount: ${user.monthlyAmount}`,
          newValue: `Deleted by user self-cancellation — monthlyAmount reduced to: ${newMonthlyAmount}`,
        },
      }),
    ]);

    // Automatically recalculate auto-assigned tiers immediately
    await recalculateUserTiers(userId);

    return res.status(200).json({
      status: 'SUCCESS',
      message: `Tier "${existing.tier.name}" cancelled successfully and monthly donation reduced.`,
    });
  } catch (error) {
    next(error);
  }
}

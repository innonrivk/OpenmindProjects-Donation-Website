import prisma from '../../lib/prismaPublic.js';
import { stripe } from '../../services/stripe.js';
import { sendEmail } from '../../services/email.js';
import { resolveSettings, interpolate } from '../../services/receiptVariables.js';
import { recalculateUserTiers } from '../../services/tierAssignmentService.js';

/**
 * Handles payment_intent.succeeded stripe webhook events.
 *
 * Why? Separates one-time ledger operations to keep the router file short
 * and below line count limits.
 *
 * @param {Object} paymentIntent - Stripe PaymentIntent object.
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  const customerId = paymentIntent.customer;
  const amountPaid = paymentIntent.amount; // in cents

  // Ignore payment intents created by subscription invoices
  if (paymentIntent.invoice) {
    console.log(`ℹ️ [WEBHOOK] Ignoring payment_intent.succeeded since it belongs to subscription invoice: ${paymentIntent.invoice}`);
    return;
  }

  // Idempotency check: Guard against duplicate processing
  if (paymentIntent.id) {
    const existing = await prisma.transaction.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });
    if (existing) {
      console.warn(`⚠️  Duplicate webhook ignored for PaymentIntent: ${paymentIntent.id}`);
      return;
    }
  }

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          userId: user.id,
          stripeInvoiceId: null,
          stripePaymentIntentId: paymentIntent.id,
          amount: amountPaid,
          status: 'SUCCEEDED',
          isRecurring: false,
        },
      });
    });

    console.log(`✅ One-time payment recorded: $${(amountPaid / 100).toFixed(2)} from ${user.email}`);

    // Recalculate user tiers after one-time payment is committed
    try {
      await recalculateUserTiers(user.id);
    } catch (err) {
      console.error('Failed to recalculate user tiers on payment intent success:', err);
    }

    // Send receipt in the background
    setTimeout(async () => {
      try {
        const donorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Donor';
        const settings = await resolveSettings('ONE_TIME');

        const formattedVariables = {
          donorName,
          amount: `$${(amountPaid / 100).toFixed(2)}`,
          tierName: 'One-Time Supporter',
          date: new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          }),
          transactionId: paymentIntent.id,
          transactionSubject: '',
          country: user.country || 'Not specified',
        };

        const finalSubject = interpolate(settings.emailSubjectTemplate, formattedVariables);
        const pdfThankYouMessage = interpolate(settings.pdfThankYouMessage, formattedVariables);
        const pdfFooterNote = interpolate(settings.pdfFooterNote, formattedVariables);
        const pdfSignatureName = interpolate(settings.pdfSignatureName, formattedVariables);

        await sendEmail({
          to: user.email,
          subject: finalSubject,
          title: 'Donation Receipt',
          messageText: `Hi ${user.firstName || 'Donor'}, thank you for your generous support of $${(amountPaid / 100).toFixed(2)}. Your contribution goes directly towards our active projects.`,
          receiptData: {
            amount: amountPaid,
            transactionId: paymentIntent.id,
            date: new Date().toISOString(),
            donorName,
            donorEmail: user.email,
            country: user.country || 'Not specified',
            tierName: 'One-Time Supporter',
            tierPerks: ['One-time support', 'Counted in milestones & total donation amount'],
            isRecurring: false,
            pdfThankYouMessage,
            pdfFooterNote,
            pdfSignatureName,
          }
        });
      } catch (bgErr) {
        console.error('❌ Background webhook one-time email dispatch failed:', bgErr.message);
      }
    }, 50);
  } else {
    console.warn(`⚠️  No user found for Stripe customer: ${customerId}`);
  }
}

/**
 * Handles invoice.payment_succeeded stripe webhook events.
 *
 * Why? Promotes user subscription amounts and records transaction ledger entries.
 *
 * @param {Object} invoice - Stripe Invoice object.
 */
async function handleInvoicePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const amountPaid = invoice.amount_paid; // in cents

  if (invoice.id) {
    const existing = await prisma.transaction.findUnique({
      where: { stripeInvoiceId: invoice.id },
    });
    if (existing) {
      console.warn(`⚠️  Duplicate webhook ignored for invoice: ${invoice.id}`);
      return;
    }
  }

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          userId: user.id,
          stripeInvoiceId: invoice.id,
          stripePaymentIntentId: invoice.payment_intent,
          amount: amountPaid,
          status: 'SUCCEEDED',
          isRecurring: true,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          monthlyAmount: Math.floor(amountPaid / 100),
          scheduledAmount: null,
          scheduledAmountEffectiveDate: null,
        },
      });
    });

    // Recalculate user tiers after invoice payment is committed
    try {
      await recalculateUserTiers(user.id);
    } catch (err) {
      console.error('Failed to recalculate user tiers on invoice payment success:', err);
    }

    if (global.scheduledSubscriptionUpdates) {
      global.scheduledSubscriptionUpdates.delete(user.id);
    }

    console.log(`✅ Payment recorded and database synchronized: $${(amountPaid / 100).toFixed(2)} from ${user.email}`);

    setTimeout(async () => {
      try {
        const amountDollars = Math.floor(amountPaid / 100);
        let tierName = 'Supporter';
        let tierPerks = [];
        let tierId = null;

        try {
          // First try to find a donation box linked to a tier that has this override amount
          const overrideBox = await prisma.donationBox.findFirst({
            where: {
              amount: amountDollars,
              tierId: { not: null },
              isActive: true,
            },
            include: { tier: true },
          });

          let tier = overrideBox?.tier;

          if (!tier) {
            // Fall back to standard range-based lookup
            tier = await prisma.tier.findFirst({
              where: {
                minAmount: { lte: amountDollars },
                OR: [{ maxAmount: null }, { maxAmount: { gte: amountDollars } }],
              },
              orderBy: { tierLevel: 'desc' },
            });
          }

          if (tier) {
            tierName = tier.name;
            tierId = tier.id;
            tierPerks = Array.isArray(tier.perks) ? tier.perks : JSON.parse(tier.perks || '[]');
          }
        } catch (tierErr) {
          console.error('Failed to resolve tier for Stripe webhook receipt:', tierErr.message);
        }

        const donorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Donor';
        const settings = await resolveSettings('RECURRING', tierId);

        const formattedVariables = {
          donorName,
          amount: `$${(amountPaid / 100).toFixed(2)}`,
          tierName,
          date: new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          }),
          transactionId: invoice.id,
          transactionSubject: '',
          country: user.country || 'Not specified',
        };

        const finalSubject = interpolate(settings.emailSubjectTemplate, formattedVariables);
        const pdfThankYouMessage = interpolate(settings.pdfThankYouMessage, formattedVariables);
        const pdfFooterNote = interpolate(settings.pdfFooterNote, formattedVariables);
        const pdfSignatureName = interpolate(settings.pdfSignatureName, formattedVariables);

        await sendEmail({
          to: user.email,
          subject: finalSubject,
          title: 'Donation Receipt',
          messageText: `Hi ${user.firstName || 'Donor'}, thank you for your generous support of $${(amountPaid / 100).toFixed(2)}. Your contribution goes directly towards our active projects.`,
          receiptData: {
            amount: amountPaid,
            transactionId: invoice.id,
            date: new Date().toISOString(),
            donorName,
            donorEmail: user.email,
            country: user.country || 'Not specified',
            tierName,
            tierPerks,
            isRecurring: true,
            pdfThankYouMessage,
            pdfFooterNote,
            pdfSignatureName,
          }
        });
      } catch (bgErr) {
        console.error('❌ Background webhook email dispatch failed:', bgErr.message);
      }
    }, 50);
  } else {
    console.warn(`⚠️  No user found for Stripe customer: ${customerId}`);
  }
}

/**
 * Handles invoice.payment_failed stripe webhook events.
 *
 * Why? Logs failure status and flags unsuccessful payment attempts.
 *
 * @param {Object} invoice - Stripe Invoice object.
 */
async function handleInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: invoice.payment_intent,
        amount: invoice.amount_due,
        status: 'FAILED',
        isRecurring: true,
      },
    });

    console.log(`❌ Payment failed for ${user.email}`);
  }
}

/**
 * Handles customer.subscription.deleted stripe webhook events.
 *
 * Why? Resets database monthly recurring amount to zero upon subscription closure.
 *
 * @param {Object} subscription - Stripe Subscription object.
 */
async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  console.log(`🔔 Subscription cancelled: ${subscription.id}`);

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (user) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            monthlyAmount: 0,
            scheduledAmount: null,
            scheduledAmountEffectiveDate: null,
          },
        });

        // Why? Standalone tiers are tied to the subscription payment context.
        // When a subscription is cancelled, there's nothing left to fund them.
        await tx.userTier.deleteMany({
          where: { userId: user.id, assignedBy: 'MANUAL' },
        });
      });
      console.log(`🔄 Reset monthlyAmount and deleted manual tiers for ${user.email} due to subscription cancellation.`);

      // Recalculate user tiers after subscription is deleted
      await recalculateUserTiers(user.id);
    } catch (err) {
      console.error('Failed to handle subscription cancellation:', err);
    }
  }
}

/**
 * Unified controller entry point for incoming Stripe webhooks.
 *
 * Why? Performs routing to specialized sub-handlers to keep file size small.
 * Signature verification is hardened: unverified parsing is only allowed
 * in non-production environments (Risk D fix).
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function handleWebhookEvent(req, res, next) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else if (process.env.NODE_ENV !== 'production') {
      // Dev/test only: parse without signature verification
      event = JSON.parse(req.body.toString());
      console.warn('⚠️  Webhook signature verification SKIPPED (dev mode — no STRIPE_WEBHOOK_SECRET)');
    } else {
      // Production without a webhook secret = refuse to process
      return res.status(400).json({ error: 'Webhook secret not configured. Cannot verify signature in production.' });
    }
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`ℹ️  Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
  }

  res.json({ received: true });
}

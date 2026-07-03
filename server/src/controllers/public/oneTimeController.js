import prisma from '../../lib/prismaPublic.js';
import { stripe, isMockMode, upsertStripeCustomer } from '../../services/stripe.js';
import { z } from 'zod';
import crypto from 'crypto';

const OneTimeSchema = z.object({
  email:           z.string().email('Valid email is required'),
  firstName:       z.string().min(1, 'First name is required').max(80),
  lastName:        z.string().min(1, 'Last name is required').max(80),
  country:         z.string().min(2, 'Please select a country').max(60),
  paymentMethodId: z.string().startsWith('pm_', 'Invalid payment method'),
  amount:          z.number().int().min(1, 'Minimum donation is $1'), // dollars
  donationBoxId:   z.number().int().positive().optional().nullable(),
});

/**
 * Handles one-time donation checkout requests.
 *
 * Why? Charges the payment method immediately via Stripe PaymentIntent (or mock)
 * and records the one-time transaction in the ledger without affecting the
 * user's recurring monthly subscription amount.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function createOneTimeDonation(req, res, next) {
  try {
    console.log("\n\x1b[35m┌──────────────────────────────────────────────────────────┐\x1b[0m");
    console.log("\x1b[35m│ 📥 [BACKEND] Received one-time request on /one-time     │\x1b[0m");
    console.log("\x1b[35m└──────────────────────────────────────────────────────────┘\x1b[0m");

    const parseResult = OneTimeSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.log("├── ❌ [BACKEND] Validation failed!");
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid input. Please check the form fields.',
        fields: fieldErrors,
      });
    }

    const { email, firstName, lastName, country, paymentMethodId, amount, donationBoxId } = parseResult.data;
    const amountCents = amount * 100;
    console.log(`├── 🔎 [BACKEND] Validation succeeded for: \x1b[36m${email}\x1b[0m (One-time Amount: $${amount})`);

    // Upsert Stripe customer
    let user = await prisma.user.findUnique({ where: { email } });
    const existingCustomerId = user?.stripeCustomerId || undefined;

    const customer = await upsertStripeCustomer({
      email,
      name: `${firstName} ${lastName}`,
      paymentMethodId,
      existingCustomerId,
    });

    if (isMockMode) {
      const mockPiId = `pi_mock_${Math.random().toString(36).substring(7)}`;
      console.log(`├── 🔌 [STRIPE] (Mock) Generating mock PaymentIntent ${mockPiId}`);

      // Upsert User and record succeeded transaction
      await prisma.$transaction(async (tx) => {
        user = await tx.user.upsert({
          where: { email },
          create: {
            email,
            firstName,
            lastName,
            country,
            stripeCustomerId: customer.id,
            role: 'DONOR',
            monthlyAmount: 0, // new user defaults to 0 monthlyAmount
          },
          update: {
            firstName,
            lastName,
            country,
            stripeCustomerId: customer.id,
            // DO NOT update monthlyAmount for one-time donations
          },
        });

        if (donationBoxId) {
          const dbBox = await tx.donationBox.findUnique({
            where: { id: donationBoxId },
            select: { tierId: true, tier: { select: { isAutoAppliedBySum: true } } },
          });
          if (dbBox && dbBox.tierId && !dbBox.tier?.isAutoAppliedBySum) {
            await tx.userTier.upsert({
              where: {
                userId_tierId: {
                  userId: user.id,
                  tierId: dbBox.tierId,
                },
              },
              create: {
                userId: user.id,
                tierId: dbBox.tierId,
                assignedBy: 'MANUAL',
              },
              update: {
                assignedBy: 'MANUAL',
              },
            });
          }
        }

        await tx.transaction.create({
          data: {
            userId: user.id,
            stripePaymentIntentId: mockPiId,
            stripeInvoiceId: null,
            amount: amountCents,
            status: 'SUCCEEDED',
            isRecurring: false,
          },
        });
      });

      console.log("└── 🎉 One-time donation succeeded (mock mode)!");
      return res.status(201).json({
        success: true,
        paymentIntentId: mockPiId,
        status: 'succeeded',
      });
    }

    // Real Stripe Flow — Stable idempotency key (no Date.now)
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${email}:${amountCents}:${paymentMethodId}`)
      .digest('hex')
      .slice(0, 64);

    console.log(`├── 🔌 [STRIPE] Creating PaymentIntent (Idempotency Key: ${idempotencyKey.slice(0, 12)}…)`);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: customer.id,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    }, { idempotencyKey });

    // Handle initial outcomes of the PaymentIntent
    if (paymentIntent.status === 'succeeded') {
      await prisma.$transaction(async (tx) => {
        user = await tx.user.upsert({
          where: { email },
          create: {
            email,
            firstName,
            lastName,
            country,
            stripeCustomerId: customer.id,
            role: 'DONOR',
            monthlyAmount: 0,
          },
          update: {
            firstName,
            lastName,
            country,
            stripeCustomerId: customer.id,
          },
        });

        if (donationBoxId) {
          const dbBox = await tx.donationBox.findUnique({
            where: { id: donationBoxId },
            select: { tierId: true, tier: { select: { isAutoAppliedBySum: true } } },
          });
          if (dbBox && dbBox.tierId && !dbBox.tier?.isAutoAppliedBySum) {
            await tx.userTier.upsert({
              where: {
                userId_tierId: {
                  userId: user.id,
                  tierId: dbBox.tierId,
                },
              },
              create: {
                userId: user.id,
                tierId: dbBox.tierId,
                assignedBy: 'MANUAL',
              },
              update: {
                assignedBy: 'MANUAL',
              },
            });
          }
        }

        await tx.transaction.create({
          data: {
            userId: user.id,
            stripePaymentIntentId: paymentIntent.id,
            stripeInvoiceId: null,
            amount: amountCents,
            status: 'SUCCEEDED',
            isRecurring: false,
          },
        });
      });

      return res.status(201).json({
        success: true,
        paymentIntentId: paymentIntent.id,
        status: 'succeeded',
      });
    }

    if (paymentIntent.status === 'requires_action') {
      // Return client secret to confirm on frontend
      return res.status(202).json({
        success: true,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: 'requires_action',
      });
    }

    return res.status(400).json({
      error: 'payment_failed',
      message: `Payment failed with status: ${paymentIntent.status}`,
    });

  } catch (error) {
    console.error('One-time checkout error:', error);
    if (error.type === 'StripeCardError') {
      return res.status(402).json({
        error: error.code || 'card_error',
        message: error.message,
      });
    }
    next(error);
  }
}

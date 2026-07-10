import prisma from '../../lib/prisma.js';
import { generateReceiptPdf } from '../../services/receiptPdf.js';
import { resolveSettings, interpolate } from '../../services/receiptVariables.js';
import { z } from 'zod';

const SampleReceiptSchema = z.object({
  pdfThankYouMessage: z.string().max(500).optional(),
  pdfFooterNote: z.string().max(300).optional(),
  pdfSignatureName: z.string().max(100).optional(),
  isRecurring: z.boolean().default(true),
  tierName: z.string().max(100).optional(),
});

/**
 * Generates and downloads the PDF receipt for a specific transaction.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function downloadTransactionReceipt(req, res, next) {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Transaction not found.',
      });
    }

    const user = transaction.user;
    let tierName = 'One-Time Donation';
    let tierPerks = [];
    let tierId = null;

    if (transaction.isRecurring) {
      const amountDollars = user.monthlyAmount ? user.monthlyAmount : Math.floor(transaction.amount / 100);
      tierName = 'Supporter';

      try {
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
          tier = await prisma.tier.findFirst({
            where: {
              minAmount: { lte: amountDollars },
              OR: [
                { maxAmount: null },
                { maxAmount: { gte: amountDollars } },
              ],
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
        console.error('Failed to fetch tier for receipt download:', tierErr);
      }
    }

    const settings = await resolveSettings(transaction.isRecurring ? 'RECURRING' : 'ONE_TIME', tierId);

    const formattedVariables = {
      donorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Donor',
      amount: `$${(transaction.amount / 100).toFixed(2)}`,
      tierName,
      date: new Date(transaction.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      }),
      transactionId: transaction.stripeInvoiceId || transaction.id,
      transactionSubject: transaction.subject || '',
      country: user.country || 'Not specified',
    };

    const pdfThankYouMessage = interpolate(settings.pdfThankYouMessage, formattedVariables);
    const pdfFooterNote = interpolate(settings.pdfFooterNote, formattedVariables);
    const pdfSignatureName = interpolate(settings.pdfSignatureName, formattedVariables);

    const receiptData = {
      amount: transaction.amount,
      transactionId: transaction.stripeInvoiceId || transaction.id,
      date: transaction.createdAt,
      donorName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      donorEmail: user.email,
      country: user.country || 'Not specified',
      tierName,
      tierPerks,
      isRecurring: transaction.isRecurring,
      pdfThankYouMessage,
      pdfFooterNote,
      pdfSignatureName,
    };

    const pdfBuffer = await generateReceiptPdf(receiptData);

    const dateFormatted = new Date(transaction.createdAt).toISOString().slice(0, 10);
    const lastName = user.lastName || 'Unknown';
    const filename = `OMP-receipt-${lastName}-${dateFormatted}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

/**
 * Generates and downloads a sample PDF receipt using the provided template settings.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function downloadSampleReceipt(req, res, next) {
  try {
    const parsed = SampleReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid sample receipt parameters.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { pdfThankYouMessage, pdfFooterNote, pdfSignatureName, isRecurring, tierName } = parsed.data;

    const resolvedTierName = tierName || (isRecurring ? 'Shareholder' : 'One-Time Supporter');

    const mockVariables = {
      donorName: 'Jane Doe',
      amount: '$85.00',
      tierName: resolvedTierName,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      }),
      transactionId: 'TXN_SAMPLE_123456',
      transactionSubject: 'Sample Donation Project',
      country: 'United States',
    };

    const finalThankYou = interpolate(pdfThankYouMessage || 'We appreciate your generous support.', mockVariables);
    const finalFooter = interpolate(pdfFooterNote || 'This PDF is your official donation receipt. Please retain for your records.', mockVariables);
    const finalSignature = interpolate(pdfSignatureName || 'The OpenmindProjects Team', mockVariables);

    const receiptData = {
      amount: 8500, // $85 in cents
      transactionId: 'TXN_SAMPLE_123456',
      date: new Date().toISOString(),
      donorName: 'Jane Doe',
      donorEmail: 'jane.doe@example.com',
      country: 'United States',
      tierName: resolvedTierName,
      tierPerks: isRecurring ? [
        'Access to exclusive monthly donor newsletter',
        'VIP invites to annual project showcases',
        'Campaign creation voting rights'
      ] : [
        'One-time support',
        'Counted in milestones & total donation amount'
      ],
      isRecurring,
      pdfThankYouMessage: finalThankYou,
      pdfFooterNote: finalFooter,
      pdfSignatureName: finalSignature,
    };

    const pdfBuffer = await generateReceiptPdf(receiptData);

    const dateFormatted = new Date().toISOString().slice(0, 10);
    const filename = `OMP-receipt-sample-${dateFormatted}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

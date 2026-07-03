import { Router } from 'express';
import prisma from '../../lib/prismaPublic.js';
import { requireAuth } from '../../middleware/auth.js';
import { triggerAutomation } from '../../services/automationService.js';

const router = Router();

/**
 * POST /api/v1/public/milestones/claim
 * Write a ClaimedMilestone record for an unlocked milestone.
 */
router.post('/claim', requireAuth, async (req, res, next) => {
  try {
    const { milestoneId } = req.body;

    if (!milestoneId) {
      return res.status(400).json({ error: 'validation_error', message: 'Milestone ID is required.' });
    }

    // Verify milestone exists
    const milestone = await prisma.donationMilestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      return res.status(404).json({ error: 'milestone_not_found', message: 'Milestone not found.' });
    }

    // Execute eligibility check and claim creation inside a single transactional block to prevent race conditions
    const claimed = await prisma.$transaction(async (tx) => {
      const claimCount = await tx.claimedMilestone.count({
        where: {
          userId: req.user.userId,
          milestoneId,
        },
      });

      if (!milestone.isRepeatable && claimCount >= 1) {
        const err = new Error('ALREADY_CLAIMED');
        throw err;
      }

      // Verify user has reached the required lifetime amount for the specific track
      const targetTotalAgg = await tx.transaction.aggregate({
        where: {
          userId: req.user.userId,
          status: 'SUCCEEDED',
          isRecurring: !milestone.isRepeatable, // Repeatable milestones (isRepeatable: true) check one-time transactions (isRecurring: false)
        },
        _sum: { amount: true },
      });
      const currentTrackTotalDollars = (targetTotalAgg._sum.amount ?? 0) / 100;

      const requiredAmountDollars = milestone.isRepeatable
        ? (claimCount + 1) * milestone.amountUsd
        : milestone.amountUsd;

      if (currentTrackTotalDollars < requiredAmountDollars) {
        const msg = milestone.isRepeatable
          ? `You need a lifetime one-time total of $${requiredAmountDollars} to claim this repeatable milestone again. Current: $${currentTrackTotalDollars.toFixed(0)}.`
          : `You need a lifetime monthly total of $${milestone.amountUsd} to claim this milestone. Current: $${currentTrackTotalDollars.toFixed(0)}.`;
        const err = new Error('NOT_ELIGIBLE');
        err.details = msg;
        throw err;
      }

      return tx.claimedMilestone.create({
        data: {
          userId: req.user.userId,
          milestoneId,
        },
      });
    });

    // Resolve user context and trigger automation asynchronously in the background
    setImmediate(async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { firstName: true, lastName: true, email: true },
        });

        if (user) {
          const context = {
            donorName: `${user.firstName} ${user.lastName}`,
            donorEmail: user.email,
            milestoneLabel: milestone.label,
            milestoneAmount: milestone.amountUsd,
          };
          await triggerAutomation('MILESTONE_CLAIMED', context);
        }
      } catch (err) {
        process.stderr.write(
          JSON.stringify({
            level: 'ERROR',
            ts: new Date().toISOString(),
            event: 'MILESTONE_CLAIM_AUTOMATION_FAILURE',
            error: err.message,
          }) + '\n'
        );
      }
    });

    return res.status(201).json({
      status: 'CLAIMED',
      message: `Congratulations! You've claimed "${milestone.label}".`,
      claimedMilestone: {
        milestoneId: claimed.milestoneId,
        claimedAt: claimed.claimedAt,
      },
    });
  } catch (error) {
    if (error.message === 'ALREADY_CLAIMED') {
      return res.status(409).json({ error: 'already_claimed', message: 'You have already claimed this milestone.' });
    }
    if (error.message === 'NOT_ELIGIBLE') {
      return res.status(403).json({ error: 'not_eligible', message: error.details });
    }
    next(error);
  }
});

export default router;

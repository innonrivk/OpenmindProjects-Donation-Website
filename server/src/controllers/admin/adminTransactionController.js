import prisma from '../../lib/prisma.js';
import { buildTransactionWhere } from '../../lib/buildTransactionWhere.js';

/**
 * Fetch a paginated list of all transactions, optionally filtered by user subscription tiers.
 *
 * Why? Provides transaction logs for auditing and analytics in the CMS ledger.
 * Filters by user tier based on monthlyAmount to isolate transaction lists by tier levels.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getTransactions(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = (page - 1) * limit;

    const where = await buildTransactionWhere(req.query);

    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return res.status(200).json({
      transactions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetch aggregated financial metrics for the admin dashboard, optionally filtered by user subscription tiers.
 *
 * Why? Aggregates donor sums directly in the DB to avoid high memory overhead.
 * Scopes metrics by user tier range to allow precise cohort-based financial analysis.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getMetrics(req, res, next) {
  try {
    const donationType = req.query.donation_type;

    const txWhere = { status: 'SUCCEEDED' };
    const userWhere = { role: 'DONOR' };

    if (req.query.start_date || req.query.end_date) {
      const dateFilter = {};
      if (req.query.start_date) dateFilter.gte = new Date(req.query.start_date);
      if (req.query.end_date) dateFilter.lte = new Date(req.query.end_date);
      txWhere.createdAt = dateFilter;
      userWhere.createdAt = dateFilter;
    }

    if (donationType === 'MONTHLY') {
      txWhere.isRecurring = true;
    } else if (donationType === 'ONE_TIME') {
      txWhere.isRecurring = false;
    }

    if (donationType === 'MONTHLY') {
      userWhere.transactions = { some: { isRecurring: true } };
    } else if (donationType === 'ONE_TIME') {
      userWhere.transactions = { some: { isRecurring: false } };
    }

    // Resolve user tier if tierId is provided
    let tierIdParsed = null;
    if (req.query.tierId && req.query.tierId !== 'ALL') {
      const parsed = parseInt(req.query.tierId, 10);
      if (!isNaN(parsed)) {
        tierIdParsed = parsed;
      }
    }

    if (tierIdParsed !== null) {
      txWhere.user = {
        userTiers: {
          some: {
            tierId: tierIdParsed,
          },
        },
      };

      userWhere.userTiers = {
        some: {
          tierId: tierIdParsed,
        },
      };
    }

    // 1. Total succeeded donations (in cents)
    const totalDonatedAgg = await prisma.transaction.aggregate({
      where: txWhere,
      _sum: { amount: true },
    });
    const totalDonatedCents = totalDonatedAgg._sum.amount ?? 0;

    // 2. Count of unique donors
    const totalDonors = await prisma.user.count({
      where: userWhere,
    });

    // 3 & 4. Active Subscribers and MRR (always all-time metrics, return 0 for ONE_TIME)
    let activeSubscribers = 0;
    let projectedMrrUsd = 0;

    if (donationType !== 'ONE_TIME') {
      const subWhere = { role: 'DONOR', monthlyAmount: { gt: 0 } };
      if (tierIdParsed !== null) {
        subWhere.userTiers = {
          some: {
            tierId: tierIdParsed,
          },
        };
      }

      const [subCount, mrrAgg] = await Promise.all([
        prisma.user.count({
          where: subWhere,
        }),
        prisma.user.aggregate({
          where: subWhere,
          _sum: { monthlyAmount: true },
        }),
      ]);
      activeSubscribers = subCount;
      projectedMrrUsd = mrrAgg._sum.monthlyAmount ?? 0;
    }

    return res.status(200).json({
      totalDonatedCents,
      totalDonors,
      activeSubscribers,
      projectedMrrUsd,
    });
  } catch (error) {
    next(error);
  }
}

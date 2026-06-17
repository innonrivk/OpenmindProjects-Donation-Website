import prisma from '../../lib/prisma.js';
import { ErrorCodes } from '../../lib/errors.js';
import { z } from 'zod';

/**
 * Fetch a paginated list of all transactions.
 *
 * Why? Provides the transaction logs for auditing. Uses cursor or offset pagination
 * and supports optional filters like status or userId.
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

    const where = {};
    if (req.query.status) {
      where.status = req.query.status;
    }
    if (req.query.userId) {
      where.userId = req.query.userId;
    }

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
 * Fetch a single transaction by its ID.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getTransactionDetails(req, res, next) {
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
        error: ErrorCodes.NOT_FOUND,
        message: 'Transaction not found.',
      });
    }

    return res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
}

/**
 * Fetch aggregated financial metrics for the admin dashboard.
 *
 * Why? Aggregates donor sums directly in the DB to avoid high memory overhead.
 * Returns total donated, total donors, and active recurring statistics.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getMetrics(req, res, next) {
  try {
    // 1. Total succeeded donations (in cents)
    const totalDonatedAgg = await prisma.transaction.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true },
    });
    const totalDonatedCents = totalDonatedAgg._sum.amount ?? 0;

    // 2. Count of unique donors
    const totalDonors = await prisma.user.count({
      where: { role: 'DONOR' },
    });

    // 3. Count of active recurring subscriptions
    const activeSubscribers = await prisma.user.count({
      where: {
        role: 'DONOR',
        monthlyAmount: { gt: 0 },
      },
    });

    // 4. Monthly recurring revenue (MRR) projection in USD
    const mrrAgg = await prisma.user.aggregate({
      where: {
        role: 'DONOR',
        monthlyAmount: { gt: 0 },
      },
      _sum: { monthlyAmount: true },
    });
    const projectedMrrUsd = mrrAgg._sum.monthlyAmount ?? 0;

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

const TransactionMetaSchema = z.object({
  subject: z.string().max(100, 'Subject cannot exceed 100 characters').nullable().optional(),
  adminNote: z.string().max(500, 'Admin note cannot exceed 500 characters').nullable().optional(),
});

/**
 * Updates the subject and adminNote metadata fields of a transaction.
 * 
 * Why? Allows administrators to add internal reference notes and specify
 * custom donor-facing donation subject lines for receipt templating.
 * 
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function updateTransactionMeta(req, res, next) {
  try {
    const { id } = req.params;
    const parsed = TransactionMetaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid metadata fields.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { subject, adminNote } = parsed.data;

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        subject: subject !== undefined ? (subject === '' ? null : subject) : undefined,
        adminNote: adminNote !== undefined ? (adminNote === '' ? null : adminNote) : undefined,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: ErrorCodes.NOT_FOUND, message: 'Transaction not found.' });
    }
    next(error);
  }
}

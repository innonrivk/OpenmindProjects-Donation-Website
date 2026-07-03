import prisma from './prisma.js';

/**
 * Builds the Prisma where query filter object for transaction operations.
 *
 * Why? Centralizing this logic ensures consistent behavior between the regular
 * transaction retrieval endpoint and the Excel export endpoint, avoiding DRY
 * violations and synchronization issues.
 *
 * @param {object} query - The request query parameters object (req.query).
 * @returns {Promise<object>} The resolved Prisma where clause.
 */
export async function buildTransactionWhere(query) {
  const where = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.userId) {
    where.userId = query.userId;
  }

  if (query.start_date || query.end_date) {
    where.createdAt = {};
    if (query.start_date) {
      where.createdAt.gte = new Date(query.start_date);
    }
    if (query.end_date) {
      where.createdAt.lte = new Date(query.end_date);
    }
  }

  // Filter based on recurring status
  if (query.donation_type === 'MONTHLY') {
    where.isRecurring = true;
  } else if (query.donation_type === 'ONE_TIME') {
    where.isRecurring = false;
  }

  // Filter transactions by resolved user tiers using the userTiers join model
  if (query.tierId && query.tierId !== 'ALL') {
    const tierIdParsed = parseInt(query.tierId, 10);
    if (!isNaN(tierIdParsed)) {
      where.user = {
        userTiers: {
          some: {
            tierId: tierIdParsed,
          },
        },
      };
    }
  }

  return where;
}

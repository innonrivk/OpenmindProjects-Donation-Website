import { sendEmail } from '../services/email.js';
import { resolveSettings, interpolate } from '../services/receiptVariables.js';

/**
 * Structured logger to output indexable logs.
 * 
 * Why JSON? Machine-readable JSON logs are easily aggregated by log management
 * tools (such as Datadog or GCP Logging) without complex regex mapping.
 */
const logger = {
  info: (event, meta = {}) => {
    process.stdout.write(JSON.stringify({ level: 'INFO', ts: new Date().toISOString(), event, ...meta }) + '\n');
  },
  error: (event, meta = {}) => {
    process.stderr.write(JSON.stringify({ level: 'ERROR', ts: new Date().toISOString(), event, ...meta }) + '\n');
  }
};

/**
 * Extension module decorating the Prisma Client with automated trigger interceptors.
 * 
 * Intercepts user and transaction creation events to trigger welcome and receipt
 * emails. It safely bypasses real Stripe-sourced payments (which receive callbacks)
 * but executes immediately for mock transactions and manual entries.
 * 
 * @param {import('@prisma/client').PrismaClient} client - The raw Prisma Client.
 * @returns {import('@prisma/client').PrismaClient} Extended client with trigger middlewares.
 */
export function withEmailTrigger(client) {
  return client.$extends({
    query: {
      user: {
        async create({ args, query }) {
          // Dynamic seed extraction to bypass welcome emails in seed files
          const { skipWelcomeEmail, ...cleanData } = args.data;
          args.data = cleanData;

          const result = await query(args);

          if (!skipWelcomeEmail) {
            logger.info('USER_CREATE_TRIGGER_DETECTED', { userId: result.id, email: result.email });
            
            sendEmail({
              to: result.email,
              subject: 'Welcome to OpenmindProjects — You\'re making a difference!',
              title: `Welcome, ${result.firstName || 'Friend'}!`,
              messageText: `Hi ${result.firstName || ''}, thank you for joining OpenmindProjects. Your support helps fund real-world projects that matter. We're thrilled to have you on board.`
            }).catch((err) => {
              logger.error('WELCOME_EMAIL_TRIGGER_FAILED', { error: err.message, userId: result.id });
            });
          }

          return result;
        }
      },
      transaction: {
        async create({ args, query }) {
          const result = await query(args);

          // Deduplication Guard:
          // In production, Stripe webhooks trigger receipts. We bypass the ORM trigger
          // if stripePaymentIntentId exists to avoid duplicates.
          // BUT in development / mock mode (starts with 'pi_mock_'), webhooks never fire,
          // so we MUST process and trigger the email receipt immediately!
          const isMockTransaction = result.stripePaymentIntentId?.startsWith('pi_mock_');
          
          if (!result.stripePaymentIntentId || isMockTransaction) {
            logger.info('MANUAL_OR_MOCK_TRANSACTION_TRIGGER_DETECTED', { 
              transactionId: result.id, 
              userId: result.userId,
              isMock: isMockTransaction 
            });

            // Queue user resolution and email dispatch to the next event loop tick.
            // This ensures the calling transaction commits and releases the connection
            // back to the pool, preventing deadlocks when connection_limit = 1.
            setImmediate(async () => {
              try {
                const user = await client.user.findUnique({
                  where: { id: result.userId }
                });

                if (user && user.email) {
                  let tierName = 'One-Time Donation';
                  let tierPerks = [];
                  let tierId = null;

                  if (result.isRecurring) {
                    // Resolve the donor's active tier from the Tier table using monthlyAmount (already in dollars)
                    const amountDollars = user.monthlyAmount ? user.monthlyAmount : Math.floor(result.amount / 100);
                    tierName = 'Supporter';

                    try {
                      // First try to find a donation box linked to a tier that has this override amount
                      const overrideBox = await client.donationBox.findFirst({
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
                        tier = await client.tier.findFirst({
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
                        // perks is stored as a JSON array in SQLite
                        tierPerks = Array.isArray(tier.perks) ? tier.perks : JSON.parse(tier.perks || '[]');
                      }
                    } catch (tierErr) {
                      logger.error('TRANSACTION_RECEIPT_TIER_FETCH_FAILED', { error: tierErr.message, userId: user.id });
                    }
                  }

                  const settings = await resolveSettings(result.isRecurring ? 'RECURRING' : 'ONE_TIME', tierId);

                  const formattedVariables = {
                    donorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Donor',
                    amount: `$${(result.amount / 100).toFixed(2)}`,
                    tierName,
                    date: new Date(result.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    }),
                    transactionId: result.stripeInvoiceId || result.id,
                    transactionSubject: result.subject || '',
                    country: user.country || 'Not specified',
                  };

                  const finalSubject = interpolate(settings.emailSubjectTemplate, formattedVariables);
                  const pdfThankYouMessage = interpolate(settings.pdfThankYouMessage, formattedVariables);
                  const pdfFooterNote = interpolate(settings.pdfFooterNote, formattedVariables);
                  const pdfSignatureName = interpolate(settings.pdfSignatureName, formattedVariables);

                  // Dispatches sendEmail and catches errors safely
                  sendEmail({
                    to: user.email,
                    subject: finalSubject,
                    title: 'Donation Receipt',
                    messageText: `Hi ${user.firstName || 'Donor'}, thank you for your generous support of $${(result.amount / 100).toFixed(2)}. Your contribution goes directly towards our active projects.`,
                    receiptData: {
                      amount: result.amount,
                      transactionId: result.stripeInvoiceId || result.id,
                      date: result.createdAt,
                      donorName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                      donorEmail: user.email,
                      country: user.country || 'Not specified',
                      tierName,
                      tierPerks,
                      isRecurring: result.isRecurring,
                      pdfThankYouMessage,
                      pdfFooterNote,
                      pdfSignatureName,
                    }
                  }).catch((err) => {
                    logger.error('TRANSACTION_RECEIPT_TRIGGER_FAILED', { error: err.message, transactionId: result.id });
                  });
                } else {
                  logger.error('TRANSACTION_RECEIPT_USER_NOT_FOUND_OR_NO_EMAIL', { userId: result.userId, transactionId: result.id });
                }
              } catch (err) {
                logger.error('TRANSACTION_RECEIPT_USER_FETCH_FAILED', { error: err.message, transactionId: result.id });
              }
            });
          }

          return result;
        }
      }
    }
  });
}
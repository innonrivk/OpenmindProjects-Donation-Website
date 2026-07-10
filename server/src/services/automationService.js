import prisma from '../lib/prisma.js';
import { createInternalNotifications } from './notificationService.js';
import { communicationQueue } from '../workers/communicationQueue.js';

/**
 * Resolves and executes all automation rules matching a fired event.
 *
 * Why centralised here? Event-to-action resolution is the same regardless
 * of where the event originated (webhook, tier service, milestone endpoint).
 * Keeping it in one function prevents duplicated trigger-lookup logic.
 *
 * Called from: webhooksController.js (post-payment), tierAssignmentService.js
 * (post-tier-change), milestone claim endpoints.
 *
 * @param {string} eventName - Event identifier (DONATION_RECEIVED, TIER_REACHED, MILESTONE_CLAIMED).
 * @param {object} context - Interpolation context { donorName, donorEmail, amount, tierName, ... }.
 * @param {number|null} [tierId=null] - Optional tier scope for the event.
 * @returns {Promise<void>}
 */
export async function triggerAutomation(eventName, context, tierId = null) {
  try {
    const triggers = await prisma.automationTrigger.findMany({
      where: {
        eventName,
        isActive: true,
        OR: [
          { tierId: tierId },
          { tierId: null },
        ],
      },
      include: {
        template: true,
        adminAssignments: true,
      },
    });

    for (const trigger of triggers) {
      if (trigger.template.isArchived) continue;

      // Resolve recipients: donor first, then assigned admins
      const recipients = [];
      if (context.donorEmail) {
        const donorUser = await prisma.user.findUnique({
          where: { email: context.donorEmail },
          include: {
            transactions: {
              where: { status: 'SUCCEEDED' },
              take: 1,
            },
          },
        });

        const isDonor = donorUser && donorUser.role === 'DONOR';
        const hasDonated = donorUser && donorUser.transactions.length > 0;

        if (!isDonor || hasDonated) {
          recipients.push({ email: context.donorEmail, userId: 'donor' });
        } else {
          process.stdout.write(
            JSON.stringify({
              level: 'INFO',
              ts: new Date().toISOString(),
              event: 'AUTOMATION_DONOR_SKIPPED_NO_DONATIONS',
              email: context.donorEmail,
            }) + '\n'
          );
        }
      }

      // Notify admin roles assigned to this trigger
      let adminIds = [];
      if (trigger.adminAssignments.length > 0) {
        const roles = trigger.adminAssignments.map((a) => a.role);
        const adminUsers = await prisma.user.findMany({
          where: { role: { in: roles }, isActive: true },
          select: { id: true, email: true },
        });

        adminIds = adminUsers.map((u) => u.id);

        for (const admin of adminUsers) {
          recipients.push({ email: admin.email, userId: admin.id });
        }
      }

      // 1. Create internal notifications for the admins (appears in "this place")
      if (adminIds.length > 0) {
        await createInternalNotifications(
          adminIds,
          `Automation: ${eventName}`,
          `Event "${eventName}" triggered for ${context.donorName || 'a donor'}. Template: ${trigger.template.name}.`
        );
      }

      // 2. Dispatch emails to all resolved recipients (donor + admins)
      if (recipients.length > 0) {
        const log = await prisma.dispatchLog.create({
          data: {
            emailTemplateId: trigger.template.id,
            triggeredBy: 'SYSTEM',
            recipientCount: recipients.length,
            status: 'QUEUED',
          },
        });

        await prisma.dispatchRecipient.createMany({
          data: recipients.map((r) => ({
            dispatchId: log.id,
            email: r.email,
            status: 'QUEUED',
          })),
        });

        for (const recipient of recipients) {
          await communicationQueue.add('DISPATCH_EMAIL', {
            type: 'DISPATCH_EMAIL',
            payload: {
              to: recipient.email,
              template: trigger.template,
              context,
              logId: log.id,
            },
          });
        }
      }
    }
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        level: 'ERROR',
        ts: new Date().toISOString(),
        event: 'AUTOMATION_TRIGGER_FAILURE',
        eventName,
        error: err.message,
      }) + '\n'
    );
  }
}

import prisma from '../../lib/prisma.js';
import { sendTemplatedEmail } from '../../services/email.js';

/**
 * Lists all non-archived email templates.
 */
export async function listTemplates(req, res, next) {
  try {
    const templates = await prisma.emailTemplate.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(templates);
  } catch (err) { next(err); }
}

/**
 * Creates a new email template.
 */
export async function createTemplate(req, res, next) {
  try {
    const { name, subject, bodyHtml, pdfConfig } = req.body;
    if (!name || !subject || !bodyHtml) {
      return res.status(400).json({ error: 'name, subject, and bodyHtml are required.' });
    }
    const template = await prisma.emailTemplate.create({
      data: { name, subject, bodyHtml, pdfConfig: pdfConfig || undefined },
    });
    return res.status(201).json(template);
  } catch (err) { next(err); }
}

/**
 * Updates an existing email template.
 */
export async function updateTemplate(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, subject, bodyHtml, pdfConfig } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (subject !== undefined) data.subject = subject;
    if (bodyHtml !== undefined) data.bodyHtml = bodyHtml;
    if (pdfConfig !== undefined) data.pdfConfig = pdfConfig;

    const template = await prisma.emailTemplate.update({ where: { id }, data });
    return res.json(template);
  } catch (err) { next(err); }
}

/**
 * Soft-deletes a template. Returns 409 if active triggers reference it.
 */
export async function archiveTemplate(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const activeTriggers = await prisma.automationTrigger.count({
      where: { emailTemplateId: id, isActive: true },
    });
    if (activeTriggers > 0) {
      return res.status(409).json({
        error: 'conflict',
        message: `Cannot archive: ${activeTriggers} active automation rule(s) reference this template.`,
      });
    }
    const template = await prisma.emailTemplate.update({
      where: { id },
      data: { isArchived: true },
    });
    return res.json(template);
  } catch (err) { next(err); }
}

/**
 * Lists all automation triggers with linked templates and admin assignments.
 */
export async function listTriggers(req, res, next) {
  try {
    const triggers = await prisma.automationTrigger.findMany({
      include: { template: true, adminAssignments: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(triggers);
  } catch (err) { next(err); }
}

/**
 * Creates an automation trigger with admin role assignments.
 */
export async function createTrigger(req, res, next) {
  try {
    const { eventName, tierId, emailTemplateId, adminRoles } = req.body;
    if (!eventName || !emailTemplateId) {
      return res.status(400).json({ error: 'eventName and emailTemplateId are required.' });
    }

    const trigger = await prisma.automationTrigger.create({
      data: {
        eventName,
        tierId: tierId ? parseInt(tierId, 10) : null,
        emailTemplateId: parseInt(emailTemplateId, 10),
        adminAssignments: {
          create: (adminRoles || []).map((role) => ({ role })),
        },
      },
      include: { template: true, adminAssignments: true },
    });
    return res.status(201).json(trigger);
  } catch (err) { next(err); }
}

/**
 * Deletes an automation trigger and its cascade-deleted admin assignments.
 */
export async function deleteTrigger(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.automationTrigger.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) { next(err); }
}

/**
 * Manual batch dispatch — resolves recipients by role/tier and sends emails.
 */
export async function dispatchBatch(req, res, next) {
  try {
    const { templateId, targetRoles, targetTiers } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required.' });
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { id: parseInt(templateId, 10) },
    });
    if (!template || template.isArchived) {
      return res.status(404).json({ error: 'Template not found or archived.' });
    }

    const userWhere = { isActive: true };
    const conditions = [];

    if (targetRoles?.length) {
      conditions.push({ role: { in: targetRoles } });
    }
    if (targetTiers?.length) {
      const tierIds = targetTiers.map((t) => parseInt(t, 10));
      conditions.push({ userTiers: { some: { tierId: { in: tierIds } } } });
    }
    if (conditions.length) {
      userWhere.OR = conditions;
    }

    const recipients = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    const log = await prisma.dispatchLog.create({
      data: {
        emailTemplateId: template.id,
        triggeredBy: req.adminUser.userId,
        recipientCount: recipients.length,
        status: 'QUEUED',
      },
    });

    // Fire-and-forget async dispatch
    setImmediate(async () => {
      let sentCount = 0;
      let failCount = 0;
      for (const user of recipients) {
        try {
          const context = {
            donorName: `${user.firstName} ${user.lastName}`,
            donorEmail: user.email,
          };
          await sendTemplatedEmail(user.email, template, context);
          sentCount++;
        } catch {
          failCount++;
        }
      }
      const status = failCount === 0 ? 'SENT' : sentCount === 0 ? 'FAILED' : 'PARTIAL';
      await prisma.dispatchLog.update({
        where: { id: log.id },
        data: { status, errorMessage: failCount > 0 ? `${failCount} failed` : null },
      });
    });

    return res.json({ logId: log.id, recipientCount: recipients.length });
  } catch (err) { next(err); }
}

/**
 * Paginated dispatch log listing.
 */
export async function listDispatchLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [items, total] = await Promise.all([
      prisma.dispatchLog.findMany({
        include: { template: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dispatchLog.count(),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) { next(err); }
}

/**
 * Fetches a single dispatch log by ID.
 */
export async function getDispatchLog(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const log = await prisma.dispatchLog.findUnique({
      where: { id },
      include: { template: { select: { name: true } } },
    });
    if (!log) {
      return res.status(404).json({ error: 'Log not found.' });
    }
    return res.json(log);
  } catch (err) { next(err); }
}

/**
 * Permanently deletes a template and all its dependencies inside a Prisma transaction.
 */
export async function deleteTemplate(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    await prisma.$transaction([
      prisma.automationTrigger.deleteMany({
        where: { emailTemplateId: id },
      }),
      prisma.dispatchLog.deleteMany({
        where: { emailTemplateId: id },
      }),
      prisma.emailTemplate.delete({
        where: { id },
      }),
    ]);

    return res.json({ success: true });
  } catch (err) { next(err); }
}


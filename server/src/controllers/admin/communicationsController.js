import prisma from '../../lib/prisma.js';
import { sendTemplatedEmail } from '../../services/email.js';
import { communicationQueue } from '../../workers/communicationQueue.js';
import ExcelJS from 'exceljs';

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

    // Exclude DONOR users with 0 successful donations (unique users)
    userWhere.AND = [
      {
        OR: [
          { role: { not: 'DONOR' } },
          { transactions: { some: { status: 'SUCCEEDED' } } },
        ],
      },
    ];

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

    if (recipients.length > 0) {
      await prisma.dispatchRecipient.createMany({
        data: recipients.map((u) => ({
          dispatchId: log.id,
          email: u.email,
          status: 'QUEUED',
        })),
      });
    }

    // Fire-and-forget async dispatch via worker queue fallback
    for (const user of recipients) {
      await communicationQueue.add('DISPATCH_EMAIL', {
        type: 'DISPATCH_EMAIL',
        payload: {
          to: user.email,
          template,
          context: {
            donorName: `${user.firstName} ${user.lastName}`.trim(),
            donorEmail: user.email,
          },
          logId: log.id,
        },
      });
    }

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

/**
 * Retrieves recipient details linked to a dispatch log.
 * Pagination is enforced here to prevent high-recipient batch emails from bloating memory
 * or causing sluggish responses under large data sets.
 */
export async function getDispatchLogRecipients(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const log = await prisma.dispatchLog.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!log) {
      return res.status(404).json({ error: 'Log not found.' });
    }

    const [items, total] = await Promise.all([
      prisma.dispatchRecipient.findMany({
        where: { dispatchId: id },
        orderBy: { email: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dispatchRecipient.count({
        where: { dispatchId: id },
      }),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) { next(err); }
}

/**
 * Generates and downloads a CSV export containing all recipients of a dispatch log.
 *
 * Why CSV format? CSV is supported by all spreadsheet tools (like Excel or Sheets)
 * and doesn't require importing heavy third-party XLSX writer libraries to the server.
 * Special characters in emails or error messages are properly escaped to prevent CSV injection
 * and formatting breakage.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
/**
 * Exports all recipients of a dispatch log as a formatted Excel (.xlsx) workbook.
 *
 * Why Excel instead of CSV?
 * Excel allows rich formatting (colours, bold, freeze panes) so admins can immediately
 * spot failed deliveries without opening a separate tool. ExcelJS is already installed
 * for the transactions export, so there is zero additional dependency cost.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function exportDispatchLogRecipients(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const log = await prisma.dispatchLog.findUnique({
      where: { id },
      include: { template: { select: { name: true } } },
    });
    if (!log) {
      return res.status(404).json({ error: 'Log not found.' });
    }

    const recipients = await prisma.dispatchRecipient.findMany({
      where: { dispatchId: id },
      orderBy: { email: 'asc' },
    });

    // ── Build Excel Workbook ──
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OpenmindProjects';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Recipient Audit Log');

    // 1. Metadata header block (rows 1-6)
    const meta = [
      ['Dispatch Log ID', log.id],
      ['Template Name', log.template?.name || 'Manual Batch'],
      ['Triggered By', log.triggeredBy],
      ['Sent Date', log.createdAt.toLocaleString()],
      ['Total Recipients', log.recipientCount],
    ];
    meta.forEach(([label, value], i) => {
      const row = sheet.getRow(i + 1);
      row.getCell(1).value = label;
      row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
      row.getCell(2).value = value;
      row.getCell(2).font = { name: 'Arial', size: 10, color: { argb: 'FF1E293B' } };
    });

    // 2. Column header row (row 7)
    const headerRow = sheet.getRow(7);
    headerRow.values = ['Recipient ID', 'Email Address', 'Status', 'Error Details'];
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.height = 24;
    headerRow.alignment = { vertical: 'middle' };

    // Column widths
    sheet.getColumn(1).width = 14;
    sheet.getColumn(2).width = 36;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 40;

    // Freeze everything above the data
    sheet.views = [{ state: 'frozen', ySplit: 7 }];

    // Status colour map
    const STATUS_FILL = {
      SENT: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, // green tint
      FAILED: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, // red tint
      QUEUED: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }, // amber tint
    };

    // 3. Data rows starting at row 8
    recipients.forEach((recipient, idx) => {
      const dataRow = sheet.addRow([
        recipient.id,
        recipient.email,
        recipient.status,
        recipient.errorReason || '—',
      ]);
      dataRow.font = { name: 'Arial', size: 10 };
      dataRow.height = 20;
      dataRow.alignment = { vertical: 'middle' };

      // Zebra striping on even rows
      if (idx % 2 === 1) {
        dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }

      // Override status cell with semantic colour
      const statusCell = dataRow.getCell(3);
      const fill = STATUS_FILL[recipient.status];
      if (fill) {
        statusCell.fill = fill;
        statusCell.font = { name: 'Arial', size: 10, bold: true };
      }
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // 4. Stream response
    const filename = `dispatch-recipients-${id}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buffer = await workbook.xlsx.writeBuffer();
    return res.status(200).send(buffer);
  } catch (err) { next(err); }
}




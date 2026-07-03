import prisma from '../../lib/prisma.js';
import { ErrorCodes } from '../../lib/errors.js';
import { z } from 'zod';

/**
 * Fetch a single transaction by its ID.
 *
 * Why? Allows administrators to view detailed metadata and links for a specific transaction.
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

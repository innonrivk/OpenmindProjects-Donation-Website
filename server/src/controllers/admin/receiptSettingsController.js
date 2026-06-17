import prisma from '../../lib/prisma.js';
import { z } from 'zod';
import { ErrorCodes } from '../../lib/errors.js';

const ReceiptSettingsSchema = z.object({
  emailSubjectTemplate: z.string().min(3, 'Subject template must be at least 3 characters').max(200, 'Subject template cannot exceed 200 characters'),
  pdfThankYouMessage:   z.string().max(500, 'Thank you message cannot exceed 500 characters'),
  pdfFooterNote:        z.string().max(300, 'Footer note cannot exceed 300 characters'),
  pdfSignatureName:     z.string().max(100, 'Signature name cannot exceed 100 characters'),
});

/**
 * Retrieves all receipt settings configurations, sorting them with GLOBAL first,
 * then specific types, then tiers, ensuring structured frontend rendering.
 * 
 * Why? Returning all settings in a single list enables the settings editor
 * to load and manage all custom receipt variations in one unified view.
 * 
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getReceiptSettings(req, res, next) {
  try {
    const settings = await prisma.receiptSettings.findMany();
    return res.status(200).json(settings);
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves a single receipt settings configuration by its donation type.
 * 
 * Why? Allows granular loading of templates when navigating sections or
 * requesting specific live previews on the admin dashboard.
 * 
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getReceiptSettingsByType(req, res, next) {
  try {
    const { type } = req.params;
    const settings = await prisma.receiptSettings.findUnique({
      where: { donationType: type },
    });
    if (!settings) {
      return res.status(404).json({
        error: ErrorCodes.NOT_FOUND,
        message: 'Receipt settings not found for this donation type.',
      });
    }
    return res.status(200).json(settings);
  } catch (error) {
    next(error);
  }
}

/**
 * Creates or updates (upserts) the receipt settings for a given donation type.
 * 
 * Why? Upserting ensures that admins can freely override global defaults for
 * specific donation types or tiers without needing an explicit create-first step.
 * 
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function updateReceiptSettings(req, res, next) {
  try {
    const { type } = req.params;
    const parsed = ReceiptSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid receipt settings data.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { emailSubjectTemplate, pdfThankYouMessage, pdfFooterNote, pdfSignatureName } = parsed.data;

    const upserted = await prisma.receiptSettings.upsert({
      where: { donationType: type },
      update: {
        emailSubjectTemplate,
        pdfThankYouMessage,
        pdfFooterNote,
        pdfSignatureName,
      },
      create: {
        donationType: type,
        emailSubjectTemplate,
        pdfThankYouMessage,
        pdfFooterNote,
        pdfSignatureName,
      },
    });

    return res.status(200).json(upserted);
  } catch (error) {
    next(error);
  }
}

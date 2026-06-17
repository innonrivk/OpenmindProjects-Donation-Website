import prisma from '../../lib/prisma.js';
import { z } from 'zod';
import { ErrorCodes } from '../../lib/errors.js';

/**
 * Zod schema for WebsiteContent payloads.
 * Why optional fields? Partial updates allow admins to modify only
 * the fields they need without resending the entire content block.
 */
const WebsiteContentSchema = z.object({
  head: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  version: z.number().int().optional(),
});

/**
 * Zod schema for DonationBox payloads.
 * Why tierId is nullable? Custom-amount boxes are not associated with
 * any tier — they allow donors to input an arbitrary amount.
 */
const DonationBoxSchema = z.object({
  title: z.string().optional().default(''),
  amount: z.number().int().min(0, 'Amount must be at least 0'),
  tierId: z.number().int().nullable().optional(),
  tierDetails: z.string().optional().default(''),
  perks: z.array(z.string()).optional().default([]),
  buttonText: z.string().optional().default('Donate'),
  isCustomAmount: z.boolean().optional().default(false),
  isRecurring: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.number().int().optional().default(0),
});

// --- WebsiteContent CRUD ---

export async function getContents(req, res, next) {
  try {
    const contents = await prisma.websiteContent.findMany({
      orderBy: { id: 'desc' },
    });
    return res.status(200).json(contents);
  } catch (error) {
    next(error);
  }
}

export async function createContent(req, res, next) {
  try {
    const parsed = WebsiteContentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid content data.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const newContent = await prisma.websiteContent.create({
      data: parsed.data,
    });
    return res.status(201).json(newContent);
  } catch (error) {
    next(error);
  }
}

export async function updateContent(req, res, next) {
  try {
    const { id } = req.params;
    const parsed = WebsiteContentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid content data.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const contentId = parseInt(id, 10);
    if (isNaN(contentId)) {
      return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Invalid content ID.' });
    }

    const updated = await prisma.websiteContent.update({
      where: { id: contentId },
      data: parsed.data,
    });
    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: ErrorCodes.NOT_FOUND, message: 'Content not found.' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: ErrorCodes.CONFLICT,
        message: `A content record with this ${error.meta?.target?.join(', ') || 'field'} already exists.`,
      });
    }
    next(error);
  }
}

export async function deleteContent(req, res, next) {
  try {
    const { id } = req.params;
    const contentId = parseInt(id, 10);
    if (isNaN(contentId)) {
      return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Invalid content ID.' });
    }

    await prisma.websiteContent.delete({
      where: { id: contentId },
    });
    return res.status(200).json({ message: 'Content deleted successfully.' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: ErrorCodes.NOT_FOUND, message: 'Content not found.' });
    }
    next(error);
  }
}

// --- DonationBox CRUD ---

/**
 * Why include tier? The admin dashboard needs to display which tier is
 * linked to each donation box without a separate API call.
 */
export async function getDonationBoxes(req, res, next) {
  try {
    const boxes = await prisma.donationBox.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { tier: true },
    });
    return res.status(200).json(boxes);
  } catch (error) {
    next(error);
  }
}

export async function createDonationBox(req, res, next) {
  try {
    const parsed = DonationBoxSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid donation box data.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const newBox = await prisma.donationBox.create({
      data: parsed.data,
      include: { tier: true },
    });
    return res.status(201).json(newBox);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: ErrorCodes.CONFLICT,
        message: `A donation box with this ${error.meta?.target?.join(', ') || 'field'} already exists.`,
      });
    }
    next(error);
  }
}

export async function updateDonationBox(req, res, next) {
  try {
    const { id } = req.params;
    const parsed = DonationBoxSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid donation box data.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const boxId = parseInt(id, 10);
    if (isNaN(boxId)) {
      return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Invalid box ID.' });
    }

    const updated = await prisma.donationBox.update({
      where: { id: boxId },
      data: parsed.data,
      include: { tier: true },
    });
    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: ErrorCodes.NOT_FOUND, message: 'Donation box not found.' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: ErrorCodes.CONFLICT,
        message: `A donation box with this ${error.meta?.target?.join(', ') || 'field'} already exists.`,
      });
    }
    next(error);
  }
}

export async function deleteDonationBox(req, res, next) {
  try {
    const { id } = req.params;
    const boxId = parseInt(id, 10);
    if (isNaN(boxId)) {
      return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Invalid box ID.' });
    }

    await prisma.donationBox.delete({
      where: { id: boxId },
    });
    return res.status(200).json({ message: 'Donation box deleted successfully.' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: ErrorCodes.NOT_FOUND, message: 'Donation box not found.' });
    }
    next(error);
  }
}

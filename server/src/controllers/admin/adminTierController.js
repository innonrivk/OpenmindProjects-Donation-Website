import prisma from '../../lib/prisma.js';
import { z } from 'zod';
import { ErrorCodes } from '../../lib/errors.js';
import { recalculateAllUsersTiers } from '../../services/tierAssignmentService.js';

const TierSchema = z.object({
  tierLevel: z.number().int().min(1, 'Tier level must be at least 1'),
  name: z.string().min(1, 'Name is required'),
  minAmount: z.number().int().min(0, 'Min amount must be at least 0'), // dollars
  maxAmount: z.number().int().min(0, 'Max amount must be at least 0').nullable().optional(), // dollars
  perks: z.array(z.string()).optional().or(z.string().transform((str) => JSON.parse(str))),
  isAutoAppliedBySum: z.boolean().optional().default(false),
});

export async function getTiers(req, res, next) {
  try {
    const tiers = await prisma.tier.findMany({
      orderBy: { tierLevel: 'asc' },
    });
    return res.status(200).json(tiers);
  } catch (error) {
    next(error);
  }
}

export async function createTier(req, res, next) {
  try {
    const parsed = TierSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid tier data.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;
    const perksJson = Array.isArray(data.perks) ? JSON.stringify(data.perks) : (data.perks || '[]');

    const newTier = await prisma.tier.create({
      data: {
        tierLevel: data.tierLevel,
        name: data.name,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount ?? null,
        isAutoAppliedBySum: data.isAutoAppliedBySum,
        perks: perksJson,
      },
    });

    // Recalculate all user tiers asynchronously
    setImmediate(() => recalculateAllUsersTiers());

    return res.status(201).json(newTier);
  } catch (error) {
    next(error);
  }
}

export async function updateTier(req, res, next) {
  try {
    const { id } = req.params;
    const parsed = TierSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid tier data.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const tierId = parseInt(id, 10);
    if (isNaN(tierId)) {
      return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Invalid tier ID.' });
    }

    const data = parsed.data;
    const perksJson = Array.isArray(data.perks) ? JSON.stringify(data.perks) : (data.perks || '[]');

    const updated = await prisma.tier.update({
      where: { id: tierId },
      data: {
        tierLevel: data.tierLevel,
        name: data.name,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount ?? null,
        isAutoAppliedBySum: data.isAutoAppliedBySum,
        perks: perksJson,
      },
    });

    // Recalculate all user tiers asynchronously
    setImmediate(() => recalculateAllUsersTiers());

    return res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: ErrorCodes.NOT_FOUND, message: 'Tier not found.' });
    }
    next(error);
  }
}

export async function deleteTier(req, res, next) {
  try {
    const { id } = req.params;
    const tierId = parseInt(id, 10);
    if (isNaN(tierId)) {
      return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Invalid tier ID.' });
    }

    await prisma.tier.delete({
      where: { id: tierId },
    });

    // Recalculate all user tiers asynchronously
    setImmediate(() => recalculateAllUsersTiers());

    return res.status(200).json({ message: 'Tier deleted successfully.' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: ErrorCodes.NOT_FOUND, message: 'Tier not found.' });
    }
    next(error);
  }
}

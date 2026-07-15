import prisma from '../../lib/prisma.js';
import { z } from 'zod';
import { ErrorCodes } from '../../lib/errors.js';

/**
 * Whitelist of valid site-text keys.
 * 
 * Why a whitelist? Prevents database pollution with arbitrary keys and
 * provides a single source of truth for the preprocess sanitizer.
 */
const VALID_KEYS = [
  'welcome_headline', 'welcome_subheadline', 'welcome_hero_intro',
  'projects_label', 'projects_title', 'projects_intro',
  'boxes_label', 'boxes_title', 'boxes_cta',
  'tiers_label', 'tiers_title', 'tiers_intro',
  'roadmap_label', 'roadmap_title', 'roadmap_intro',
  'impact_label', 'impact_title', 'impact_intro',
  'footer_brand_name', 'footer_brand_desc', 'footer_tagline',
];

/**
 * Strict Zod validation schema for site copy updates.
 * 
 * Why strict keys? Prevents accidental database pollution with arbitrary keys,
 * ensuring only valid page fragments can be upserted.
 */
export const BaseContentUpdateSchema = z.object({
  welcome_headline: z.string().min(1, 'Welcome headline is required'),
  welcome_subheadline: z.string().min(1, 'Welcome subheadline is required'),
  welcome_hero_intro: z.string().min(1, 'Welcome hero intro is required'),
  
  projects_label: z.string().min(1, 'Projects label is required').max(100, 'Projects label cannot exceed 100 characters'),
  projects_title: z.string().min(1, 'Projects title is required'),
  projects_intro: z.string().min(1, 'Projects intro is required'),
  
  boxes_label: z.string().min(1, 'Boxes label is required').max(100, 'Boxes label cannot exceed 100 characters'),
  boxes_title: z.string().min(1, 'Donation boxes title is required'),
  boxes_cta: z.string().min(1, 'Donation boxes CTA is required'),
  
  tiers_label: z.string().min(1, 'Tiers label is required').max(100, 'Tiers label cannot exceed 100 characters'),
  tiers_title: z.string().min(1, 'Donation tiers title is required'),
  tiers_intro: z.string().min(1, 'Donation tiers intro is required'),
  
  roadmap_label: z.string().min(1, 'Roadmap label is required').max(100, 'Roadmap label cannot exceed 100 characters'),
  roadmap_title: z.string().min(1, 'Roadmap title is required'),
  roadmap_intro: z.string().min(1, 'Roadmap intro is required'),
  
  impact_label: z.string().min(1, 'Impact label is required').max(100, 'Impact label cannot exceed 100 characters'),
  impact_title: z.string().min(1, 'Impact title is required'),
  impact_intro: z.string().min(1, 'Impact intro is required'),
  
  footer_brand_name: z.string().min(1, 'Footer brand name is required'),
  footer_brand_desc: z.string().min(1, 'Footer brand description is required'),
  footer_tagline: z.string().min(1, 'Footer tagline is required'),
});

/**
 * Preprocessed partial schema that strips empty strings and unknown keys
 * BEFORE Zod validation runs.
 * 
 * Why preprocess? The frontend sends ALL 21 form keys on every save,
 * including empty strings for tabs the user never edited. Zod .partial()
 * marks fields as optional (allows undefined/absent), but still rejects
 * present-but-empty strings via .min(1). Preprocess converts empty strings
 * to undefined so .partial() treats them as absent.
 */
export const ContentUpdateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object') return {};
  const validSet = new Set(VALID_KEYS);
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([key, value]) => validSet.has(key) && typeof value === 'string' && value.trim() !== ''
    )
  );
}, BaseContentUpdateSchema.partial());

/**
 * Maps a site-text key prefix to the corresponding SectionIdentifier enum value.
 * 
 * @param {string} key - The site-text key (e.g. 'projects_label')
 * @returns {string} The SectionIdentifier enum value
 */
function resolveSectionFromKey(key) {
  if (key.startsWith('projects_')) return 'ACTIVE_PROJECTS';
  if (key.startsWith('boxes_')) return 'DONATION_BOXES';
  if (key.startsWith('tiers_')) return 'DONATION_TIERS';
  if (key.startsWith('roadmap_')) return 'DONATION_ROADMAP';
  if (key.startsWith('impact_')) return 'TANGIBLE_IMPACT';
  if (key.startsWith('footer_')) return 'FOOTER';
  return 'WELCOME';
}

/**
 * PUT /api/v1/admin/content/site-text
 * 
 * Batch upserts text records for all page fragments inside a single
 * Prisma transaction.
 * 
 * Why transaction? Ensures atomicity — all content blocks update
 * together or none do.
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware
 */
export const updateContent = async (req, res, next) => {
  try {
    const parsed = ContentUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed for site copy payload.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const updates = parsed.data;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'No valid content fields provided.',
      });
    }

    await prisma.$transaction(
      Object.entries(updates).map(([key, value]) =>
        prisma.siteText.upsert({
          where: { key },
          update: { value },
          create: { key, value, section: resolveSectionFromKey(key) },
        })
      )
    );

    // Direct downstream clients to fetch fresh assets
    res.set('Cache-Control', 'public, max-age=0, must-revalidate');

    return res.status(200).json({
      success: true,
      message: 'Site content updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

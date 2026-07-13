import prisma from '../../lib/prisma.js';
import { z } from 'zod';
import { ErrorCodes } from '../../lib/errors.js';

/**
 * Strict Zod validation schema for site copy updates.
 * 
 * Why strict keys? Prevents accidental database pollution with arbitrary keys,
 * ensuring only valid page fragments can be upserted.
 */
export const ContentUpdateSchema = z.object({
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
 * PUT /api/v1/admin/content/site-text
 * 
 * Batch upserts text records for all page fragments inside a single Prisma transaction.
 * 
 * Why transaction? Ensures atomicity — all content blocks update together or none do.
 * Why SectionIdentifier mapping? Links key names dynamically to the correct SectionIdentifier enum
 * in the database without requiring database schema changes for individual copy fields.
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

    await prisma.$transaction(
      Object.entries(updates).map(([key, value]) => {
        let section = 'WELCOME';
        if (key.startsWith('welcome_')) section = 'WELCOME';
        else if (key.startsWith('projects_')) section = 'ACTIVE_PROJECTS';
        else if (key.startsWith('boxes_')) section = 'DONATION_BOXES';
        else if (key.startsWith('tiers_')) section = 'DONATION_TIERS';
        else if (key.startsWith('roadmap_')) section = 'DONATION_ROADMAP';
        else if (key.startsWith('impact_')) section = 'TANGIBLE_IMPACT';
        else if (key.startsWith('footer_')) section = 'FOOTER';

        return prisma.siteText.upsert({
          where: { key },
          update: { value },
          create: { key, value, section },
        });
      })
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

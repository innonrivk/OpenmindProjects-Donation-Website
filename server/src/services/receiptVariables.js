import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Interpolates template variables in a string template (e.g. "{donorName}")
 * with provided variable values.
 *
 * @param {string} template - Template string with tokens.
 * @param {Record<string, any>} variables - Object containing values for tokens.
 * @returns {string} The interpolated string.
 */
export function interpolate(template, variables) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in variables ? String(variables[key] ?? '') : match;
  });
}

/**
 * Resolves the ReceiptSettings model matching the precedence rules:
 * TIER_{tierId} > ONE_TIME / RECURRING > GLOBAL
 *
 * @param {string} donationType - "ONE_TIME" or "RECURRING"
 * @param {number|null} [tierId] - Optional tier ID
 * @returns {Promise<import('@prisma/client').ReceiptSettings>} The resolved ReceiptSettings object.
 */
export async function resolveSettings(donationType, tierId = null) {
  // 1. Specific Tier Settings: TIER_{tierId}
  if (tierId) {
    const tierSettings = await prisma.receiptSettings.findUnique({
      where: { donationType: `TIER_${tierId}` }
    });
    if (tierSettings) {
      return tierSettings;
    }
  }

  // 2. Type Settings: ONE_TIME or RECURRING
  if (donationType) {
    const typeSettings = await prisma.receiptSettings.findUnique({
      where: { donationType }
    });
    if (typeSettings) {
      return typeSettings;
    }
  }

  // 3. Fallback: GLOBAL settings
  const globalSettings = await prisma.receiptSettings.findUnique({
    where: { donationType: 'GLOBAL' }
  });

  if (!globalSettings) {
    return {
      id: 1,
      donationType: 'GLOBAL',
      emailSubjectTemplate: 'Thank you for your donation — Official OMP Receipt 🎉',
      pdfThankYouMessage: 'We appreciate your generous support.',
      pdfFooterNote: 'This PDF is your official donation receipt. Please retain for your records.',
      pdfSignatureName: 'The OpenmindProjects Team',
    };
  }

  return globalSettings;
}

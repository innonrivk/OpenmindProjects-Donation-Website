import PDFDocument from 'pdfkit';

/**
 * Interpolates {variable} tokens in a string using a context object.
 *
 * Why a shared utility? Both email subjects/bodies and PDF text fields
 * use the same token format. Centralising here prevents drift.
 *
 * @param {string} text - String with {variable} placeholders.
 * @param {object} context - Key/value map of variable replacements.
 * @returns {string} Interpolated string.
 */
export function interpolateTokens(text, context = {}) {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return context[key] !== undefined ? String(context[key]) : match;
  });
}

/**
 * Renders a certificate PDF from an admin-configured layout spec.
 *
 * Why separate from receiptPdfDraw.js? Certificate layouts are
 * admin-configurable at runtime; receipt layouts are code-defined constants.
 *
 * @param {object} pdfConfig - { fields: [{ type, x, y, value, fontSize, color }] }
 * @param {object} context   - { donorName, amount, date, tierName, ... }
 * @returns {Promise<Buffer>}
 */
export async function generateCertBuffer(pdfConfig, context) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  // Render background template image if present
  if (pdfConfig?.backgroundImage) {
    try {
      const base64Data = pdfConfig.backgroundImage.replace(/^data:image\/\w+;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      doc.image(imgBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });
    } catch (imgErr) {
      process.stderr.write(`WARN: Failed to render background image: ${imgErr.message}\n`);
    }
  }

  const fields = Array.isArray(pdfConfig?.fields) ? pdfConfig.fields : [];

  for (const field of fields) {
    const interpolatedValue = interpolateTokens(field.value || '', context);

    if (field.type === 'text') {
      doc
        .fontSize(field.fontSize || 14)
        .fillColor(field.color || '#202124')
        .text(interpolatedValue, field.x || 0, field.y || 0, {
          width: field.width || undefined,
          align: field.align || 'left',
        });
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

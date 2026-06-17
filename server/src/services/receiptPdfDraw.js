/**
 * @fileoverview High-fidelity graphics rendering library for OMP Donation Receipts.
 * 
 * Provides modular vector drawing utilities utilizing PDFKit APIs to replicate 
 * the responsive, modern look of DonationReceipt.jsx.
 */

import fs from 'fs';

// ── OMP Brand Color Constants (matches DonationReceipt.jsx & OMP brand guidelines) ──
const BRAND_BLUE       = '#4285f4';
const BRAND_GREEN      = '#34a853';
const BRAND_DARK       = '#202124';
const BRAND_MUTED      = '#6b7280';

/**
 * Draws a beautiful, sharp 4-pointed star vector at the specified coordinates.
 * 
 * Why vector drawing instead of unicode characters? Ensures 100% reliable rendering
 * across all PDF readers, avoiding the missing glyph 'missing character' box completely
 * while retaining the precise premium branding of the web app.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} cx - Center x coordinate.
 * @param {number} cy - Center y coordinate.
 * @param {number} size - Star size bounding box.
 * @param {string} color - Hex color code.
 */
export function drawStar(doc, cx, cy, size, color) {
  doc.save();
  doc.fillColor(color).fillOpacity(1);
  const r = size / 2;
  doc
    .moveTo(cx, cy - r)
    .quadraticCurveTo(cx, cy, cx + r, cy)
    .quadraticCurveTo(cx, cy, cx, cy + r)
    .quadraticCurveTo(cx, cy, cx - r, cy)
    .quadraticCurveTo(cx, cy, cx, cy - r)
    .fill();
  doc.restore();
}

/**
 * Draws the faint background OMP branding watermark text across the page.
 * 
 * Why a rotated watermark? To provide subtle official brand verification and 
 * anti-counterfeiting aesthetics without obstructing data readability.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} pageW - Page width in points.
 * @param {number} pageH - Page height in points.
 * @param {string} boldFont - Registered bold font name.
 */
export function drawWatermark(doc, pageW, pageH, boldFont) {
  doc.save();
  doc
    .rotate(-25, { origin: [pageW / 2, pageH / 2] })
    .fontSize(44)
    .fillColor(BRAND_BLUE)
    .fillOpacity(0.03) // Kept extremely low to prevent interference when printed
    .font(boldFont)
    .text('OPENMINDPROJECTS', 0, pageH / 2 - 20, { width: pageW, align: 'center', letterSpacing: 3.5 });
  doc.restore();
}

/**
 * Renders the high-fidelity double rounded-corner card outline with faint blue fill.
 * 
 * Why double lines with offset? To emulate CSS 'outline' and 'outline-offset' properties,
 * conveying depth and premium branding on digital screens and physical prints.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} x - Top-left x-coordinate.
 * @param {number} y - Top-left y-coordinate.
 * @param {number} w - Card width.
 * @param {number} h - Card height.
 */
export function drawCardBorders(doc, x, y, w, h) {
  doc.save();
  
  // 1. Draw outer outline with 4px offset (12px radius matches outer expand curve)
  doc
    .roundedRect(x - 4, y - 4, w + 8, h + 8, 12)
    .lineWidth(2)
    .strokeColor(BRAND_BLUE)
    .strokeOpacity(0.12)
    .stroke();
    
  // 2. Draw inner container with card background color fill
  doc
    .roundedRect(x, y, w, h, 10)
    .lineWidth(1)
    .strokeColor(BRAND_BLUE)
    .strokeOpacity(0.25)
    .fillColor(BRAND_BLUE)
    .fillOpacity(0.015)
    .fillAndStroke();
    
  doc.restore();
}

/**
 * Draws the header block including brand logo, title, and the -8 degree rotated stamp.
 * 
 * Why dynamic logo checking? To prevent fatal server-side ESM path crashes if the client
 * asset directory is missing, falling back to clean text layouts gracefully.
 * Why a rotated stamp? To evoke the physical feel of an authenticated organization's seal.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} x - Header start x.
 * @param {number} y - Header start y.
 * @param {number} w - Header width.
 * @param {string} logoPath - Resolved local file path to the OMP PNG logo.
 * @param {Object} fonts - Fonts map containing bold and regular font names.
 * @returns {number} The updated vertical coordinate after header elements.
 */
export function drawHeader(doc, x, y, w, logoPath, fonts) {
  doc.save();

  // 1. Blue top card accent bar (adds the OMP signature colored crown to the receipt)
  doc
    .rect(x, y, w, 5)
    .fillColor(BRAND_BLUE)
    .fillOpacity(0.85)
    .fill();

  doc.restore(); // Restore to reset opacity for text/images!

  y += 18;

  // 2. Logo drawing with path verification
  let textOffset = 0;
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      // 36px height exactly matches the website React component rendering
      doc.image(logoPath, x + 16, y, { height: 36 });
      textOffset = 52; // Offset text to prevent overlapping the logo graphic
    } catch (err) {
      process.stdout.write(`WARN: Failed to render logo image: ${err.message}\n`);
    }
  }

  // 3. Brand Text & Subtitle
  doc
    .fillColor(BRAND_BLUE)
    .fontSize(16)
    .font(fonts.bold)
    .text('OpenmindProjects', x + 16 + textOffset, y + 2, { letterSpacing: -0.2 });

  doc
    .fillColor(BRAND_MUTED)
    .fontSize(9)
    .font(fonts.bold)
    .text('OFFICIAL DONATION RECEIPT', x + 16 + textOffset, y + 22, { letterSpacing: 0.5 });

  // 4. CCW Rotated Green OMP Verified Stamp (drawn top-right)
  const stampCX = x + w - 52;
  const stampCY = y + 16;
  const stampR  = 34;

  doc.save();
  // Rotate stamp -8 degrees CCW around its visual center (matches React transform: rotate(-8deg))
  doc.rotate(-8, { origin: [stampCX, stampCY] });

  // Stamp Outer boundary
  doc.save();
  doc
    .circle(stampCX, stampCY, stampR)
    .lineWidth(2.5)
    .strokeColor(BRAND_GREEN)
    .strokeOpacity(1)
    .fillColor('#ffffff')
    .fillOpacity(0.01)
    .fillAndStroke();
  doc.restore();

  // Stamp Faint inner concentric circle
  doc
    .circle(stampCX, stampCY, stampR - 5)
    .lineWidth(0.5)
    .strokeColor(BRAND_GREEN)
    .strokeOpacity(1)
    .stroke();

  // Stamp text elements with tight line heights to avoid wrapping corruption
  doc
    .fillColor(BRAND_GREEN)
    .font(fonts.bold)
    .fontSize(7.5)
    .text('OMP', stampCX - 15, stampCY - 12, { width: 30, align: 'center', letterSpacing: 0.2 })
    .text('VERIFIED', stampCX - 20, stampCY - 2, { width: 40, align: 'center', letterSpacing: 0.1 })
    .text('DONOR', stampCX - 15, stampCY + 8, { width: 30, align: 'center', letterSpacing: 0.2 });

  doc.restore(); // Exit stamp rotation context

  // 5. Divider border underneath the header
  y += 52;
  doc.save();
  doc
    .moveTo(x + 16, y)
    .lineTo(x + w - 16, y)
    .lineWidth(2)
    .strokeColor(BRAND_BLUE)
    .strokeOpacity(0.15)
    .stroke();
  doc.restore();

  return y + 16;
}

/**
 * Draws standard metadata rows with matching zebra coloring and Courier monospace handling.
 * 
 * Why zebra coloring? Prevents visual row skipping when reading lists on A4 forms.
 * Why Courier for receipt number? Replicates physical receipts where transaction hashes
 * must be highly legible and spaced clearly for accounting audits.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} x - Left coordinate.
 * @param {number} y - Top coordinate.
 * @param {number} w - Table width.
 * @param {Array<Array<string>>} rows - Array of tuple [label, value, hasZebra, isMono, isTier].
 * @param {number} rowH - Uniform height of each row.
 * @param {number} colLabelW - Column width reserved for labels.
 * @param {Object} fonts - Registered font names map.
 * @returns {number} Updated vertical coordinate after the table.
 */
export function drawMetadataRows(doc, x, y, w, rows, rowH, colLabelW, fonts) {
  rows.forEach(([label, value, hasZebra, isMono, isTier]) => {
    // Fill row backgrounds conditionally based on zebra styling flag
    if (hasZebra) {
      doc.save();
      doc
        .rect(x + 8, y, w - 16, rowH)
        .fillColor(BRAND_BLUE)
        .fillOpacity(0.02)
        .fill();
      doc.restore();
    }

    // Border line at the bottom of the row
    doc.save();
    doc
      .moveTo(x + 8, y + rowH)
      .lineTo(x + w - 8, y + rowH)
      .lineWidth(1)
      .strokeColor(BRAND_BLUE)
      .strokeOpacity(0.06)
      .stroke();
    doc.restore();

    // Label column
    doc
      .fillColor(BRAND_MUTED)
      .font(fonts.regular)
      .fontSize(10.5)
      .text(label, x + 16, y + 8, { width: colLabelW });

    // Value column
    if (isTier) {
      // Draw premium 4-pointed vector star
      const starSize = 9;
      const starY = y + 14;
      const starX = x + 16 + colLabelW + 4;
      drawStar(doc, starX, starY, starSize, BRAND_BLUE);

      doc
        .fillColor(BRAND_DARK)
        .font(fonts.bold)
        .fontSize(10.5)
        .text(value, starX + 11, y + 8, {
          width: w - colLabelW - 44,
          ellipsis: true
        });
    } else {
      const valFont = isMono ? fonts.mono : fonts.bold;
      doc
        .fillColor(BRAND_DARK)
        .font(valFont)
        .fontSize(10.5)
        .text(value, x + 16 + colLabelW, y + 8, {
          width: w - colLabelW - 32,
          ellipsis: true
        });
    }

    y += rowH;
  });

  return y;
}

/**
 * Draws the highlighted Donation Amount box matching DonationReceipt.jsx.
 * 
 * Why thick top/bottom borders? To anchor the primary transaction detail, 
 * making the donor's monthly impact stand out immediately.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} x - Left coordinate.
 * @param {number} y - Top coordinate.
 * @param {number} w - Row width.
 * @param {string} amountText - Formatted monthly subscription amount string.
 * @param {Object} fonts - Fonts map.
 * @returns {number} Updated vertical coordinate.
 */
export function drawAmountHighlight(doc, x, y, w, amountText, fonts) {
  const highlightH = 38;

  doc.save();

  // Background box tint
  doc
    .rect(x + 8, y, w - 16, highlightH)
    .fillColor(BRAND_BLUE)
    .fillOpacity(0.06)
    .fill();

  // Top border highlight
  doc
    .moveTo(x + 8, y)
    .lineTo(x + w - 8, y)
    .lineWidth(1)
    .strokeColor(BRAND_BLUE)
    .strokeOpacity(0.15)
    .stroke();

  // Bottom border highlight
  doc
    .moveTo(x + 8, y + highlightH)
    .lineTo(x + w - 8, y + highlightH)
    .lineWidth(1)
    .strokeColor(BRAND_BLUE)
    .strokeOpacity(0.15)
    .stroke();

  doc.restore();

  // Highlight Text Label
  doc
    .fillColor(BRAND_DARK)
    .font(fonts.bold)
    .fontSize(10.5)
    .text('Donation Amount:', x + 16, y + 13);

  // Highlighted monthly amount value
  doc
    .fillColor(BRAND_BLUE)
    .font(fonts.bold)
    .fontSize(12)
    .text(amountText, x + 16 + 160, y + 12, { width: w - 160 - 32 });

  return y + highlightH;
}

/**
 * Renders the donor program perks/benefits list.
 * 
 * Why dynamically drawn? So that supporters immediately see what access they unlocked 
 * under OMP, reaffirming their high-value community tier perks.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} x - Left coordinate.
 * @param {number} y - Top coordinate.
 * @param {number} w - Container width.
 * @param {Array<string>} perks - Active benefits strings.
 * @param {Object} fonts - Fonts map.
 * @returns {number} Updated vertical coordinate.
 */
export function drawPerksList(doc, x, y, w, perks, fonts) {
  if (!perks || perks.length === 0) return y;

  y += 18;
  
  doc
    .fillColor(BRAND_MUTED)
    .font(fonts.bold)
    .fontSize(8.5)
    .text('TIER BENEFITS ACTIVATED:', x + 16, y, { letterSpacing: 0.4 });

  y += 12;

  perks.forEach((perk) => {
    doc
      .fillColor(BRAND_DARK)
      .font(fonts.regular)
      .fontSize(9.5)
      // Custom bullet indicator mimics React standard spacing
      .text(`•  ${perk}`, x + 22, y, { width: w - 38, lineGap: 2 });
    y += 13;
  });

  return y;
}

/**
 * Draws the green receipt official attachment notice at the bottom.
 * 
 * Why the green highlights? Replicates the system email design, ensuring 
 * the document visually marks itself as formal financial record documentation.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} x - Left coordinate.
 * @param {number} y - Top coordinate.
 * @param {number} w - Notice width.
 * @param {Object} fonts - Fonts map.
 * @returns {number} Updated vertical coordinate.
 */
export function drawAttachmentNotice(doc, x, y, w, footerNote, fonts) {
  y += 18;

  const noteText = footerNote || 'This PDF is your official donation receipt. Please retain for your records.';
  doc.save();
  doc.font(fonts.bold).fontSize(9.5);
  const textHeight = doc.heightOfString(noteText, { width: w - 44 });
  const boxH = Math.max(32, textHeight + 22);

  // Background green highlight box
  doc
    .rect(x, y, w, boxH)
    .fillColor('#f0fdf4')
    .fill();

  doc.restore();

  // Draw premium green star vector on the left
  const starSize = 9;
  const starX = x + 18;
  const starY = y + (boxH / 2);
  drawStar(doc, starX, starY, starSize, BRAND_GREEN);

  // Green notice text
  doc.save();
  doc
    .fillColor(BRAND_GREEN)
    .font(fonts.bold)
    .fontSize(9.5)
    .text(noteText, starX + 11, y + ((boxH - textHeight) / 2), {
      width: w - 44,
    });
  doc.restore();

  return y + boxH;
}

/**
 * Draws the editable thank-you message and signature block.
 * 
 * Why? Separates dynamic messaging from structured receipt tables to give
 * the PDF a personal, high-quality touch.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} x - Left coordinate.
 * @param {number} y - Top coordinate.
 * @param {number} w - Content width.
 * @param {string} thankYouMessage - Custom thank-you text.
 * @param {string} signatureName - Custom signature text.
 * @param {Object} fonts - Fonts map.
 * @returns {number} Updated vertical coordinate.
 */
export function drawThankYouSection(doc, x, y, w, thankYouMessage, signatureName, fonts) {
  y += 18;

  // Thank You Message
  doc.save();
  doc
    .fillColor(BRAND_DARK)
    .font(fonts.regular)
    .fontSize(9.5)
    .text(thankYouMessage, x + 16, y, { width: w - 32, lineGap: 2.5 });
  doc.restore();

  const textHeight = doc.heightOfString(thankYouMessage, { width: w - 32, lineGap: 2.5 });
  y += textHeight + 14;

  // Signature Block
  doc.save();
  doc
    .fillColor(BRAND_MUTED)
    .font(fonts.regular)
    .fontSize(9)
    .text('Sincerely,', x + 16, y);

  y += 14;

  doc
    .fillColor(BRAND_DARK)
    .font(fonts.bold)
    .fontSize(9.5)
    .text(signatureName, x + 16, y);
  doc.restore();

  return y + 14;
}

/**
 * Draws the standard A4 footer content at the bottom of the page.
 * 
 * Why centering and dividing line? Clean alignment matches accounting reporting
 * styles, displaying legally-required auto-generated notice and copyright fields.
 * 
 * @param {PDFKit.PDFDocument} doc - PDFKit document instance.
 * @param {number} x - Left coordinate.
 * @param {number} y - Top coordinate.
 * @param {number} w - Footer width.
 * @param {number} year - Copyright year.
 * @param {Object} fonts - Fonts map.
 */
export function drawFooter(doc, x, y, w, year, fonts) {
  doc.save();

  // Visual divider above the copyright lines
  doc
    .moveTo(x, y)
    .lineTo(x + w, y)
    .lineWidth(0.5)
    .strokeColor('#c7d9fd')
    .stroke();

  doc.restore();

  y += 12;

  // Center-aligned corporate copyright details
  doc
    .fillColor(BRAND_MUTED)
    .fillOpacity(0.7)
    .font(fonts.regular)
    .fontSize(8.2)
    .text(
      `© ${year} OpenmindProjects. All rights reserved.  |  This receipt is auto-generated and valid without a signature.`,
      x, y,
      { width: w, align: 'center' }
    );
}

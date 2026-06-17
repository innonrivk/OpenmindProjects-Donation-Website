/**
 * @fileoverview Main orchestration module for generating official OMP donation receipts in PDF format.
 * 
 * Manages PDFKit initialization, performs runtime font verification with safety fallbacks,
 * and organizes the layered, pixel-perfect visual structure matching the web app.
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  drawWatermark,
  drawCardBorders,
  drawHeader,
  drawMetadataRows,
  drawAmountHighlight,
  drawPerksList,
  drawAttachmentNotice,
  drawFooter,
  drawThankYouSection
} from './receiptPdfDraw.js';

// Resolve module paths under Node ESM environments securely
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Layout Metrics (Matching page budget constraints of standard A4 portrait) ──
const PAGE_MARGIN = 48;
const PAGE_WIDTH  = 595; // A4 standard width in points
const PAGE_HEIGHT = 842; // A4 standard height in points
const CONTENT_W   = PAGE_WIDTH - PAGE_MARGIN * 2;

/**
 * @typedef {Object} ReceiptPdfOptions
 * @property {number}   amount        - Donation monthly subscription amount in cents.
 * @property {string}   transactionId - Reference transaction hash or invoice ID.
 * @property {string}   date          - ISO date string of the donation transaction.
 * @property {string}   [donorName]   - Full name of the donor.
 * @property {string}   [donorEmail]  - Email address of the donor.
 * @property {string}   [country]     - Billing country.
 * @property {string}   [tierName]    - Active subscription tier label.
 * @property {string[]} [tierPerks]   - Array of active tier benefit strings.
 */

/**
 * Generates an official OMP Donation Receipt PDF as a binary Buffer.
 * 
 * Why the strict Promise wrapper? To interface cleanly with Node email dispatch queues 
 * that require full binary streams/buffers synchronously upon generation completion.
 * Why robust font fallback? To ensure that any runtime disk error or missing font
 * assets logs warnings but never blocks the donor checkout checkout pipeline.
 * 
 * @param {ReceiptPdfOptions} opts - Receipt data used to populate the document.
 * @returns {Promise<Buffer>} Resolves to the compiled PDF binary buffer.
 */
export async function generateReceiptPdf(opts) {
  const {
    amount,
    transactionId,
    date,
    donorName  = 'Valued Donor',
    donorEmail = '—',
    country    = 'Not specified',
    tierName   = 'Supporter',
    tierPerks  = [],
    isRecurring = true,
    pdfThankYouMessage = 'We appreciate your generous support.',
    pdfFooterNote      = 'This PDF is your official donation receipt. Please retain for your records.',
    pdfSignatureName   = 'The OpenmindProjects Team',
  } = opts;

  const amountFormatted = isRecurring
    ? `$${(amount / 100).toFixed(2)} / Month`
    : `$${(amount / 100).toFixed(2)}`;
  const dateFormatted   = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const year = new Date().getFullYear();

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
    const chunks = [];

    // Stream buffering for clean synchronous resolve
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // ── 1. Safe Font Assets Loader ──
    const fontPaths = {
      regular: path.resolve(__dirname, '../assets/fonts/Inter-Regular.ttf'),
      bold: path.resolve(__dirname, '../assets/fonts/Inter-Bold.ttf')
    };

    const fonts = {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
      mono: 'Courier'
    };

    try {
      if (fs.existsSync(fontPaths.regular) && fs.existsSync(fontPaths.bold)) {
        doc.registerFont('Inter-Regular', fontPaths.regular);
        doc.registerFont('Inter-Bold', fontPaths.bold);
        fonts.regular = 'Inter-Regular';
        fonts.bold    = 'Inter-Bold';
      } else {
        process.stdout.write('WARN: Inter font assets missing from disk. Using Helvetica fallback.\n');
      }
    } catch (err) {
      process.stdout.write(`WARN: Failed to register custom fonts: ${err.message}. Using Helvetica fallback.\n`);
    }

    // ── 2. Background Elements (Watermark drawn first to sit at the bottom layer) ──
    drawWatermark(doc, PAGE_WIDTH, PAGE_HEIGHT, fonts.bold);

    // ── 3. Define Card Content Rows ──
    const preAmountRows = [
      ['Receipt Number:',   transactionId, true,  true,  false], // zebra=true, mono=true,  tier=false
      ['Transaction Date:', dateFormatted, false, false, false], // zebra=false, mono=false, tier=false
      ['Donor Name:',       donorName,     true,  false, false], // zebra=true, mono=false, tier=false
      ['Donor Email:',      donorEmail,    false, false, false], // zebra=false, mono=false, tier=false
      ['Country:',          country,       true,  false, false]  // zebra=true, mono=false, tier=false
    ];

    const postAmountRows = [
      [
        isRecurring ? 'Subscription Tier:' : 'Donation Type:',
        isRecurring ? tierName : 'One-Time Donation',
        true,
        false,
        isRecurring
      ]
    ];

    // ── 4. Dynamic Height Calculation for Card Container ──
    // Why dynamic? To prevent visual overflows or excessive empty space if metadata rows scale or change.
    const headerHeight = 86 + 12; // 86 (header elements) + 12 (top padding)
    const preAmountHeight = preAmountRows.length * 28;
    const amountHeight = 38 + 8; // 38 (highlight block) + 8 (spacers)
    const postAmountHeight = postAmountRows.length * 28;
    const bottomPadding = 16;
    const cardH = headerHeight + preAmountHeight + amountHeight + postAmountHeight + bottomPadding;

    const cardX = PAGE_MARGIN - 8;
    const cardY = PAGE_MARGIN + 12;
    const cardW = CONTENT_W + 16;

    // Draw borders before rendering content so borders lay in the background
    drawCardBorders(doc, cardX, cardY, cardW, cardH);

    // ── 5. Card Content Render & Assembly ──
    let currentY = cardY + 12;

    // A. Logo & Rotated Header Stamp
    const logoPath = path.resolve(__dirname, '../../../client/public/omp-logo.png');
    currentY = drawHeader(doc, cardX, currentY, cardW, logoPath, fonts);

    // B. Metadata Table Part 1 (Rows 1-5, matching website order exactly)
    currentY = drawMetadataRows(doc, cardX, currentY, cardW, preAmountRows, 28, 160, fonts);
    currentY += 4;

    // C. Highlighted Donation Amount Row
    currentY = drawAmountHighlight(doc, cardX, currentY, cardW, amountFormatted, fonts);
    currentY += 4;

    // D. Metadata Table Part 2 (Subscription Tier drawn after Amount row)
    currentY = drawMetadataRows(doc, cardX, currentY, cardW, postAmountRows, 28, 160, fonts);

    // ── 5. Auxiliary Elements (Rendered dynamically outside the card) ──
    // A. Tier Benefits Perks List
    currentY = drawPerksList(doc, cardX, cardY + cardH, cardW, tierPerks, fonts);

    // B. Thank You Message and Signature Block
    currentY = drawThankYouSection(doc, cardX, currentY, cardW, pdfThankYouMessage, pdfSignatureName, fonts);

    // C. Attachment/Records Legal Notice Box
    const noticeY = Math.max(currentY + 10, 630);
    currentY = drawAttachmentNotice(doc, cardX, noticeY, cardW, pdfFooterNote, fonts);

    // D. Document Bottom Footer
    drawFooter(doc, cardX, 745, cardW, year, fonts);

    doc.end();
  });
}

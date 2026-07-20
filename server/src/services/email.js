import nodemailer from 'nodemailer';
import { generateReceiptPdf } from './receiptPdf.js';
import { buildReceiptHtml } from './email/templates/receiptTemplate.js';
import { buildAmountChangedHtml } from './email/templates/amountChangedTemplate.js';
import { buildCancelScheduledHtml } from './email/templates/cancelScheduledTemplate.js';
import { generateCertBuffer, interpolateTokens } from './certPdfService.js';

/**
 * Startup fail-fast configuration validation.
 *
 * Why throw on boot? Catching configuration errors on boot prevents silent
 * runtime failures when users attempt critical actions like signing up or donating.
 */
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpFrom = process.env.SMTP_FROM || smtpUser;

if (process.env.NODE_ENV !== 'test' && (!smtpHost || !smtpPort || !smtpUser)) {
  throw new Error(
    'CRITICAL: Google Workspace SMTP is not configured correctly. ' +
    'Please set SMTP_HOST, SMTP_PORT, and SMTP_USER in your root .env file.'
  );
}

/**
 * Configure reusable Nodemailer SMTP transport pool.
 *
 * Why pooling? Connection pooling keeps SMTP connections alive, preventing
 * the high overhead of establishing a new SSL/TLS handshake per email.
 */
export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: parseInt(smtpPort, 10) || 465,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: smtpUser,
    pass: process.env.SMTP_PASSWORD || '',
  },
  pool: process.env.NODE_ENV !== 'test',
  maxConnections: 5,
  maxMessages: 100,
});

// Why mock sendMail in the test environment?
// This prevents the application from making real SMTP network requests during test runs,
// improving execution speed, preventing socket leaks, and enabling clean process terminations.
if (process.env.NODE_ENV === 'test') {
  transporter.sendMail = async () => {
    return { messageId: 'mock-message-id' };
  };
}

const BRAND_BLUE  = '#4285f4';
const BRAND_DARK  = '#202124';
const BRAND_MUTED = '#6b7280';

/**
 * @typedef {Object} ReceiptData
 * @property {number}   amount        - Donation amount in cents.
 * @property {string}   transactionId - Transaction hash, invoice ID, or UUID.
 * @property {string}   date          - ISO date string of the donation event.
 * @property {string}   [donorName]   - Full name of the donor.
 * @property {string}   [donorEmail]  - Email address of the donor.
 * @property {string}   [country]     - Billing country.
 * @property {string}   [tierName]    - Active donor subscription tier label.
 * @property {string[]} [tierPerks]   - List of benefits unlocked by the donor's tier.
 */

/**
 * @typedef {Object} SendEmailOptions
 * @property {string}      to          - Recipient email address.
 * @property {string}      subject     - Email subject line.
 * @property {string}      title       - Main heading inside the HTML card.
 * @property {string}      messageText - Body paragraph text.
 * @property {string}      [otp]       - Optional OTP verification code.
 * @property {ReceiptData} [receiptData] - Optional donation receipt metadata.
 */

/**
 * Dispatches an email using Gmail / Google Workspace SMTP via Nodemailer.
 *
 * When `receiptData` is supplied the function:
 * 1. Renders a premium HTML receipt body mirroring DonationReceipt.jsx.
 * 2. Generates an official PDF via `generateReceiptPdf`.
 * 3. Attaches the PDF to the email before dispatch.
 *
 * @param {SendEmailOptions} options - Options for the email template and recipient.
 * @returns {Promise<boolean>} True if sent successfully, false if terminal fallback.
 */
export async function sendEmail({ to, subject, title, messageText, otp = null, receiptData = null }) {
  let htmlContent;
  let pdfBuffer   = null;
  let pdfFilename = null;
  let attachments = [];

  if (receiptData) {
    try {
      pdfFilename = 'OMP_Donation_Receipt_' + receiptData.transactionId + '.pdf';
      pdfBuffer   = await generateReceiptPdf(receiptData);
      attachments = [{
        filename:    pdfFilename,
        content:     pdfBuffer,
        contentType: 'application/pdf',
      }];
    } catch (pdfErr) {
      process.stderr.write(
        JSON.stringify({
          level: 'ERROR',
          ts:    new Date().toISOString(),
          event: 'PDF_GENERATION_FAILURE',
          error: pdfErr.message,
        }) + '\n'
      );
      pdfFilename = 'OMP_Donation_Receipt.pdf';
    }

    htmlContent = buildReceiptHtml(receiptData, pdfFilename);
  } else {
    const year = new Date().getFullYear();
    htmlContent = '<div style="font-family:\'Inter\',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">'
      + '<div style="text-align:center;margin-bottom:22px;">'
      + '  <img src="https://file.9o9.io/api/public/dl/HyDoVbXE/home/rootmind/ai4g/Openmind_Projects_Logo.svg" alt="Openmind Projects Logo" width="180" style="display:inline-block;width:180px;height:auto;" />'
      + '</div>'
      + '<h2 style="font-size:20px;font-weight:800;color:' + BRAND_DARK + ';text-align:center;margin:0 0 12px;">' + title + '</h2>'
      + '<p style="font-size:14px;color:' + BRAND_MUTED + ';line-height:1.65;text-align:center;margin:0 0 24px;">' + messageText + '</p>'
      + (otp
        ? '<div style="text-align:center;margin-bottom:28px;">'
          + '<span style="display:inline-block;font-family:monospace;font-size:30px;font-weight:700;color:' + BRAND_BLUE + ';background:#ebf8ff;padding:12px 28px;border-radius:8px;letter-spacing:0.12em;border:1px dashed #bee3f8;">' + otp + '</span>'
          + '</div>'
        : '')
      + '<p style="font-size:11px;color:#a0aec0;text-align:center;line-height:1.5;margin:0;">'
      + '  If you did not make this request, please ignore this email.<br/>'
      + '  &copy; ' + year + ' OpenmindProjects. All rights reserved.'
      + '</p>'
      + '</div>';
  }

  let sentSuccessfully = false;

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: messageText,
      html: htmlContent,
      attachments,
    });

    process.stdout.write(
      JSON.stringify({
        level:  'INFO',
        ts:     new Date().toISOString(),
        event:  'EMAIL_DISPATCH_SUCCESS',
        to,
        subject,
        hasPdf: attachments.length > 0,
      }) + '\n'
    );
    sentSuccessfully = true;
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        level: 'ERROR',
        ts:    new Date().toISOString(),
        event: 'EMAIL_DISPATCH_FAILURE',
        to,
        error: err.message,
      }) + '\n'
    );
    sentSuccessfully = false;
  }

  if (!sentSuccessfully && process.env.NODE_ENV !== 'production') {
    const borderChar = '\u2550';
    const width      = 64;
    const printLine  = (text, colorCode) => {
      colorCode = colorCode || '33';
      const spaces = width - text.length - 4;
      console.log('\x1b[' + colorCode + 'm\u2551 \x1b[0m' + text + ' '.repeat(spaces > 0 ? spaces : 0) + '\x1b[' + colorCode + 'm \u2551\x1b[0m');
    };

    console.log('\n\x1b[33m\u2554' + borderChar.repeat(width - 2) + '\u2557\x1b[0m');
    printLine('\u26a0\ufe0f  DEVELOPMENT FALLBACK LOGGED EMAIL', '33');
    printLine('\u2500'.repeat(width - 4), '33');
    printLine('To:      ' + to);
    printLine('Subject: ' + subject);
    if (otp) {
      printLine('Code:    \x1b[32m\x1b[1m' + otp + '\x1b[0m');
    }
    if (receiptData) {
      printLine('Receipt: $' + (receiptData.amount / 100).toFixed(2) + ' \u2014 ' + (receiptData.tierName || 'Supporter'));
      printLine('PDF:     ' + (pdfFilename || 'Not generated'));
    }
    printLine('\u2500'.repeat(width - 4), '33');
    printLine('Configure valid SMTP variables in .env', '90');
    printLine('to enable actual email dispatch.', '90');
    console.log('\x1b[33m\u255a' + borderChar.repeat(width - 2) + '\u255d\x1b[0m\n');
  }

  return sentSuccessfully;
}

/**
 * Sends a branded notification when a donor updates their monthly contribution.
 *
 * Why? Informing the user visually about their updated subscription pricing
 * ensures reassurance and confirms the exact billing date of the change.
 *
 * @param {Object} params - The email dispatch parameters.
 * @param {string} params.to - Recipient email.
 * @param {string} params.donorName - Donor name.
 * @param {number} params.oldAmount - Previous amount.
 * @param {number} params.newAmount - New amount.
 * @param {string|Date} params.effectiveDate - Date of change activation.
 * @returns {Promise<boolean>} Sent status.
 */
export async function sendAmountChangedEmail({ to, donorName, oldAmount, newAmount, effectiveDate }) {
  const subject = 'Your monthly donation amount has been updated';
  const htmlContent = buildAmountChangedHtml(donorName, oldAmount, newAmount, effectiveDate);
  const messageText = `Hi ${donorName}, your monthly donation has been updated from $${oldAmount} to $${newAmount}, effective ${new Date(effectiveDate).toLocaleDateString()}.`;

  let sentSuccessfully = false;
  try {
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: messageText,
      html: htmlContent,
    });
    process.stdout.write(JSON.stringify({
      level: 'INFO',
      ts: new Date().toISOString(),
      event: 'EMAIL_DISPATCH_SUCCESS',
      to,
      subject,
      hasPdf: false,
    }) + '\n');
    sentSuccessfully = true;
  } catch (err) {
    process.stderr.write(JSON.stringify({
      level: 'ERROR',
      ts: new Date().toISOString(),
      event: 'EMAIL_DISPATCH_FAILURE',
      to,
      error: err.message,
    }) + '\n');
  }

  if (!sentSuccessfully && process.env.NODE_ENV !== 'production') {
    const borderChar = '\u2550';
    const width      = 64;
    const printLine  = (text, colorCode) => {
      colorCode = colorCode || '33';
      const spaces = width - text.length - 4;
      console.log('\x1b[' + colorCode + 'm\u2551 \x1b[0m' + text + ' '.repeat(spaces > 0 ? spaces : 0) + '\x1b[' + colorCode + 'm \u2551\x1b[0m');
    };
    console.log('\n\x1b[33m\u2554' + borderChar.repeat(width - 2) + '\u2557\x1b[0m');
    printLine('\u26a0\ufe0f  DEVELOPMENT FALLBACK LOGGED EMAIL', '33');
    printLine('\u2500'.repeat(width - 4), '33');
    printLine('To:      ' + to);
    printLine('Subject: ' + subject);
    printLine('Change:  $' + oldAmount + ' -> $' + newAmount + ' (Effective: ' + new Date(effectiveDate).toLocaleDateString() + ')');
    printLine('\u2500'.repeat(width - 4), '33');
    console.log('\x1b[33m\u255a' + borderChar.repeat(width - 2) + '\u255d\x1b[0m\n');
  }
  return sentSuccessfully;
}

/**
 * Sends a cancellation confirmation when a scheduled donation change is aborted.
 *
 * Why? Immediate feedback ensures the user knows their cancellation request succeeded
 * and their previous donation tier/rate remains safe and active.
 *
 * @param {Object} params - The email dispatch parameters.
 * @param {string} params.to - Recipient email.
 * @param {string} params.donorName - Donor name.
 * @param {number} params.amount - Reverted amount.
 * @returns {Promise<boolean>} Sent status.
 */
export async function sendCancelScheduledEmail({ to, donorName, amount }) {
  const subject = 'Your scheduled donation change has been cancelled';
  const htmlContent = buildCancelScheduledHtml(donorName, amount);
  const messageText = `Hi ${donorName}, your scheduled donation update has been cancelled. Your active donation of $${amount}/month will continue.`;

  let sentSuccessfully = false;
  try {
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: messageText,
      html: htmlContent,
    });
    process.stdout.write(JSON.stringify({
      level: 'INFO',
      ts: new Date().toISOString(),
      event: 'EMAIL_DISPATCH_SUCCESS',
      to,
      subject,
      hasPdf: false,
    }) + '\n');
    sentSuccessfully = true;
  } catch (err) {
    process.stderr.write(JSON.stringify({
      level: 'ERROR',
      ts: new Date().toISOString(),
      event: 'EMAIL_DISPATCH_FAILURE',
      to,
      error: err.message,
    }) + '\n');
  }

  if (!sentSuccessfully && process.env.NODE_ENV !== 'production') {
    const borderChar = '\u2550';
    const width      = 64;
    const printLine  = (text, colorCode) => {
      colorCode = colorCode || '33';
      const spaces = width - text.length - 4;
      console.log('\x1b[' + colorCode + 'm\u2551 \x1b[0m' + text + ' '.repeat(spaces > 0 ? spaces : 0) + '\x1b[' + colorCode + 'm \u2551\x1b[0m');
    };
    console.log('\n\x1b[33m\u2554' + borderChar.repeat(width - 2) + '\u2557\x1b[0m');
    printLine('\u26a0\ufe0f  DEVELOPMENT FALLBACK LOGGED EMAIL', '33');
    printLine('\u2500'.repeat(width - 4), '33');
    printLine('To:      ' + to);
    printLine('Subject: ' + subject);
    printLine('Status:  Scheduled update cancelled. Donation remains at $' + amount + '/month.');
    printLine('\u2500'.repeat(width - 4), '33');
    console.log('\x1b[33m\u255a' + borderChar.repeat(width - 2) + '\u255d\x1b[0m\n');
  }
  return sentSuccessfully;
}

/**
 * Sends a templated email using an EmailTemplate record from the Communication Hub.
 * Optionally attaches a generated certificate PDF when pdfConfig is present.
 *
 * Why extend existing email.js? Keeps a single transport layer (Nodemailer SMTP pool)
 * and avoids introducing a second email abstraction.
 *
 * @param {string} to - Recipient email address.
 * @param {object} template - EmailTemplate record with subject, bodyHtml, pdfConfig.
 * @param {object} context - Variable interpolation context { donorName, amount, ... }.
 * @returns {Promise<boolean>} True if dispatch succeeded.
 */
export async function sendTemplatedEmail(to, template, context) {
  const subject = interpolateTokens(template.subject, context);
  const html = interpolateTokens(template.bodyHtml, context);
  let attachments = [];

  if (template.pdfConfig) {
    try {
      const pdfBuffer = await generateCertBuffer(template.pdfConfig, context);
      attachments = [{
        filename: 'certificate.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      }];
    } catch (pdfErr) {
      process.stderr.write(
        JSON.stringify({
          level: 'ERROR',
          ts: new Date().toISOString(),
          event: 'CERT_PDF_GENERATION_FAILURE',
          error: pdfErr.message,
        }) + '\n'
      );
    }
  }

  let sentSuccessfully = false;
  try {
    await transporter.sendMail({ from: smtpFrom, to, subject, html, attachments });
    process.stdout.write(
      JSON.stringify({
        level: 'INFO',
        ts: new Date().toISOString(),
        event: 'TEMPLATED_EMAIL_DISPATCH_SUCCESS',
        to,
        subject,
        hasPdf: attachments.length > 0,
      }) + '\n'
    );
    sentSuccessfully = true;
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        level: 'ERROR',
        ts: new Date().toISOString(),
        event: 'TEMPLATED_EMAIL_DISPATCH_FAILURE',
        to,
        error: err.message,
      }) + '\n'
    );
  }

  return sentSuccessfully;
}

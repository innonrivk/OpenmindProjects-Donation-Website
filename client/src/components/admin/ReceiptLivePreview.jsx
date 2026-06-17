import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Helper to interpolate tokens in preview fields.
 * 
 * @param {string} template - The template string containing tokens like {donorName}
 * @param {Record<string, string>} variables - Key-value map of variable values
 * @returns {string} Interpolated preview string
 */
function interpolate(template, variables) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}

/**
 * ReceiptLivePreview — High-fidelity rendering of email subject and PDF receipts in real time.
 * 
 * Why? Lets administrators review EXACTLY how dynamic placeholders format before saving,
 * eliminating typos and alignment issues on donor receipts.
 * 
 * @param {Object} props - Component properties.
 * @param {string} props.emailSubjectTemplate - Email subject line template string.
 * @param {string} props.pdfThankYouMessage - PDF thank you text.
 * @param {string} props.pdfFooterNote - PDF green footer notice text.
 * @param {string} props.pdfSignatureName - PDF signature name.
 * @param {string} props.activeTierName - Formatted tier name for the active tab.
 */
export default function ReceiptLivePreview({
  emailSubjectTemplate,
  pdfThankYouMessage,
  pdfFooterNote,
  pdfSignatureName,
  activeTierName = 'Silver Tier',
  isRecurring = false
}) {
  const [previewTab, setPreviewTab] = useState('email'); // 'email' | 'pdf'

  const variables = {
    donorName: 'Alex Johnson',
    amount: '$25.00',
    tierName: activeTierName,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    transactionId: 'ch_3M2z8xFLs5K7dK',
    transactionSubject: 'Camp Equipment Fund',
    country: 'United States'
  };

  const previewSubject = interpolate(emailSubjectTemplate, variables);
  const previewThankYou = interpolate(pdfThankYouMessage, variables);
  const previewFooter = interpolate(pdfFooterNote, variables);
  const previewSignature = interpolate(pdfSignatureName, variables);

  return (
    <div className="receipt-preview-panel glass">
      <div className="preview-header">
        <h4>Live Preview</h4>
        <div className="preview-toggle-btns" role="tablist">
          <button
            className={`btn-preview-toggle ${previewTab === 'email' ? 'active' : ''}`}
            onClick={() => setPreviewTab('email')}
            role="tab"
            aria-selected={previewTab === 'email'}
          >
            Email
          </button>
          <button
            className={`btn-preview-toggle ${previewTab === 'pdf' ? 'active' : ''}`}
            onClick={() => setPreviewTab('pdf')}
            role="tab"
            aria-selected={previewTab === 'pdf'}
          >
            PDF Receipt
          </button>
        </div>
      </div>

      <div className="preview-container">
        <AnimatePresence mode="wait">
          {previewTab === 'email' ? (
            <motion.div
              key="email-preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="email-client-mock"
            >
              <div className="email-client-top">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
                <span className="email-title">Inbox</span>
              </div>
              <div className="email-header-field">
                <span className="field-label">From:</span>
                <span className="field-val">OpenmindProjects &lt;receipts@openmindprojects.org&gt;</span>
              </div>
              <div className="email-header-field">
                <span className="field-label">To:</span>
                <span className="field-val">alex.johnson@example.com</span>
              </div>
              <div className="email-header-field subject-field">
                <span className="field-label">Subject:</span>
                <span className="field-val subject-text">{previewSubject || '—'}</span>
              </div>
              <div className="email-body-preview-text" style={{ background: '#f4f7fb', padding: '24px 16px' }}>
                <div className="pdf-page-mock" style={{ margin: '0 auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', maxWidth: '440px', position: 'relative', overflow: 'hidden' }}>
                  {/* Subtle Diagonal Watermark */}
                  <div 
                    style={{
                      position: 'absolute',
                      top: '55%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-25deg)',
                      fontSize: '32px',
                      fontWeight: '900',
                      color: 'rgba(66, 133, 244, 0.03)',
                      pointerEvents: 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      whiteSpace: 'nowrap',
                      fontFamily: 'Inter, sans-serif',
                      zIndex: 0
                    }}
                  >
                    OpenmindProjects
                  </div>

                  {/* Logo and stamp */}
                  <div className="pdf-mock-header" style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
                      <img src="/omp-logo.png" alt="OMP Logo" style={{ height: '28px', width: 'auto' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--brand-blue)', lineHeight: '1.2' }}>OpenmindProjects</span>
                        <span style={{ fontSize: '7.5px', fontWeight: '700', color: 'var(--color-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>OFFICIAL DONATION RECEIPT</span>
                      </div>
                    </div>
                    <div className="pdf-mock-stamp">
                      <span className="stamp-text">OMP<br/>VERIFIED<br/>DONOR</span>
                    </div>
                  </div>

                  {/* Zebra metadata block */}
                  <div className="pdf-mock-card" style={{ position: 'relative', zIndex: 2 }}>
                    <div className="pdf-row odd">
                      <span className="row-lbl">Receipt Number:</span>
                      <span className="row-val monospace">ch_3M2z8xFLs5K7dK</span>
                    </div>
                    <div className="pdf-row">
                      <span className="row-lbl">Transaction Date:</span>
                      <span className="row-val">{variables.date}</span>
                    </div>
                    <div className="pdf-row odd">
                      <span className="row-lbl">Donor Name:</span>
                      <span className="row-val">Alex Johnson</span>
                    </div>
                    <div className="pdf-row">
                      <span className="row-lbl">Donor Email:</span>
                      <span className="row-val" style={{ color: 'var(--brand-blue)', textDecoration: 'underline' }}>alex.johnson@example.com</span>
                    </div>
                    <div className="pdf-row odd">
                      <span className="row-lbl">Country:</span>
                      <span className="row-val">United States</span>
                    </div>
                    <div className="pdf-row amount-highlight-row">
                      <span className="row-lbl font-bold">Donation Amount:</span>
                      <span className="row-val amount-val">$25.00{isRecurring ? ' / Month' : ''}</span>
                    </div>
                    <div className="pdf-row odd">
                      <span className="row-lbl">{isRecurring ? 'Subscription Tier:' : 'Donation Type:'}</span>
                      <span className="row-val font-bold">✦ {isRecurring ? variables.tierName : 'One-Time Donation'}</span>
                    </div>
                  </div>

                  {/* Thank you message & signature */}
                  <div className="pdf-mock-message-section" style={{ borderTop: '1px solid rgba(66, 133, 244, 0.08)', paddingTop: '12px', position: 'relative', zIndex: 2 }}>
                    <p className="pdf-mock-thankyou" style={{ whiteSpace: 'pre-wrap' }}>{previewThankYou || '—'}</p>
                    <div className="pdf-mock-signature">
                      <span className="sig-salutation">Sincerely,</span>
                      <span className="sig-name">{previewSignature || '—'}</span>
                    </div>
                  </div>

                  {/* Attachment Box */}
                  <div className="pdf-mock-footer-note" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '8px 10px', display: 'flex', gap: '6px', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <span style={{ color: 'var(--brand-green)', fontSize: '12px', lineHeight: '1' }}>📎</span>
                    <p className="footer-note-text" style={{ color: 'var(--brand-green)', fontSize: '8.5px', fontWeight: '600', margin: '0', lineHeight: '1.4', textAlign: 'left' }}>
                      Your official receipt PDF (<strong>OMP_Donation_Receipt_ch_3M2z8.pdf</strong>) is attached to this email.
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="pdf-mock-bottom-copyright" style={{ borderTop: '0.5px solid #dadce0', paddingTop: '8px', fontSize: '7px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '12px', position: 'relative', zIndex: 2 }}>
                    If you have questions about this donation, please reply to this email.<br/>
                    &copy; {new Date().getFullYear()} OpenmindProjects. All rights reserved.
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pdf-preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="pdf-page-mock"
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              <div 
                style={{
                  position: 'absolute',
                  top: '55%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-25deg)',
                  fontSize: '44px',
                  fontWeight: '900',
                  color: 'rgba(66, 133, 244, 0.03)',
                  pointerEvents: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Inter, sans-serif',
                  zIndex: 0
                }}
              >
                OpenmindProjects
              </div>
              <div className="pdf-page-a4" style={{ position: 'relative', zIndex: 2 }}>
                {/* PDF Header Logo and Stamp */}
                <div className="pdf-mock-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                    <img src="/omp-logo.png" alt="OMP Logo" style={{ height: '36px', width: 'auto' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--brand-blue)', lineHeight: '1.2' }}>OpenmindProjects</span>
                      <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--color-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>OFFICIAL DONATION RECEIPT</span>
                    </div>
                  </div>
                  <div className="pdf-mock-stamp">
                    <span className="stamp-text">OMP<br/>VERIFIED<br/>DONOR</span>
                  </div>
                </div>

                {/* Zebra metadata block */}
                <div className="pdf-mock-card">
                  <div className="pdf-row odd">
                    <span className="row-lbl">Receipt Number:</span>
                    <span className="row-val monospace">ch_3M2z8xFLs5K7dK</span>
                  </div>
                  <div className="pdf-row">
                    <span className="row-lbl">Transaction Date:</span>
                    <span className="row-val">{variables.date}</span>
                  </div>
                  <div className="pdf-row odd">
                    <span className="row-lbl">Donor Name:</span>
                    <span className="row-val">Alex Johnson</span>
                  </div>
                  <div className="pdf-row">
                    <span className="row-lbl">Donor Email:</span>
                    <span className="row-val">alex.johnson@example.com</span>
                  </div>
                  <div className="pdf-row odd">
                    <span className="row-lbl">Country:</span>
                    <span className="row-val">United States</span>
                  </div>
                  <div className="pdf-row amount-highlight-row">
                    <span className="row-lbl font-bold">Donation Amount:</span>
                    <span className="row-val amount-val">$25.00{isRecurring ? ' / Month' : ''}</span>
                  </div>
                  <div className="pdf-row odd">
                    <span className="row-lbl">{isRecurring ? 'Subscription Tier:' : 'Donation Type:'}</span>
                    <span className="row-val font-bold">✦ {isRecurring ? variables.tierName : 'One-Time Donation'}</span>
                  </div>
                </div>

                {/* Thank you message & signature */}
                <div className="pdf-mock-message-section">
                  <p className="pdf-mock-thankyou">{previewThankYou || '—'}</p>
                  <div className="pdf-mock-signature">
                    <span className="sig-salutation">Sincerely,</span>
                    <span className="sig-name">{previewSignature || '—'}</span>
                  </div>
                </div>

                {/* Green notice banner */}
                <div className="pdf-mock-footer-note">
                  <span className="star-icon">✦</span>
                  <p className="footer-note-text">{previewFooter || '—'}</p>
                </div>

                {/* Absolute bottom copyright */}
                <div className="pdf-mock-bottom-copyright">
                  &copy; {new Date().getFullYear()} OpenmindProjects. All rights reserved. | This receipt is auto-generated.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

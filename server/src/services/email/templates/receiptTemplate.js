// Template for building OMP donation receipt emails

const BRAND_BLUE  = '#4285f4';
const BRAND_GREEN = '#34a853';
const BRAND_DARK  = '#202124';
const BRAND_MUTED = '#6b7280';

/**
 * Replaces newlines with HTML line break tags to preserve text formatting.
 * 
 * @param {string} text - Raw template text
 * @returns {string} Text formatted for HTML email
 */
function formatHtmlText(text) {
  if (!text) return '';
  return text.replace(/\n/g, '<br/>');
}

/**
 * Builds the premium HTML body for a donation receipt email.
 *
 * Why? Keeping this layout isolated allows rendering exact branded emails
 * that mirror in-app donation receipts, matching the project design system.
 *
 * @param {Object} receiptData - Donation metadata.
 * @param {string} pdfFilename - Attached PDF filename.
 * @returns {string} Compiled HTML string.
 */
export function buildReceiptHtml(receiptData, pdfFilename) {
  const {
    amount,
    transactionId,
    date,
    donorName  = 'Valued Donor',
    donorEmail = '\u2014',
    country    = 'Not specified',
    tierName   = 'Supporter',
    tierPerks  = [],
    pdfThankYouMessage = 'We appreciate your generous support.',
    pdfSignatureName   = 'The OpenmindProjects Team',
    isRecurring        = false,
  } = receiptData;

  const amountFormatted = '$' + (amount / 100).toFixed(2);
  const dateFormatted   = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const year = new Date().getFullYear();

  const labelStyle = 'padding:8px 16px;font-size:12.5px;color:' + BRAND_MUTED + ';border-bottom:1px solid rgba(66,133,244,0.08);vertical-align:middle;width:45%;';
  const valueStyle = 'padding:8px 16px;font-size:12.5px;color:' + BRAND_DARK + ';font-weight:700;border-bottom:1px solid rgba(66,133,244,0.08);text-align:right;vertical-align:middle;';

  const rows = [
    { label: 'Receipt Number:',   value: '<span style="font-family:monospace;font-size:11px;">' + transactionId + '</span>', even: true  },
    { label: 'Transaction Date:', value: dateFormatted,  even: false },
    { label: 'Donor Name:',       value: donorName,       even: true  },
    { label: 'Donor Email:',      value: donorEmail,      even: false },
    { label: 'Country:',          value: country,         even: true  },
  ];

  const rowsHtml = rows.map(function(r) {
    const bg = r.even ? 'rgba(66,133,244,0.03)' : '#ffffff';
    return '<tr style="background:' + bg + ';">'
      + '<td style="' + labelStyle + '">' + r.label + '</td>'
      + '<td style="' + valueStyle + '">' + r.value + '</td>'
      + '</tr>';
  }).join('');

  const perksHtml = tierPerks.length > 0
    ? '<ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:1.85;">'
      + tierPerks.map(function(p) { return '<li style="margin-bottom:2px;">' + p + '</li>'; }).join('')
      + '</ul>'
    : '';

  return '<!DOCTYPE html>\n'
    + '<html lang="en">\n'
    + '<head>\n'
    + '  <meta charset="UTF-8" />\n'
    + '  <meta name="viewport" content="width=device-width,initial-scale=1.0" />\n'
    + '  <title>OMP Donation Receipt</title>\n'
    + '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />\n'
    + '</head>\n'
    + '<body style="margin:0;padding:0;background:#f4f7fb;font-family:\'Inter\',Helvetica,Arial,sans-serif;">\n'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">\n'
    + '<tr><td align="center">\n'
    + '<table width="600" cellpadding="0" cellspacing="0" style="'
    +   'max-width:600px;width:100%;'
    +   'background:#ffffff;'
    +   'border:1px solid rgba(66,133,244,0.25);'
    +   'border-radius:12px;'
    +   'overflow:hidden;'
    +   'box-shadow:0 4px 20px rgba(66,133,244,0.08);">\n'
    + '<tr><td style="padding:20px 24px 16px;border-bottom:2px solid rgba(66,133,244,0.15);">\n'
    + '  <table width="100%" cellpadding="0" cellspacing="0"><tr>\n'
    + '    <td valign="middle">\n'
    + '      <table cellpadding="0" cellspacing="0"><tr>\n'
    + '        <td valign="middle">\n'
    + '          <img src="https://file.9o9.io/api/public/dl/HyDoVbXE/home/rootmind/ai4g/Openmind_Projects_Logo.svg" alt="Openmind Projects Logo" width="180" style="display:block;width:180px;height:auto;" />\n'
    + '        </td>\n'
    + '      </tr>\n'
    + '      <tr>\n'
    + '        <td valign="middle" style="padding-top:6px;">\n'
    + '          <div style="font-size:8px;color:' + BRAND_MUTED + ';text-transform:uppercase;letter-spacing:0.09em;font-weight:700;line-height:1.2;">Official Donation Receipt</div>\n'
    + '        </td>\n'
    + '      </tr></table>\n'
    + '    </td>\n'
    + '    <td align="right" valign="middle">\n'
    + '      <table cellpadding="0" cellspacing="0"><tr>\n'
    + '        <td width="72" height="72" align="center" valign="middle" style="'
    +           'width:72px;height:72px;'
    +           'border-radius:50%;'
    +           'border:2.5px solid ' + BRAND_GREEN + ';'
    +           'background:rgba(52,168,83,0.02);'
    +           '">\n'
    + '          <span style="'
    +             'color:' + BRAND_GREEN + ';'
    +             'font-size:7px;font-weight:900;'
    +             'text-transform:uppercase;'
    +             'letter-spacing:0.05em;'
    +             'line-height:1.5;'
    +             'display:block;text-align:center;'
    +           '">OMP<br/>VERIFIED<br/>DONOR</span>\n'
    + '        </td>\n'
    + '      </tr></table>\n'
    + '    </td>\n'
    + '  </tr></table>\n'
    + '</td></tr>\n'
    + '<tr><td style="position:relative;padding:0;">\n'
    + '<div style="'
    +   'position:absolute;top:50%;left:50%;'
    +   'transform:translate(-50%,-50%) rotate(-25deg);'
    +   'font-size:40px;font-weight:900;'
    +   'color:rgba(66,133,244,0.04);'
    +   'text-transform:uppercase;'
    +   'letter-spacing:0.08em;'
    +   'white-space:nowrap;'
    +   'pointer-events:none;'
    +   'font-family:\'Inter\',Helvetica,Arial,sans-serif;'
    + '">OpenmindProjects</div>\n'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="position:relative;z-index:1;">\n'
    + rowsHtml
    + '<tr style="background:rgba(66,133,244,0.06);">\n'
    + '  <td style="'
    +     'padding:10px 16px;'
    +     'font-size:13px;font-weight:700;'
    +     'color:' + BRAND_DARK + ';'
    +     'border-top:1px solid rgba(66,133,244,0.2);'
    +     'border-bottom:1px solid rgba(66,133,244,0.2);'
    +   '">Donation Amount:</td>\n'
    + '  <td style="'
    +     'padding:10px 16px;'
    +     'font-size:14px;font-weight:800;'
    +     'color:' + BRAND_BLUE + ';'
    +     'text-align:right;'
    +     'border-top:1px solid rgba(66,133,244,0.2);'
    +     'border-bottom:1px solid rgba(66,133,244,0.2);'
    +   '">' + amountFormatted + (isRecurring ? ' / Month' : '') + '</td>\n'
    + '</tr>\n'
    + '<tr style="background:#ffffff;">\n'
    + '  <td style="padding:8px 16px;font-size:12.5px;color:' + BRAND_MUTED + ';vertical-align:middle;">' + (isRecurring ? 'Subscription Tier:' : 'Donation Type:') + '</td>\n'
    + '  <td style="padding:8px 16px;font-size:12.5px;color:' + BRAND_DARK + ';font-weight:700;text-align:right;">\u2746 ' + (isRecurring ? tierName : 'One-Time Donation') + '</td>\n'
    + '</tr>\n'
    + '</table>\n'
    + '</td></tr>\n'
    + (perksHtml
      ? '<tr><td style="padding:14px 20px 6px;">\n'
        + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:' + BRAND_MUTED + ';letter-spacing:0.07em;margin-bottom:6px;">Tier Benefits Activated:</div>\n'
        + perksHtml
        + '\n</td></tr>\n'
      : '')
    + '<tr><td style="padding:16px 20px 10px;border-top:1px solid rgba(66,133,244,0.08);">\n'
    + '  <p style="font-size:12.5px;line-height:1.6;color:' + BRAND_DARK + ';margin:0 0 14px;">' + formatHtmlText(pdfThankYouMessage) + '</p>\n'
    + '  <div style="font-size:11.5px;color:' + BRAND_MUTED + ';margin-bottom:2px;">Sincerely,</div>\n'
    + '  <div style="font-size:12.5px;font-weight:bold;color:' + BRAND_DARK + ';">' + pdfSignatureName + '</div>\n'
    + '</td></tr>\n'
    + '<tr><td style="padding:14px 20px 8px;">\n'
    + '  <div style="'
    +     'background:#f0fdf4;'
    +     'border:1px solid #bbf7d0;'
    +     'border-radius:8px;'
    +     'padding:10px 14px;'
    +     'font-size:11.5px;'
    +     'color:' + BRAND_GREEN + ';'
    +     'font-weight:600;'
    +   '">&#128206; Your official receipt PDF (<strong>' + pdfFilename + '</strong>) is attached to this email.</div>\n'
    + '</td></tr>\n'
    + '<tr><td style="padding:14px 20px 24px;">\n'
    + '  <div style="height:1px;background:rgba(66,133,244,0.12);margin-bottom:14px;"></div>\n'
    + '  <p style="font-size:11px;color:#a0aec0;text-align:center;margin:0;line-height:1.65;">\n'
    + '    If you have questions about this donation, please reply to this email.<br/>\n'
    + '    &copy; ' + year + ' OpenmindProjects. All rights reserved.\n'
    + '  </p>\n'
    + '</td></tr>\n'
    + '</table>\n'
    + '</td></tr>\n'
    + '</table>\n'
    + '</body>\n'
    + '</html>';
}

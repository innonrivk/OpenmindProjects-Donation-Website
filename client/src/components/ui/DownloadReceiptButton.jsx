import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Loader2 } from 'lucide-react';
import { adminApi } from '../../lib/api.js';
import './Button.css';

/**
 * DownloadReceiptButton — Triggers an admin PDF download for a specific transaction receipt.
 *
 * Why isolated? Both TransactionRow and DispatchLogViewer need this behavior.
 * Centralizing prevents duplicated blob-handling logic and ensures consistent
 * error handling and loading states across both surfaces.
 *
 * @param {object} props
 * @param {string} props.transactionId - The transaction ID to fetch the receipt for.
 * @param {string} [props.lastName] - Donor last name for filename template.
 * @param {string} [props.createdAt] - Transaction date.
 * @param {string} [props.label="Receipt PDF"] - Text label.
 * @param {string} [props.className=""] - Extra CSS classes.
 * @returns {JSX.Element}
 */
export default function DownloadReceiptButton({
  transactionId,
  lastName = 'Unknown',
  createdAt = '',
  label = 'Receipt PDF',
  className = '',
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);

    try {
      const response = await adminApi.get(`/transactions/${transactionId}/receipt`, {
        responseType: 'blob',
      });

      // Format clean default filename using date and donor name
      let dateStr = new Date().toISOString().slice(0, 10);
      if (createdAt) {
        try {
          dateStr = new Date(createdAt).toISOString().slice(0, 10);
        } catch {
          // ignore parsing errors
        }
      }
      
      const cleanLastName = lastName.replace(/[^a-zA-Z0-9_-]/g, '');
      let filename = `OMP-receipt-${cleanLastName}-${dateStr}.pdf`;

      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download PDF receipt. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.button
      type="button"
      className={`btn btn--secondary btn--sm ${downloading ? 'btn--loading' : ''} ${className}`}
      onClick={handleDownload}
      disabled={downloading}
      whileHover={{ scale: 1.02, translateY: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
    >
      {downloading ? (
        <Loader2 className="btn__spinner animate-spin" size={14} style={{ position: 'static' }} />
      ) : (
        <FileDown size={14} />
      )}
      <span>{downloading ? 'Downloading...' : label}</span>
    </motion.button>
  );
}

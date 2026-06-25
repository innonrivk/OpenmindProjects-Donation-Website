import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Loader2 } from 'lucide-react';
import { adminApi } from '../../lib/api.js';
import './Button.css'; // Reuse core button styles

/**
 * A brand-styled button that handles Excel file downloads with micro-animations.
 *
 * Why? Provides a reusable, animated control for reports and exports.
 * Fetches the target as a binary blob and triggers browser-native download,
 * handling auth tokens transparently via adminApi interceptors.
 *
 * @param {object} props - Component props.
 * @param {string} [props.endpoint="/transactions/analytics/donations/download"] - API route.
 * @param {string} [props.defaultFilename="donation_analytics.xlsx"] - Fallback filename.
 * @param {string} [props.label="Download Excel"] - Text label.
 * @param {string} [props.className=""] - Extra CSS classes.
 */
export default function DownloadButton({
  endpoint = '/transactions/analytics/donations/download',
  defaultFilename = 'donation_analytics.xlsx',
  label = 'Download Excel',
  className = '',
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await adminApi.get(endpoint, {
        responseType: 'blob',
      });

      // Attempt to extract filename from Content-Disposition header
      let filename = defaultFilename;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      // Create local URL for the downloaded blob and trigger a click
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Clean up DOM and revoke object URL
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Direct logging omitted in production, but alert the user if export fails
      alert('Failed to export spreadsheet. Please try again.');
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
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
    >
      {downloading ? (
        <Loader2 className="btn__spinner animate-spin" size={16} style={{ position: 'static' }} />
      ) : (
        <Download size={16} />
      )}
      <span>{downloading ? 'Exporting...' : label}</span>
    </motion.button>
  );
}

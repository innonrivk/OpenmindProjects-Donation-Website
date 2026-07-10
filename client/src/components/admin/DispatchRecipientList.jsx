import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api.js';

/**
 * DispatchRecipientList renders a paginated list of recipient emails, their delivery
 * statuses, and error messages (if any) for audit trailing.
 *
 * Why this is separate: This modular sub-component isolates the lazy loading of recipients
 * and avoids adding additional layout state and hook counts inside the main viewer.
 */
export default function DispatchRecipientList({ dispatchId }) {
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const limit = 5;

  const { data = { items: [], total: 0 }, isLoading, isError } = useQuery({
    queryKey: ['admin-dispatch-recipients', dispatchId, page],
    queryFn: async () => {
      const { data } = await adminApi.get(
        `/communications/dispatch-logs/${dispatchId}/recipients?page=${page}&limit=${limit}`
      );
      return data;
    },
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      // Why arraybuffer instead of blob responseType?
      // axios blob responseType can misinterpret binary XLSX data on some browsers.
      // arraybuffer ensures the raw bytes are preserved exactly before wrapping in a Blob.
      const response = await adminApi.get(`/communications/dispatch-logs/${dispatchId}/recipients/export`, {
        responseType: 'arraybuffer',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dispatch-recipients-${dispatchId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export recipients failed:', err);
      setExportError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = Math.ceil(data.total / limit);

  if (isLoading) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
        Loading recipient details...
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '16px', color: 'var(--brand-red)', fontSize: '13px' }}>
        Failed to load recipient details.
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
        No recipient logs recorded for this dispatch.
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '6px', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '16px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
          Recipient Audit Log ({data.total} total)
        </h4>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="cms-btn cms-btn--secondary"
          style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {isExporting ? 'Exporting...' : '📥 Export to Excel'}
        </button>
      </div>
      {exportError && (
        <div style={{ color: 'var(--brand-red)', fontSize: '11px', marginBottom: '8px' }}>
          {exportError}
        </div>
      )}
      <table className="cms-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', opacity: 0.8 }}>
            <th style={{ padding: '8px' }}>Email Address</th>
            <th style={{ padding: '8px' }}>Status</th>
            <th style={{ padding: '8px' }}>Error Details</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((recipient) => (
            <tr key={recipient.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <td style={{ padding: '8px', fontWeight: 500 }}>
                {recipient.email}
              </td>
              <td style={{ padding: '8px' }}>
                <span className={`log-status-badge ${recipient.status.toLowerCase()}`}>
                  {recipient.status}
                </span>
              </td>
              <td style={{ padding: '8px', color: 'var(--brand-red)' }}>
                {recipient.errorReason || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center', fontSize: '11px' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

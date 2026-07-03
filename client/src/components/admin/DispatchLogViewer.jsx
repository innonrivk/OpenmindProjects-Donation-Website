import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api.js';

export default function DispatchLogViewer() {
  const [page, setPage] = useState(1);
  const limit = 10;

  // Fetch dispatch logs
  const { data = { items: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['admin-dispatch-logs', page],
    queryFn: async () => {
      const { data } = await adminApi.get(`/communications/dispatch-logs?page=${page}&limit=${limit}`);
      return data;
    },
  });

  const totalPages = Math.ceil(data.total / limit);

  if (isLoading) {
    return <div className="admin-loading">Loading dispatch logs...</div>;
  }

  return (
    <div>
      <h3 style={{ marginBottom: '16px' }}>Communication Audit Trail</h3>

      {data.items.length === 0 ? (
        <p>No communications have been dispatched yet.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table className="cms-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Template Name</th>
                  <th style={{ padding: '12px' }}>Triggered By</th>
                  <th style={{ padding: '12px' }}>Recipients</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Errors</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      {log.template?.name || `Template #${log.emailTemplateId}`}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      {log.triggeredBy === 'SYSTEM' ? (
                        <span style={{ color: 'var(--brand-blue)', fontWeight: 600 }}>⚡ SYSTEM</span>
                      ) : (
                        `Admin (${log.triggeredBy.slice(0, 8)})`
                      )}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      {log.recipientCount}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`log-status-badge ${log.status.toLowerCase()}`}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: 'var(--brand-red)' }}>
                      {log.errorMessage || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span style={{ alignSelf: 'center', fontSize: '13px' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

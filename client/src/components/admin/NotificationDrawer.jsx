import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api.js';

export default function NotificationDrawer({ onClose }) {
  const queryClient = useQueryClient();

  // Fetch paginated notifications list
  const { data = { items: [] }, isLoading } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data } = await adminApi.get('/notifications?limit=30');
      return data;
    },
  });

  const readMutation = useMutation({
    mutationFn: async (id) => {
      return adminApi.put(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notif-unread'] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      return adminApi.put('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notif-unread'] });
    },
  });

  return (
    <>
      {/* Backdrop overlay to close drawer */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.2)',
          zIndex: 1050,
        }}
      />

      <div className="notif-drawer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
          <h4 style={{ margin: 0 }}>System Notifications</h4>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div>Loading notifications...</div>
        ) : (
          <>
            {data.items.length > 0 && (
              <button
                type="button"
                onClick={() => readAllMutation.mutate()}
                className="cms-btn cms-btn--secondary"
                style={{ fontSize: '11px', width: '100%', marginBottom: '16px' }}
                disabled={readAllMutation.isPending}
              >
                ✓ Mark All as Read
              </button>
            )}

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {data.items.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: '32px' }}>
                  No notifications yet.
                </p>
              ) : (
                data.items.map((notif) => (
                  <div
                    key={notif.id}
                    className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
                    onClick={() => {
                      if (!notif.isRead) readMutation.mutate(notif.id);
                    }}
                    style={{ cursor: notif.isRead ? 'default' : 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '13px' }}>{notif.title}</strong>
                      {!notif.isRead && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            background: '#ea4335',
                            borderRadius: '50%',
                            display: 'inline-block',
                          }}
                        />
                      )}
                    </div>
                    <p style={{ fontSize: '12px', margin: '4px 0', color: 'var(--color-text-secondary)' }}>
                      {notif.message}
                    </p>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

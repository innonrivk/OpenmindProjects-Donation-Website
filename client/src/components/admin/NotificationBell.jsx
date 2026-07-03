import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api.js';
import NotificationDrawer from './NotificationDrawer.jsx';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  // Poll unread notification count every 30 seconds
  const { data = { count: 0 } } = useQuery({
    queryKey: ['notif-unread'],
    queryFn: async () => {
      const { data } = await adminApi.get('/notifications/unread-count');
      return data;
    },
    refetchInterval: 30000,
  });

  return (
    <>
      <div className="notification-bell-container" onClick={() => setIsOpen(true)}>
        <span style={{ fontSize: '18px' }}>🔔</span>
        {data.count > 0 && (
          <span className="notification-bell-badge">
            {data.count > 99 ? '99+' : data.count}
          </span>
        )}
      </div>

      {isOpen && <NotificationDrawer onClose={() => setIsOpen(false)} />}
    </>
  );
}

import { createContext, useContext, useState, useEffect, useRef } from 'react';

const NotificationContext = createContext();

const MAX_NOTIFICATIONS = 20;

// Categories that count as "actionable" (not just informational pings)
const ACTIONABLE_CATEGORIES = ['alert', 'security', 'vision', 'system'];

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [latestStatus, setLatestStatus] = useState({ status: 'healthy', message: 'System Offline' });
  const [unreadCount, setUnreadCount] = useState(0);
  // Track ID of the last notification seen when panel was opened
  const lastSeenIdRef = useRef(null);

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const token = sessionStorage.getItem('token') || '';
    const wsUrl = `${wsProtocol}//${wsHost}/ws/system-status?token=${token}`;

    let socket = null;
    let reconnectTimer = null;

    function connect() {
      if (!token) return;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setLatestStatus(prev => ({ ...prev, message: 'System: Active' }));
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const msgType = parsed.type || parsed.event;

          // ── Handle generic system health (Agregator heartbeat) ──
          if (msgType === 'system_health') {
            const data = parsed.data || {};
            const newNotif = {
              id: Date.now() + Math.random(),
              status: data.status || 'info',
              timestamp: data.timestamp || new Date().toISOString(),
              system: data.system || 'Aeroponic System',
              message: data.message || 'System Update',
              category: 'system',
            };

            setLatestStatus({ status: newNotif.status, message: newNotif.message });

            // Only push to history if it's NOT a generic "all operational" heartbeat
            const isGenericHealthy = newNotif.status === 'healthy' && newNotif.message === 'All systems operational';
            if (!isGenericHealthy) {
              pushNotification(newNotif);
            }
            return;
          }

          // ── Handle specific event alerts (sensor, actuator, vision, system events) ──
          if (msgType === 'alert') {
            const data = parsed.data || {};
            const status = data.status || 'info';
            const category = data.category || 'system';

            const newNotif = {
              id: Date.now() + Math.random(),
              status,
              timestamp: data.timestamp || new Date().toISOString(),
              system: data.system || 'Aeroponic System',
              message: data.message || 'System Event',
              category,
              module_id: data.module_id,
            };

            // Update top-bar status only for non-info/success alerts
            if (status === 'critical' || status === 'warning') {
              setLatestStatus({ status, message: newNotif.message });
            } else if (status === 'success') {
              // Resolved alerts: briefly show message then revert to healthy
              setLatestStatus({ status: 'healthy', message: newNotif.message });
            }

            pushNotification(newNotif);
            return;
          }
        } catch (err) {
          console.warn('NotificationContext: Failed to parse WS message', err);
        }
      };

      socket.onclose = () => {
        setLatestStatus({ status: 'warning', message: 'Connection Lost. Reconnecting...' });
        reconnectTimer = setTimeout(connect, 5000);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  function pushNotification(newNotif) {
    setNotifications(prev => {
      // De-duplicate: if exact same message & status in last 5s, update timestamp only
      const recent = prev[0];
      if (
        recent &&
        recent.message === newNotif.message &&
        recent.status === newNotif.status &&
        (new Date(newNotif.timestamp) - new Date(recent.timestamp)) < 5000
      ) {
        const updated = [...prev];
        updated[0] = { ...updated[0], timestamp: newNotif.timestamp };
        return updated;
      }
      return [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
    });

    // Increment unread for actionable categories
    if (ACTIONABLE_CATEGORIES.includes(newNotif.category) || newNotif.status !== 'info') {
      setUnreadCount(prev => prev + 1);
    }
  }

  const clearUnread = () => setUnreadCount(0);

  return (
    <NotificationContext.Provider value={{ notifications, latestStatus, unreadCount, clearUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}

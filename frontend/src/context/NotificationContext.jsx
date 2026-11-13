import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";
import { notificationsSocketUrl } from "../config/env";
import { unwrapList } from "../utils/apiData";
import {
  bindNotificationSoundUnlock,
  playNotificationSound,
} from "../utils/notificationSound";

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

function sortNotices(list) {
  return [...list].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

function normalizeNotice(item) {
  if (!item || item.id == null) return null;
  return {
    ...item,
    actor:
      item.actor ||
      item.content?.user ||
      item.content?.follower ||
      item.user ||
      null,
    created_at: item.created_at || new Date().toISOString(),
    is_read: Boolean(item.is_read),
  };
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef(null);
  const pollRef = useRef(null);
  const reconnectRef = useRef(null);
  const idsRef = useRef(new Set());

  const mergeNotices = useCallback((incoming, { replace = false } = {}) => {
    const list = (Array.isArray(incoming) ? incoming : [incoming])
      .map(normalizeNotice)
      .filter(Boolean);

    let added = 0;
    let nextHasUnread = false;

    setNotifications((prev) => {
      const byId = replace ? new Map() : new Map(prev.map((item) => [item.id, item]));
      added = 0;
      list.forEach((item) => {
        if (!byId.has(item.id)) added += 1;
        byId.set(item.id, { ...byId.get(item.id), ...item });
      });
      const next = sortNotices([...byId.values()]);
      nextHasUnread = next.some((item) => item.is_read === false);
      idsRef.current = new Set(byId.keys());
      return next;
    });

    if (added > 0 && !replace) {
      setHasNewNotification(true);
      playNotificationSound();
    } else if (nextHasUnread) {
      setHasNewNotification(true);
    } else if (replace) {
      setHasNewNotification(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await client.run(
        "get",
        `${endpoints.notifications}?page_size=40`,
        {},
        true
      );
      mergeNotices(unwrapList(res), { replace: true });
    } catch {
      // Keep any notices already in memory.
    } finally {
      setIsLoading(false);
    }
  }, [mergeNotices]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      loadNotifications();
    }, 60000);
  }, [loadNotifications]);

  const connectSocket = useCallback(() => {
    const token = getAuthToken();
    if (!token || typeof window === "undefined") {
      stopPolling();
      return;
    }
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    let socket;
    try {
      socket = new WebSocket(notificationsSocketUrl(token));
    } catch {
      startPolling();
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      stopPolling();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || data.id == null) return;
        mergeNotices({
          id: data.id,
          message: data.message,
          notification_type: data.notification_type,
          content: data.content,
          actor: data.user,
          user: data.user,
          created_at: new Date().toISOString(),
          is_read: false,
        });
      } catch {
        // Ignore malformed frames.
      }
    };

    socket.onerror = () => {
      startPolling();
    };

    socket.onclose = () => {
      socketRef.current = null;
      startPolling();
      reconnectRef.current = setTimeout(() => {
        connectSocket();
      }, 4000);
    };
  }, [mergeNotices, startPolling, stopPolling]);

  useEffect(() => {
    const unbindSound = bindNotificationSoundUnlock();
    if (!getAuthToken()) {
      return () => {
        unbindSound();
      };
    }

    const boot = () => {
      loadNotifications();
      connectSocket();
      // Poll only as fallback after the socket has had time to connect.
      window.setTimeout(() => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          startPolling();
        }
      }, 4000);
    };

    const idleId = window.requestIdleCallback
      ? window.requestIdleCallback(boot, { timeout: 2500 })
      : window.setTimeout(boot, 800);

    const onUser = () => {
      loadNotifications();
      connectSocket();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") loadNotifications();
    };
    window.addEventListener("userUpdated", onUser);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unbindSound();
      window.removeEventListener("userUpdated", onUser);
      document.removeEventListener("visibilitychange", onVisible);
      if (window.cancelIdleCallback && typeof idleId === "number") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      stopPolling();
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connectSocket, loadNotifications, startPolling, stopPolling]);

  const markAsRead = useCallback(async () => {
    setHasNewNotification(false);
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    try {
      await client.run("patch", endpoints.notificationsRead, {}, true);
    } catch {
      // Local read state still updates the badge.
    }
  }, []);

  const receiveNewNotification = useCallback(() => {
    setHasNewNotification(true);
  }, []);

  const notify = useMemo(
    () => ({
      notifications,
      isLoading,
      hasNewNotification,
      markAsRead,
      receiveNewNotification,
      refreshNotifications: loadNotifications,
    }),
    [notifications, isLoading, hasNewNotification, markAsRead, receiveNewNotification, loadNotifications]
  );

  return (
    <NotificationContext.Provider value={notify}>
      {children}
    </NotificationContext.Provider>
  );
};

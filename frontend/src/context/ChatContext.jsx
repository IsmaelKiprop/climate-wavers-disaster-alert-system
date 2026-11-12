import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getAuthToken, getUser } from "../utils/factory";
import { chatSocketUrl } from "../config/env";

const ChatContext = createContext(null);

export const useChatSocket = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [lastSeenMap, setLastSeenMap] = useState({});
  const socketRef = useRef(null);
  const reconnectRef = useRef(null);
  const heartbeatRef = useRef(null);
  const listenersRef = useRef(new Set());
  const joinedRef = useRef(new Set());

  const emitLocal = useCallback((event, payload) => {
    listenersRef.current.forEach((fn) => {
      try {
        fn(event, payload);
      } catch {
        // ignore listener errors
      }
    });
  }, []);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const send = useCallback((action, payload = {}) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ action, payload }));
    return true;
  }, []);

  const joinConversation = useCallback(
    (conversationId) => {
      if (!conversationId) return;
      const id = Number(conversationId);
      joinedRef.current.add(id);
      send("join", { conversation_id: id });
    },
    [send]
  );

  const leaveConversation = useCallback(
    (conversationId) => {
      if (!conversationId) return;
      const id = Number(conversationId);
      joinedRef.current.delete(id);
      send("leave", { conversation_id: id });
    },
    [send]
  );

  const sendMessage = useCallback(
    (conversationId, body, clientId, extra = {}) =>
      send("send_message", {
        conversation_id: Number(conversationId),
        body: body || "",
        client_id: clientId,
        media_url: extra.media_url || "",
        media_type: extra.media_type || "",
        mentions: Array.isArray(extra.mentions) ? extra.mentions : [],
      }),
    [send]
  );

  const sendTyping = useCallback(
    (conversationId, isTyping) =>
      send(isTyping ? "typing_start" : "typing_stop", {
        conversation_id: Number(conversationId),
      }),
    [send]
  );

  const markRead = useCallback(
    (conversationId, messageId) =>
      send("mark_read", {
        conversation_id: Number(conversationId),
        message_id: messageId,
      }),
    [send]
  );

  const applyPresence = useCallback((payload) => {
    if (!payload?.user_id) return;
    const id = Number(payload.user_id);
    setOnlineIds((prev) => {
      const next = new Set(prev);
      if (payload.is_online) next.add(id);
      else next.delete(id);
      return next;
    });
    if (payload.last_seen) {
      setLastSeenMap((prev) => ({ ...prev, [id]: payload.last_seen }));
    }
  }, []);

  const seedOnline = useCallback((ids = []) => {
    setOnlineIds(new Set((ids || []).map(Number)));
  }, []);

  const connect = useCallback(() => {
    const token = getAuthToken();
    if (!token || typeof window === "undefined") return;
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    let socket;
    try {
      socket = new WebSocket(chatSocketUrl(token));
    } catch {
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      joinedRef.current.forEach((id) => {
        socket.send(JSON.stringify({ action: "join", payload: { conversation_id: id } }));
      });
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: "heartbeat", payload: {} }));
        }
      }, 25000);
    };

    socket.onmessage = (evt) => {
      let data;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      const event = data?.event;
      const payload = data?.payload;
      if (event === "presence") {
        applyPresence(payload);
      }
      emitLocal(event, payload);
    };

    socket.onclose = () => {
      setConnected(false);
      socketRef.current = null;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (getAuthToken()) {
        reconnectRef.current = setTimeout(connect, 2500);
      }
    };

    socket.onerror = () => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    };
  }, [applyPresence, emitLocal]);

  useEffect(() => {
    const user = getUser();
    if (!user?.id && !getAuthToken()) return undefined;

    // Defer chat socket so first paint / route chunks win the network.
    let idleId;
    let timeoutId;
    const start = () => connect();
    if (typeof window !== "undefined" && window.requestIdleCallback) {
      idleId = window.requestIdleCallback(start, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(start, 1200);
    }

    return () => {
      if (idleId && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // ignore
        }
        socketRef.current = null;
      }
    };
  }, [connect]);

  const value = useMemo(
    () => ({
      connected,
      onlineIds,
      lastSeenMap,
      subscribe,
      joinConversation,
      leaveConversation,
      sendMessage,
      sendTyping,
      markRead,
      seedOnline,
      isOnline: (userId) => onlineIds.has(Number(userId)),
    }),
    [
      connected,
      onlineIds,
      lastSeenMap,
      subscribe,
      joinConversation,
      leaveConversation,
      sendMessage,
      sendTyping,
      markRead,
      seedOnline,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

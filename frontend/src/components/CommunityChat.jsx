import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IoArrowBack,
  IoChatbubblesOutline,
  IoCheckmarkDone,
  IoPeopleOutline,
  IoSearchOutline,
  IoSend,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { avatarUrl, getUser } from "../utils/factory";
import { useChatSocket } from "../context/ChatContext";
import { unwrapList } from "../utils/apiData";

function displayName(person) {
  if (!person) return "Member";
  const full = `${person.first_name || ""} ${person.last_name || ""}`.trim();
  return full || person.username || "Member";
}

function formatClock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatLastSeen(iso, isOnline) {
  if (isOnline) return "online";
  if (!iso) return "offline";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "offline";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "last seen just now";
  if (diff < 3_600_000) return `last seen ${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `last seen ${Math.floor(diff / 3_600_000)}h ago`;
  return `last seen ${d.toLocaleDateString()}`;
}

function roomIcon(type) {
  if (type === "responder") return IoShieldCheckmarkOutline;
  if (type === "community" || type === "group") return IoPeopleOutline;
  return IoChatbubblesOutline;
}

function clientMessageId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const CommunityChat = () => {
  const me = getUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const chat = useChatSocket() || {};
  const {
    connected,
    subscribe,
    joinConversation,
    leaveConversation,
    sendMessage,
    sendTyping,
    markRead,
    seedOnline,
    isOnline,
    lastSeenMap,
  } = chat;

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [directory, setDirectory] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [dirQuery, setDirQuery] = useState("");
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingActiveRef = useRef(false);
  const activeIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => Number(c.id) === Number(activeId)) || null,
    [conversations, activeId]
  );

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const res = await client.run("get", endpoints.chatConversations, {}, true);
      const list = res?.conversations || unwrapList(res) || [];
      setConversations(list);
      if (Array.isArray(res?.online_user_ids) && seedOnline) {
        seedOnline(res.online_user_ids);
      }
      return list;
    } catch {
      setListError("Could not load chats. Check your connection and try again.");
      return [];
    } finally {
      setLoadingList(false);
    }
  }, [seedOnline]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setLoadingMessages(true);
    try {
      const res = await client.run(
        "get",
        endpoints.chatMessages(conversationId),
        {},
        true
      );
      setMessages(res?.messages || []);
      const last = (res?.messages || []).at(-1);
      if (last?.id && markRead) {
        markRead(conversationId, last.id);
        try {
          await client.run(
            "post",
            endpoints.chatRead(conversationId),
            { message_id: last.id },
            true
          );
        } catch {
          // WS mark is enough when online
        }
      }
      setConversations((prev) =>
        prev.map((c) =>
          Number(c.id) === Number(conversationId) ? { ...c, unread_count: 0 } : c
        )
      );
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [markRead]);

  const openDmWithUser = useCallback(
    async (dmUserId) => {
      if (!dmUserId) return null;
      const conv = await client.run(
        "post",
        endpoints.chatDm,
        { user_id: Number(dmUserId) },
        true
      );
      setConversations((prev) => {
        if (prev.some((c) => Number(c.id) === Number(conv.id))) {
          return prev.map((c) =>
            Number(c.id) === Number(conv.id) ? { ...c, ...conv } : c
          );
        }
        return [conv, ...prev];
      });
      setActiveId(conv.id);
      setMobileShowThread(true);
      setShowNewChat(false);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("dm");
          next.set("c", String(conv.id));
          return next;
        },
        { replace: true }
      );
      return conv;
    },
    [setSearchParams]
  );

  useEffect(() => {
    let cancelled = false;
    loadConversations().then(async (list) => {
      if (cancelled) return;
      const fromQuery = searchParams.get("c");
      const dmUserId = searchParams.get("dm");
      // Fresh DM deep-links are handled by the dedicated effect below
      if (dmUserId) return;
      const preferred =
        (fromQuery && list.find((c) => String(c.id) === String(fromQuery))) ||
        list.find((c) => c.conversation_type === "community") ||
        list[0];
      if (preferred) {
        setActiveId(preferred.id);
        if (typeof window !== "undefined" && window.innerWidth >= 768) {
          setMobileShowThread(true);
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // Bootstrap once on mount; deep-links handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConversations]);

  // Open a conversation when Groups (or shares) navigate with ?c=
  useEffect(() => {
    const fromQuery = searchParams.get("c");
    if (!fromQuery || searchParams.get("dm")) return undefined;
    if (String(activeId) === String(fromQuery)) return undefined;

    let cancelled = false;
    (async () => {
      let found = conversations.find((c) => String(c.id) === String(fromQuery));
      if (!found) {
        const list = await loadConversations();
        if (cancelled) return;
        found = list.find((c) => String(c.id) === String(fromQuery));
      }
      if (found && !cancelled) {
        setActiveId(found.id);
        setMobileShowThread(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only react to the conversation deep-link changing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("c")]);

  // Open a DM whenever ?dm= appears (profile Message, contacts Chat, etc.)
  useEffect(() => {
    const dmUserId = searchParams.get("dm");
    if (!dmUserId) return undefined;
    let cancelled = false;
    openDmWithUser(dmUserId).catch(() => {
      if (!cancelled) setListError("Could not start that conversation.");
    });
    return () => {
      cancelled = true;
    };
  }, [searchParams, openDmWithUser]);

  useEffect(() => {
    if (!activeId) return undefined;
    joinConversation?.(activeId);
    loadMessages(activeId);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("c", String(activeId));
        return next;
      },
      { replace: true }
    );
    return () => leaveConversation?.(activeId);
  }, [activeId, joinConversation, leaveConversation, loadMessages, setSearchParams]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, activeId]);

  useEffect(() => {
    if (!subscribe) return undefined;
    return subscribe((event, payload) => {
      if (event === "message" && payload) {
        const convId = Number(payload.conversation_id);
        const mine =
          payload.is_mine ||
          Number(payload.sender?.id) === Number(me?.id);

        setConversations((prev) => {
          const next = prev.map((c) => {
            if (Number(c.id) !== convId) return c;
            if (c.last_message?.id && c.last_message.id === payload.id) return c;
            return {
              ...c,
              last_message: payload,
              updated_at: payload.created_at || c.updated_at,
              unread_count:
                Number(activeIdRef.current) === convId || mine
                  ? 0
                  : (c.unread_count || 0) + 1,
            };
          });
          next.sort(
            (a, b) =>
              new Date(b.updated_at || 0).getTime() -
              new Date(a.updated_at || 0).getTime()
          );
          return next;
        });

        if (Number(activeIdRef.current) === convId) {
          setMessages((prev) => {
            if (payload.client_id && prev.some((m) => m.client_id === payload.client_id)) {
              return prev.map((m) =>
                m.client_id === payload.client_id ? { ...payload, pending: false } : m
              );
            }
            if (prev.some((m) => m.id === payload.id)) return prev;
            return [...prev, payload];
          });
          if (!mine && markRead) {
            markRead(convId, payload.id);
          }
          setTypingUsers((prev) => {
            const copy = { ...prev };
            delete copy[payload.sender?.id];
            return copy;
          });
        }
      }

      if (event === "typing" && payload) {
        const convId = Number(payload.conversation_id);
        if (Number(activeIdRef.current) !== convId) return;
        const uid = payload.user?.id;
        if (!uid || Number(uid) === Number(me?.id)) return;
        setTypingUsers((prev) => {
          const copy = { ...prev };
          if (payload.is_typing) copy[uid] = payload.user;
          else delete copy[uid];
          return copy;
        });
        if (payload.is_typing) {
          window.setTimeout(() => {
            setTypingUsers((prev) => {
              const copy = { ...prev };
              delete copy[uid];
              return copy;
            });
          }, 4000);
        }
      }

      if (event === "presence" && payload?.user_id) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.conversation_type === "dm" && c.peer?.id === payload.user_id) {
              return {
                ...c,
                peer: {
                  ...c.peer,
                  is_online: payload.is_online,
                  last_seen: payload.last_seen || c.peer.last_seen,
                },
                online_count: payload.is_online ? 1 : 0,
              };
            }
            return c;
          })
        );
      }
    });
  }, [subscribe, me?.id, markRead]);

  const openConversation = (conv) => {
    setActiveId(conv.id);
    setMobileShowThread(true);
    setShowNewChat(false);
    setTypingUsers({});
  };

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const hay = `${c.name || ""} ${c.peer?.username || ""} ${c.last_message?.body || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, query]);

  const typingLabel = useMemo(() => {
    const people = Object.values(typingUsers);
    if (!people.length) return "";
    if (people.length === 1) return `${displayName(people[0])} is typing…`;
    if (people.length === 2) {
      return `${displayName(people[0])} and ${displayName(people[1])} are typing…`;
    }
    return "Several people are typing…";
  }, [typingUsers]);

  const headerSubtitle = useMemo(() => {
    if (!activeConversation) return "";
    if (activeConversation.conversation_type === "dm" && activeConversation.peer) {
      const online = isOnline?.(activeConversation.peer.id) || activeConversation.peer.is_online;
      const seen =
        lastSeenMap?.[activeConversation.peer.id] || activeConversation.peer.last_seen;
      return formatLastSeen(seen, online);
    }
    if (activeConversation.conversation_type === "responder") {
      const n = activeConversation.online_count || 0;
      return n > 0 ? `${n} responder${n === 1 ? "" : "s"} online` : "Responder team chat";
    }
    if (activeConversation.conversation_type === "group") {
      const n = activeConversation.online_count || 0;
      const members = activeConversation.member_count || 0;
      return n > 0
        ? `${n} online · ${members} member${members === 1 ? "" : "s"}`
        : `Group chat · ${members} member${members === 1 ? "" : "s"}`;
    }
    const n = activeConversation.online_count || 0;
    return n > 0 ? `${n} online in community` : "Community chat";
  }, [activeConversation, isOnline, lastSeenMap]);

  const onDraftChange = (value) => {
    setDraft(value);
    if (!activeId || !sendTyping) return;
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      sendTyping(activeId, true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      sendTyping(activeId, false);
    }, 1200);
  };

  const submitMessage = async (e) => {
    e?.preventDefault?.();
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    const clientId = clientMessageId();
    const optimistic = {
      id: `tmp_${clientId}`,
      conversation_id: activeId,
      body,
      client_id: clientId,
      created_at: new Date().toISOString(),
      sender: {
        id: me?.id,
        first_name: me?.first_name,
        last_name: me?.last_name,
        username: me?.username,
        profile_picture: me?.profile_picture || me?.profile_pic,
      },
      is_mine: true,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);
    if (typingActiveRef.current && sendTyping) {
      typingActiveRef.current = false;
      sendTyping(activeId, false);
    }

    const viaSocket = sendMessage?.(activeId, body, clientId);
    if (!viaSocket) {
      try {
        const saved = await client.run(
          "post",
          endpoints.chatMessages(activeId),
          { body, client_id: clientId },
          true
        );
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...saved, pending: false } : m))
        );
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(activeId)
              ? { ...c, last_message: saved, updated_at: saved.created_at }
              : c
          )
        );
      } catch {
        setMessages((prev) => prev.filter((m) => m.client_id !== clientId));
        setDraft(body);
      }
    }
    setSending(false);
  };

  const loadDirectory = async (q = "") => {
    try {
      const path = q
        ? `${endpoints.chatDirectory}?q=${encodeURIComponent(q)}`
        : endpoints.chatDirectory;
      const res = await client.run("get", path, {}, true);
      setDirectory(res?.users || []);
    } catch {
      setDirectory([]);
    }
  };

  const startDm = async (userId) => {
    try {
      await openDmWithUser(userId);
    } catch {
      setListError("Could not start that conversation.");
    }
  };

  const messageGroups = useMemo(() => {
    const groups = [];
    let currentDay = null;
    let bucket = null;
    messages.forEach((msg) => {
      const day = formatDayLabel(msg.created_at);
      if (day !== currentDay) {
        currentDay = day;
        bucket = { day, items: [] };
        groups.push(bucket);
      }
      bucket.items.push(msg);
    });
    return groups;
  }, [messages]);

  return (
    <div className="h-full min-h-[calc(100dvh-8.5rem)] md:min-h-[calc(100dvh-5.5rem)] flex border border-border bg-surface overflow-hidden">
      {/* Conversation list */}
      <aside
        className={`${
          mobileShowThread ? "hidden md:flex" : "flex"
        } w-full md:w-[320px] lg:w-[360px] shrink-0 flex-col border-r border-border bg-surface`}
      >
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-base font-semibold">Chats</h1>
              <p className="text-xs text-muted">
                {connected ? "Live" : "Connecting…"} · community & responders
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowNewChat((v) => !v);
                if (!showNewChat) loadDirectory();
              }}
              className="min-h-9 px-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark"
            >
              New
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 border border-border bg-background px-3 min-h-10">
            <IoSearchOutline className="text-muted shrink-0" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              aria-label="Search chats"
            />
          </label>
        </div>

        {showNewChat ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2 border-b border-border">
            <p className="text-xs font-medium text-muted px-1">Start a direct chat</p>
            <input
              value={dirQuery}
              onChange={(e) => {
                setDirQuery(e.target.value);
                loadDirectory(e.target.value);
              }}
              placeholder="Search people you follow or responder peers"
              className="w-full min-h-10 border border-border bg-background px-3 text-sm outline-none"
            />
            {directory.length === 0 ? (
              <p className="text-sm text-muted px-1 py-4">
                Follow people or join a responder org to message them directly.
              </p>
            ) : (
              directory.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => startDm(person.id)}
                  className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-background"
                >
                  <span className="relative shrink-0">
                    <img
                      src={avatarUrl(person)}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover bg-background"
                    />
                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface ${
                        person.is_online || isOnline?.(person.id)
                          ? "bg-success"
                          : "bg-muted"
                      }`}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {displayName(person)}
                    </span>
                    <span className="block text-xs text-muted truncate">
                      @{person.username}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-4 space-y-3" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-11 w-11 rounded-full bg-background" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-1/2 bg-background" />
                    <div className="h-3 w-3/4 bg-background" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {listError ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium">{listError}</p>
              <button
                type="button"
                onClick={loadConversations}
                className="mt-3 min-h-10 px-4 text-sm bg-primary text-primary-foreground"
              >
                Retry
              </button>
            </div>
          ) : null}

          {!loadingList && !listError && filteredConversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-medium">No chats yet</p>
              <p className="mt-1 text-sm text-muted">
                Open community chat or message someone you follow.
              </p>
            </div>
          ) : null}

          <ul>
            {filteredConversations.map((conv) => {
              const Icon = roomIcon(conv.conversation_type);
              const active = Number(conv.id) === Number(activeId);
              const peerOnline =
                conv.conversation_type === "dm" &&
                (conv.peer?.is_online || isOnline?.(conv.peer?.id));
              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border ${
                      active ? "bg-background" : "hover:bg-background/70"
                    }`}
                  >
                    <span className="relative shrink-0">
                      {conv.conversation_type === "dm" && conv.peer ? (
                        <img
                          src={avatarUrl(conv.peer)}
                          alt=""
                          className="h-11 w-11 rounded-full object-cover bg-background"
                        />
                      ) : (
                        <span className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          <Icon size={20} />
                        </span>
                      )}
                      {(peerOnline ||
                        (conv.conversation_type !== "dm" && (conv.online_count || 0) > 0)) && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-surface" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{conv.name}</span>
                        <span className="text-[10px] text-muted shrink-0">
                          {formatClock(conv.last_message?.created_at || conv.updated_at)}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-muted truncate">
                          {conv.last_message?.body ||
                            (conv.conversation_type === "responder"
                              ? "Responder coordination"
                              : conv.conversation_type === "group"
                                ? "Group chat — say hello"
                                : "Say hello")}
                        </span>
                        {conv.unread_count > 0 ? (
                          <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                            {conv.unread_count > 99 ? "99+" : conv.unread_count}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Thread */}
      <section
        className={`${
          mobileShowThread ? "flex" : "hidden md:flex"
        } flex-1 min-w-0 flex-col bg-background`}
      >
        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <IoChatbubblesOutline size={40} className="text-muted mb-3" />
            <p className="font-medium">Select a chat</p>
            <p className="mt-1 text-sm text-muted max-w-sm">
              Community chat is open to everyone. Responder rooms appear when your org is approved.
            </p>
          </div>
        ) : (
          <>
            <header className="shrink-0 flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-border bg-surface">
              <button
                type="button"
                className="md:hidden min-h-10 min-w-10 flex items-center justify-center text-foreground"
                onClick={() => setMobileShowThread(false)}
                aria-label="Back to chats"
              >
                <IoArrowBack size={20} />
              </button>
              <span className="relative shrink-0">
                {activeConversation.conversation_type === "dm" && activeConversation.peer ? (
                  <img
                    src={avatarUrl(activeConversation.peer)}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover bg-background"
                  />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    {(() => {
                      const Icon = roomIcon(activeConversation.conversation_type);
                      return <Icon size={18} />;
                    })()}
                  </span>
                )}
                {(activeConversation.conversation_type === "dm"
                  ? isOnline?.(activeConversation.peer?.id) || activeConversation.peer?.is_online
                  : (activeConversation.online_count || 0) > 0) && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-surface" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{activeConversation.name}</p>
                <p className="text-xs text-muted truncate">{headerSubtitle}</p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4">
              {loadingMessages ? (
                <div className="space-y-3" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`max-w-[70%] h-12 bg-surface border border-border ${
                        i % 2 ? "ml-auto" : ""
                      }`}
                    />
                  ))}
                </div>
              ) : null}

              {!loadingMessages && messages.length === 0 ? (
                <div className="text-center py-16">
                  <p className="font-medium">No messages yet</p>
                  <p className="mt-1 text-sm text-muted">Be the first to say something.</p>
                </div>
              ) : null}

              {messageGroups.map((group) => (
                <div key={group.day} className="space-y-2">
                  <div className="flex justify-center">
                    <span className="text-[11px] px-2 py-1 bg-surface border border-border text-muted">
                      {group.day}
                    </span>
                  </div>
                  {group.items.map((msg) => {
                    const mine =
                      msg.is_mine || Number(msg.sender?.id) === Number(me?.id);
                    return (
                      <div
                        key={msg.id || msg.client_id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] px-3 py-2 border ${
                            mine
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-surface text-foreground border-border"
                          }`}
                        >
                          {!mine && activeConversation.conversation_type !== "dm" ? (
                            <p
                              className={`text-[11px] font-medium mb-0.5 ${
                                mine ? "text-primary-foreground/80" : "text-primary"
                              }`}
                            >
                              {displayName(msg.sender)}
                            </p>
                          ) : null}
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          <p
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              mine ? "text-primary-foreground/80" : "text-muted"
                            }`}
                          >
                            <span>{formatClock(msg.created_at)}</span>
                            {mine ? (
                              <IoCheckmarkDone
                                size={12}
                                className={msg.pending ? "opacity-50" : ""}
                              />
                            ) : null}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {typingLabel ? (
                <p className="text-xs text-muted italic px-1">{typingLabel}</p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={submitMessage}
              className="shrink-0 border-t border-border bg-surface p-3 flex items-end gap-2"
            >
              <label className="sr-only" htmlFor="chat-draft">
                Message
              </label>
              <textarea
                id="chat-draft"
                rows={1}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitMessage();
                  }
                }}
                placeholder="Type a message"
                className="flex-1 min-h-11 max-h-32 resize-none border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="min-h-11 min-w-11 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
                aria-label="Send message"
              >
                <IoSend size={18} />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
};

export default CommunityChat;

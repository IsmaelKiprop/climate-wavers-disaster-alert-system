import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LazyEmojiPicker from "./LazyEmojiPicker";
import {
  IoArrowBack,
  IoAttachOutline,
  IoChatbubblesOutline,
  IoCheckmarkDone,
  IoChevronForward,
  IoClose,
  IoGiftOutline,
  IoHappyOutline,
  IoLeafOutline,
  IoPeopleOutline,
  IoSearchOutline,
  IoSend,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { avatarUrl, getUser, secureMediaUrl } from "../utils/factory";
import { useChatSocket } from "../context/ChatContext";
import { unwrapList } from "../utils/apiData";
import { uploadFiles } from "../services/upload.service";
import {
  bindNotificationSoundUnlock,
  playIncomingChatSound,
  playOutgoingChatSound,
  unlockNotificationSound,
} from "../utils/notificationSound";
import ChatGroupInfo from "./ChatGroupInfo";
import ChatTreeGiftSheet from "./ChatTreeGiftSheet";
import LinkifiedText from "./LinkifiedText";
import ImageLightbox from "./ImageLightbox";
import { profilePath } from "../utils/linkify";
import { giftTreesPath } from "../utils/profileCompleteness";

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

function roomAvatarSrc(conv) {
  if (!conv) return "";
  if (conv.conversation_type === "dm" && conv.peer) return avatarUrl(conv.peer);
  return secureMediaUrl(conv.avatar || conv.cover_image || "", "");
}

function clientMessageId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function mediaKindFromFile(file) {
  if (!file?.type) return "file";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

function previewLabel(msg) {
  if (!msg) return "Say hello";
  if (msg.body) return msg.body;
  if (msg.media_type === "image") return "Photo";
  if (msg.media_type === "video") return "Video";
  if (msg.media_type === "audio") return "Audio";
  if (msg.media_url) return "Attachment";
  return "Say hello";
}

function mergeMentions(mentions = [], roomMembers = []) {
  const byHandle = new Map();
  [...(mentions || []), ...(roomMembers || [])].forEach((person) => {
    const handle = String(person?.username || "").toLowerCase();
    if (!handle || byHandle.has(handle)) return;
    byHandle.set(handle, {
      id: person.id,
      username: person.username || "",
      first_name: person.first_name || "",
      last_name: person.last_name || "",
    });
  });
  return Array.from(byHandle.values());
}

function renderMessageBody(body, mentions = [], mine = false) {
  const text = body || "";
  if (!text) return null;
  return (
    <LinkifiedText
      text={text}
      mentions={mentions}
      linkClassName={
        mine
          ? "underline underline-offset-2 break-all text-primary-foreground"
          : "underline underline-offset-2 break-all text-primary"
      }
      hashtagClassName={
        mine
          ? "font-semibold underline underline-offset-2"
          : "font-semibold text-primary"
      }
      mentionClassName="font-semibold underline underline-offset-2"
    />
  );
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
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [roomMembers, setRoomMembers] = useState([]);
  const [pendingMentions, setPendingMentions] = useState([]);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [groupInfoLoading, setGroupInfoLoading] = useState(false);
  const [groupInfoData, setGroupInfoData] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [giftNudgeOpen, setGiftNudgeOpen] = useState(false);

  const bottomRef = useRef(null);
  const draftRef = useRef(null);
  const attachRef = useRef(null);
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

  useEffect(() => bindNotificationSoundUnlock(), []);

  useEffect(() => {
    setShowEmoji(false);
    setMentionOpen(false);
    setPendingMentions([]);
    setPendingMedia((prev) => {
      if (prev?.preview?.startsWith("blob:")) URL.revokeObjectURL(prev.preview);
      return null;
    });
    setGroupInfoOpen(false);
    setGroupInfoData(null);
    setGiftSheetOpen(false);
    setDraft("");
  }, [activeId]);

  useEffect(() => {
    if (!activeConversation) {
      setGiftNudgeOpen(false);
      return undefined;
    }
    const key = `cw_gift_nudge_${activeConversation.id}`;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(key) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) {
      setGiftNudgeOpen(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setGiftNudgeOpen(true), 4500);
    return () => window.clearTimeout(timer);
  }, [activeConversation?.id]);

  const loadRoomMembers = useCallback(async (conversationId) => {
    if (!conversationId) {
      setRoomMembers([]);
      return null;
    }
    try {
      const res = await client.run(
        "get",
        endpoints.chatMembers(conversationId),
        {},
        true,
        false,
        false,
        false
      );
      setRoomMembers(res?.members || []);
      return res;
    } catch {
      setRoomMembers([]);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadRoomMembers(activeId);
  }, [activeId, loadRoomMembers]);

  const openGroupInfo = async () => {
    if (
      !activeConversation ||
      !["group", "community"].includes(activeConversation.conversation_type)
    ) {
      return;
    }
    // Open instantly (WhatsApp-style), then fill members.
    setGroupInfoOpen(true);
    setGroupInfoLoading(true);
    setGroupInfoData({
      conversation_type: activeConversation.conversation_type,
      group: {
        name: activeConversation.name,
        description: activeConversation.description || "",
        cover_image: activeConversation.avatar || "",
        member_count: activeConversation.member_count || roomMembers.length || 0,
      },
      members: roomMembers,
    });
    const res = await loadRoomMembers(activeConversation.id);
    if (res) {
      setGroupInfoData({
        ...res,
        conversation_type: res.conversation_type || activeConversation.conversation_type,
        group: {
          ...(res.group || {}),
          name: res.group?.name || activeConversation.name,
          cover_image:
            res.group?.cover_image || activeConversation.avatar || "",
          description:
            res.group?.description || activeConversation.description || "",
          member_count:
            res.group?.member_count ||
            (res.members || []).length ||
            activeConversation.member_count ||
            0,
        },
      });
    }
    setGroupInfoLoading(false);
  };

  useEffect(() => {
    if (!subscribe) return undefined;
    return subscribe((event, payload) => {
      if (event === "message" && payload) {
        const convId = Number(payload.conversation_id);
        const mine =
          payload.is_mine ||
          Number(payload.sender?.id) === Number(me?.id);

        let shouldSound = true;
        setConversations((prev) => {
          const next = prev.map((c) => {
            if (Number(c.id) !== convId) return c;
            if (c.last_message?.id && c.last_message.id === payload.id) {
              shouldSound = false;
              return c;
            }
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
              const wasPending = prev.some(
                (m) => m.client_id === payload.client_id && m.pending
              );
              // Optimistic send already shown — still play outgoing once on ack.
              if (wasPending && shouldSound) playOutgoingChatSound();
              else shouldSound = false;
              return prev.map((m) =>
                m.client_id === payload.client_id ? { ...payload, pending: false } : m
              );
            }
            if (prev.some((m) => m.id === payload.id)) {
              shouldSound = false;
              return prev;
            }
            if (shouldSound) {
              if (mine) playOutgoingChatSound();
              else playIncomingChatSound();
            }
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
        } else if (shouldSound && !mine) {
          playIncomingChatSound();
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
    if (
      activeConversation.conversation_type === "group" ||
      activeConversation.conversation_type === "community"
    ) {
      const desc = (activeConversation.description || "").trim();
      if (desc) return desc;
      const n = activeConversation.online_count || 0;
      const members = activeConversation.member_count || 0;
      if (activeConversation.conversation_type === "community") {
        return n > 0 ? `${n} online in community` : "Community chat";
      }
      return n > 0
        ? `${n} online · ${members} member${members === 1 ? "" : "s"}`
        : `Group chat · ${members} member${members === 1 ? "" : "s"}`;
    }
    const n = activeConversation.online_count || 0;
    return n > 0 ? `${n} online in community` : "Community chat";
  }, [activeConversation, isOnline, lastSeenMap]);

  const mentionCandidates = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    return (roomMembers || [])
      .filter((person) => Number(person.id) !== Number(me?.id))
      .filter((person) => {
        if (!q) return true;
        const hay = `${person.username || ""} ${person.first_name || ""} ${person.last_name || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [mentionOpen, mentionQuery, roomMembers, me?.id]);

  const giftSuggestions = useMemo(() => {
    const seen = new Set();
    const out = [];
    const push = (person) => {
      if (!person?.id || Number(person.id) === Number(me?.id)) return;
      const key = String(person.id);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(person);
    };
    if (activeConversation?.conversation_type === "dm" && activeConversation.peer) {
      push(activeConversation.peer);
    }
    (activeConversation?.online_members || []).forEach(push);
    (roomMembers || []).forEach(push);
    return out.slice(0, 8);
  }, [activeConversation, roomMembers, me?.id]);

  const giftNudgePerson = giftSuggestions[0] || null;

  const dismissGiftNudge = () => {
    if (activeConversation?.id) {
      try {
        sessionStorage.setItem(`cw_gift_nudge_${activeConversation.id}`, "1");
      } catch {
        // ignore
      }
    }
    setGiftNudgeOpen(false);
  };

  const sendGiftInviteMessage = async (_person, body) => {
    if (!body || !activeId) return;
    const clientId = clientMessageId();
    const optimistic = {
      id: `tmp_${clientId}`,
      conversation_id: activeId,
      body,
      media_url: "",
      media_type: "",
      mentions: [],
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
    const viaSocket = sendMessage?.(activeId, body, clientId, {
      media_url: "",
      media_type: "",
      mentions: [],
    });
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
      } catch {
        setMessages((prev) => prev.filter((m) => m.client_id !== clientId));
      }
    }
    dismissGiftNudge();
  };

  const onDraftChange = (value) => {
    setDraft(value);
    const cursor = draftRef.current?.selectionStart ?? value.length;
    const upto = value.slice(0, cursor);
    const match = upto.match(/(?:^|\s)@([a-zA-Z0-9_.]*)$/);
    if (match) {
      setMentionOpen(true);
      setMentionQuery(match[1] || "");
    } else {
      setMentionOpen(false);
      setMentionQuery("");
    }
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

  const insertEmoji = (emojiData) => {
    const emoji = emojiData?.emoji || "";
    if (!emoji) return;
    unlockNotificationSound();
    const el = draftRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    setShowEmoji(false);
    requestAnimationFrame(() => {
      if (!draftRef.current) return;
      const pos = start + emoji.length;
      draftRef.current.focus();
      draftRef.current.setSelectionRange(pos, pos);
    });
  };

  const insertMention = (person) => {
    if (!person) return;
    const el = draftRef.current;
    const cursor = el?.selectionStart ?? draft.length;
    const upto = draft.slice(0, cursor);
    const match = upto.match(/(?:^|\s)@([a-zA-Z0-9_.]*)$/);
    const handle = person.username || displayName(person).replace(/\s+/g, "");
    let next = draft;
    if (match) {
      const prefix = draft.slice(0, match.index + (match[0].startsWith(" ") ? 1 : 0));
      const suffix = draft.slice(cursor);
      next = `${prefix}@${handle} ${suffix}`;
    } else {
      next = `${draft}${draft.endsWith(" ") || !draft ? "" : " "}@${handle} `;
    }
    setDraft(next);
    setPendingMentions((prev) => {
      if (prev.some((m) => Number(m.id) === Number(person.id))) return prev;
      return [
        ...prev,
        {
          id: person.id,
          username: person.username || "",
          first_name: person.first_name || "",
          last_name: person.last_name || "",
        },
      ];
    });
    setMentionOpen(false);
    setMentionQuery("");
    requestAnimationFrame(() => draftRef.current?.focus());
  };

  const onPickMedia = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      return;
    }
    unlockNotificationSound();
    if (pendingMedia?.preview?.startsWith("blob:")) {
      URL.revokeObjectURL(pendingMedia.preview);
    }
    setPendingMedia({
      file,
      kind: mediaKindFromFile(file),
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      name: file.name,
    });
  };

  const clearPendingMedia = () => {
    if (pendingMedia?.preview?.startsWith("blob:")) {
      URL.revokeObjectURL(pendingMedia.preview);
    }
    setPendingMedia(null);
  };

  const submitMessage = async (e) => {
    e?.preventDefault?.();
    unlockNotificationSound();
    const body = draft.trim();
    if ((!body && !pendingMedia) || !activeId || sending) return;
    const clientId = clientMessageId();
    let media_url = "";
    let media_type = "";
    setSending(true);
    try {
      if (pendingMedia?.file) {
        const uploaded = await uploadFiles(pendingMedia.file);
        media_url = Array.isArray(uploaded) ? uploaded[0] : uploaded;
        media_type = pendingMedia.kind || mediaKindFromFile(pendingMedia.file);
        if (!media_url) {
          setSending(false);
          return;
        }
      }
    } catch {
      setSending(false);
      return;
    }

    const mentions = pendingMentions.filter((m) =>
      body.toLowerCase().includes(`@${(m.username || "").toLowerCase()}`)
    );
    const optimistic = {
      id: `tmp_${clientId}`,
      conversation_id: activeId,
      body,
      media_url,
      media_type,
      mentions,
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
    setPendingMentions([]);
    clearPendingMedia();
    setShowEmoji(false);
    setMentionOpen(false);
    if (typingActiveRef.current && sendTyping) {
      typingActiveRef.current = false;
      sendTyping(activeId, false);
    }

    const extra = { media_url, media_type, mentions };
    const viaSocket = sendMessage?.(activeId, body, clientId, extra);
    if (!viaSocket) {
      try {
        const saved = await client.run(
          "post",
          endpoints.chatMessages(activeId),
          { body, client_id: clientId, ...extra },
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
              const avatarSrc = roomAvatarSrc(conv);
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
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt=""
                          className="h-11 w-11 rounded-full object-cover bg-background"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <span
                        className={`h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center ${
                          avatarSrc ? "hidden" : ""
                        }`}
                      >
                        <Icon size={20} />
                      </span>
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
                          {previewLabel(conv.last_message) ||
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
              <button
                type="button"
                className="relative shrink-0"
                onClick={() => {
                  if (
                    ["group", "community"].includes(
                      activeConversation.conversation_type
                    )
                  ) {
                    openGroupInfo();
                  }
                }}
                aria-label={
                  ["group", "community"].includes(
                    activeConversation.conversation_type
                  )
                    ? "Open chat info"
                    : undefined
                }
              >
                {roomAvatarSrc(activeConversation) ? (
                  <img
                    src={roomAvatarSrc(activeConversation)}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover bg-background"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling;
                      if (fallback) fallback.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <span
                  className={`h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center ${
                    roomAvatarSrc(activeConversation) ? "hidden" : ""
                  }`}
                >
                  {(() => {
                    const Icon = roomIcon(activeConversation.conversation_type);
                    return <Icon size={18} />;
                  })()}
                </span>
                {(activeConversation.conversation_type === "dm"
                  ? isOnline?.(activeConversation.peer?.id) || activeConversation.peer?.is_online
                  : (activeConversation.online_count || 0) > 0) && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-surface" />
                )}
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 text-left hover:opacity-90"
                onClick={() => {
                  if (
                    ["group", "community"].includes(
                      activeConversation.conversation_type
                    )
                  ) {
                    openGroupInfo();
                  }
                }}
              >
                <p className="text-sm font-semibold truncate flex items-center gap-1">
                  <span className="truncate">{activeConversation.name}</span>
                  {["group", "community"].includes(
                    activeConversation.conversation_type
                  ) ? (
                    <IoChevronForward size={14} className="shrink-0 text-muted" />
                  ) : null}
                </p>
                <p className="text-xs text-muted truncate">{headerSubtitle}</p>
              </button>
              <button
                type="button"
                onClick={() => setGiftSheetOpen(true)}
                className="min-h-10 min-w-10 flex items-center justify-center text-primary hover:bg-primary/10"
                aria-label="Gift a tree"
                title="Gift a tree"
              >
                <IoGiftOutline size={20} />
              </button>
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
                          className={`max-w-[85%] sm:max-w-[70%] overflow-hidden border ${
                            mine
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-surface text-foreground border-border"
                          } ${msg.media_url && !msg.body ? "p-0" : "px-3 py-2"}`}
                        >
                          {!mine && activeConversation.conversation_type !== "dm" ? (
                            msg.sender?.id ? (
                              <Link
                                to={profilePath(msg.sender.id)}
                                className={`text-[11px] font-medium mb-0.5 block hover:underline px-3 pt-2 ${
                                  mine ? "text-primary-foreground/80" : "text-primary"
                                } ${msg.media_url && !msg.body ? "" : "px-0 pt-0"}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {displayName(msg.sender)}
                              </Link>
                            ) : (
                              <p
                                className={`text-[11px] font-medium mb-0.5 ${
                                  mine ? "text-primary-foreground/80" : "text-primary"
                                }`}
                              >
                                {displayName(msg.sender)}
                              </p>
                            )
                          ) : null}
                          {msg.media_url ? (
                            <div
                              className={`overflow-hidden ${
                                msg.body ? "-mx-3 mb-1.5" : ""
                              }`}
                            >
                              {msg.media_type === "image" ? (
                                <button
                                  type="button"
                                  className="block w-full"
                                  onClick={() =>
                                    setMediaPreview({
                                      src: secureMediaUrl(msg.media_url),
                                      type: "image",
                                      alt: "Chat image",
                                    })
                                  }
                                >
                                  <img
                                    src={secureMediaUrl(msg.media_url)}
                                    alt=""
                                    className="w-full max-h-[min(70vh,420px)] object-contain bg-black/5 cursor-zoom-in"
                                  />
                                </button>
                              ) : msg.media_type === "video" ? (
                                <button
                                  type="button"
                                  className="block w-full"
                                  onClick={() =>
                                    setMediaPreview({
                                      src: secureMediaUrl(msg.media_url),
                                      type: "video",
                                      alt: "Chat video",
                                    })
                                  }
                                >
                                  <video
                                    src={secureMediaUrl(msg.media_url)}
                                    className="w-full max-h-[min(70vh,420px)] bg-background pointer-events-none"
                                    muted
                                    playsInline
                                  />
                                </button>
                              ) : msg.media_type === "audio" ? (
                                <audio
                                  src={secureMediaUrl(msg.media_url)}
                                  controls
                                  className="w-full px-3 py-2"
                                />
                              ) : (
                                <a
                                  href={secureMediaUrl(msg.media_url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm underline px-3 py-2 inline-block"
                                >
                                  Open attachment
                                </a>
                              )}
                            </div>
                          ) : null}
                          {msg.body ? (
                            <p className={`text-sm ${msg.media_url ? "px-3" : ""}`}>
                              {renderMessageBody(
                                msg.body,
                                mergeMentions(msg.mentions, roomMembers),
                                mine
                              )}
                            </p>
                          ) : null}
                          <p
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              msg.media_url && !msg.body ? "px-3 pb-2" : ""
                            } ${mine ? "text-primary-foreground/80" : "text-muted"}`}
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

            {giftNudgeOpen && giftNudgePerson ? (
              <div className="shrink-0 mx-3 mb-2 border border-primary/30 bg-primary/5 px-3 py-3 flex items-start gap-3 animate-[fadeIn_280ms_ease-out]">
                <span className="mt-0.5 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <IoLeafOutline size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    Gift {displayName(giftNudgePerson)} a tree?
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    A living thank-you from this chat — plant impact together.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setGiftSheetOpen(true)}
                      className="min-h-9 px-3 text-xs font-medium bg-primary text-primary-foreground"
                    >
                      See gift ideas
                    </button>
                    <Link
                      to={giftTreesPath(
                        giftNudgePerson.id,
                        displayName(giftNudgePerson)
                      )}
                      onClick={dismissGiftNudge}
                      className="min-h-9 px-3 text-xs font-medium border border-border bg-surface inline-flex items-center"
                    >
                      Gift now
                    </Link>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissGiftNudge}
                  className="min-h-8 min-w-8 flex items-center justify-center text-muted"
                  aria-label="Dismiss gift suggestion"
                >
                  <IoClose size={16} />
                </button>
              </div>
            ) : null}

            <form
              onSubmit={submitMessage}
              className="shrink-0 border-t border-border bg-surface p-3 space-y-2"
            >
              {pendingMedia ? (
                <div className="flex items-center gap-3 border border-border bg-background px-3 py-2">
                  {pendingMedia.preview ? (
                    <img src={pendingMedia.preview} alt="" className="h-12 w-12 object-cover" />
                  ) : (
                    <span className="text-xs text-muted truncate">{pendingMedia.name}</span>
                  )}
                  <button
                    type="button"
                    onClick={clearPendingMedia}
                    className="ml-auto min-h-8 min-w-8 flex items-center justify-center text-muted"
                    aria-label="Remove attachment"
                  >
                    <IoClose size={16} />
                  </button>
                </div>
              ) : null}

              {mentionOpen && mentionCandidates.length ? (
                <ul className="border border-border bg-background max-h-40 overflow-y-auto">
                  {mentionCandidates.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => insertMention(person)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface"
                      >
                        <img
                          src={avatarUrl(person)}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate">
                            {displayName(person)}
                          </span>
                          <span className="block text-xs text-muted truncate">
                            @{person.username}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {showEmoji ? (
                <div className="border border-border bg-background overflow-hidden">
                  <LazyEmojiPicker
                    onEmojiClick={insertEmoji}
                    width="100%"
                    height={320}
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              ) : null}

              <div className="flex items-end gap-1.5">
                <input
                  ref={attachRef}
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={onPickMedia}
                />
                <button
                  type="button"
                  onClick={() => {
                    unlockNotificationSound();
                    attachRef.current?.click();
                  }}
                  className="min-h-11 min-w-10 flex items-center justify-center text-muted hover:text-foreground"
                  aria-label="Attach media"
                >
                  <IoAttachOutline size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    unlockNotificationSound();
                    setShowEmoji((v) => !v);
                  }}
                  className="min-h-11 min-w-10 flex items-center justify-center text-muted hover:text-foreground"
                  aria-label="Emoji"
                >
                  <IoHappyOutline size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    unlockNotificationSound();
                    setGiftSheetOpen(true);
                  }}
                  className="min-h-11 min-w-10 flex items-center justify-center text-primary hover:text-primary-dark"
                  aria-label="Gift a tree"
                  title="Gift a tree"
                >
                  <IoGiftOutline size={22} />
                </button>
                <label className="sr-only" htmlFor="chat-draft">
                  Message
                </label>
                <textarea
                  id="chat-draft"
                  ref={draftRef}
                  rows={1}
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitMessage();
                    }
                    if (e.key === "Escape") {
                      setShowEmoji(false);
                      setMentionOpen(false);
                    }
                  }}
                  placeholder="Type a message · @ to mention"
                  className="flex-1 min-h-11 max-h-32 resize-none border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={(!draft.trim() && !pendingMedia) || sending}
                  className="min-h-11 min-w-11 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
                  aria-label="Send message"
                >
                  <IoSend size={18} />
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      <ChatGroupInfo
        open={groupInfoOpen}
        onClose={() => setGroupInfoOpen(false)}
        loading={groupInfoLoading}
        data={groupInfoData}
        conversationName={activeConversation?.name}
      />

      {mediaPreview?.src ? (
        <ImageLightbox
          src={mediaPreview.src}
          type={mediaPreview.type || "image"}
          alt={mediaPreview.alt || ""}
          onClose={() => setMediaPreview(null)}
        />
      ) : null}

      <ChatTreeGiftSheet
        open={giftSheetOpen}
        onClose={() => setGiftSheetOpen(false)}
        suggestions={giftSuggestions}
        conversationType={activeConversation?.conversation_type}
        onSendInvite={sendGiftInviteMessage}
      />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CommunityChat;

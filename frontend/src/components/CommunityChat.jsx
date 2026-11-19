import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LazyEmojiPicker from "./LazyEmojiPicker";
import {
  IoArrowBack,
  IoArrowUndoOutline,
  IoAttachOutline,
  IoChatbubblesOutline,
  IoCheckmark,
  IoCheckmarkDone,
  IoChevronForward,
  IoClose,
  IoCallOutline,
  IoDownloadOutline,
  IoGiftOutline,
  IoHappyOutline,
  IoLeafOutline,
  IoMicOutline,
  IoPeopleOutline,
  IoSearchOutline,
  IoSend,
  IoShieldCheckmarkOutline,
  IoStop,
  IoTrashOutline,
  IoEllipsisHorizontal,
} from "react-icons/io5";
import { toast } from "react-toastify";
import JitsiMeetEmbed from "./JitsiMeetEmbed";
import { env } from "../config/env";
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
  playCallRingSound,
  stopCallRingSound,
  unlockNotificationSound,
} from "../utils/notificationSound";
import ChatGroupInfo from "./ChatGroupInfo";
import ChatTreeGiftSheet from "./ChatTreeGiftSheet";
import ChatLinkPreview from "./ChatLinkPreview";
import LinkifiedText from "./LinkifiedText";
import ImageLightbox from "./ImageLightbox";
import { profilePath } from "../utils/linkify";
import { downloadMedia } from "../utils/downloadMedia";
import {
  CHAT_SHARE_DRAFT_KEY,
  giftTreesPath,
} from "../utils/profileCompleteness";

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

function TypingDots({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-bounce"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

function MessageReceipt({ pending, read }) {
  if (pending) {
    return <IoCheckmark size={13} className="opacity-50" aria-label="Sending" title="Sending" />;
  }
  if (read) {
    return (
      <IoCheckmarkDone
        size={13}
        className="text-sky-200"
        aria-label="Read"
        title="Read"
      />
    );
  }
  return (
    <IoCheckmarkDone
      size={13}
      className="opacity-70"
      aria-label="Sent"
      title="Sent"
    />
  );
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

function preferredAudioMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function audioExtensionForMime(mime = "") {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

function formatRecordingClock(totalSeconds) {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function replySnippet(msg) {
  if (!msg) return "";
  if (msg.is_deleted) return "Original message deleted";
  if (msg.body) return msg.body;
  if (msg.media_type === "image") return "Photo";
  if (msg.media_type === "video") return "Video";
  if (msg.media_type === "audio") return "Audio";
  if (msg.media_url) return "Attachment";
  return "Message";
}

function sameSender(a, b) {
  if (!a || !b) return false;
  return Number(a.sender?.id) === Number(b.sender?.id);
}

function bubbleRadius(mine, clusteredPrev, clusteredNext) {
  // Soft chat corners; keep the "tail" corner tighter like WhatsApp.
  if (mine) {
    return {
      borderTopLeftRadius: 12,
      borderTopRightRadius: clusteredPrev ? 6 : 12,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: clusteredNext ? 6 : 4,
    };
  }
  return {
    borderTopLeftRadius: clusteredPrev ? 6 : 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: clusteredNext ? 6 : 4,
    borderBottomRightRadius: 12,
  };
}

const CHAT_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

function previewLabel(msg) {
  if (!msg) return "Say hello";
  if (msg.body) return msg.body;
  if (msg.media_type === "image") return "Photo";
  if (msg.media_type === "video") return "Video";
  if (msg.media_type === "audio") return "Audio";
  if (msg.media_url) return "Attachment";
  return "Say hello";
}

/** Extract Climate Call event id from system chat text. */
function climateCallEventId(body = "") {
  const text = String(body || "");
  const tagged = text.match(/(?:^|\s)event:(\d+)\b/i);
  if (tagged?.[1]) return tagged[1];
  const path = text.match(/\/app\/calendar\/events\/(\d+)\/join/i);
  if (path?.[1]) return path[1];
  if (/climate call/i.test(text) && /join/i.test(text)) {
    const anyId = text.match(/events\/(\d+)/i);
    if (anyId?.[1]) return anyId[1];
  }
  return null;
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
    reactToMessage,
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
  const [readUpToByUser, setReadUpToByUser] = useState({});
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
  const [climateCall, setClimateCall] = useState(null);
  const [startingCall, setStartingCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);

  const bottomRef = useRef(null);
  const draftRef = useRef(null);
  const attachRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingActiveRef = useRef(false);
  const activeIdRef = useRef(null);
  const messagesRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingMimeRef = useRef("");
  const discardRecordingRef = useRef(false);
  const replyingToRef = useRef(null);
  const sendVoiceNoteRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    replyingToRef.current = replyingTo;
  }, [replyingTo]);

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

  const joinClimateCall = useCallback(
    async (eventId, { ring = false } = {}) => {
      if (!eventId || startingCall) return;
      unlockNotificationSound();
      setStartingCall(true);
      if (ring) playCallRingSound({ loops: 2 });
      try {
        const join = await client.run(
          "post",
          `${endpoints.climateEvents}${eventId}/join/`,
          {},
          true
        );
        stopCallRingSound();
        setIncomingCall(null);
        setClimateCall({
          roomName: join.roomName,
          displayName: join.displayName,
          subject: join.title || "Climate Call",
          domain: join.domain || env.jitsiDomain,
          eventId: join.event_id || eventId,
        });
      } catch (err) {
        stopCallRingSound();
        toast.error(err?.response?.data?.detail || "Could not join Climate Call");
      } finally {
        setStartingCall(false);
      }
    },
    [startingCall]
  );

  const startOrRejoinClimateCall = useCallback(async () => {
    if (!activeConversation?.id || startingCall) return;
    unlockNotificationSound();
    setStartingCall(true);
    playCallRingSound({ loops: 3 });
    try {
      const event = await client.run(
        "post",
        endpoints.climateEventFromChat,
        { conversation_id: activeConversation.id },
        true
      );
      const join = await client.run(
        "post",
        `${endpoints.climateEvents}${event.id}/join/`,
        {},
        true
      );
      stopCallRingSound();
      setIncomingCall(null);
      setClimateCall({
        roomName: join.roomName,
        displayName: join.displayName,
        subject: event.title || join.title || "Climate Call",
        domain: join.domain || env.jitsiDomain,
        eventId: event.id,
      });
      loadMessages(activeConversation.id);
    } catch (err) {
      stopCallRingSound();
      toast.error(err?.response?.data?.detail || "Could not start Climate Call");
    } finally {
      setStartingCall(false);
    }
  }, [activeConversation?.id, loadMessages, startingCall]);

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
    setTypingUsers({});
    const seed = {};
    const peer = activeConversation?.peer;
    if (peer?.id && peer.last_read_message_id) {
      seed[Number(peer.id)] = Number(peer.last_read_message_id);
    }
    setReadUpToByUser(seed);
    // Reset when switching threads; peer last_read is re-applied from members next.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, activeId]);

  useEffect(() => {
    const unbind = bindNotificationSoundUnlock();
    return () => {
      unbind?.();
      stopCallRingSound();
    };
  }, []);

  useEffect(() => {
    if (!messageMenuId) return undefined;
    const onPointer = (event) => {
      const target = event.target;
      if (target?.closest?.("[data-chat-msg-menu]")) return;
      setMessageMenuId(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setMessageMenuId(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [messageMenuId]);

  useEffect(() => {
    setShowEmoji(false);
    setMentionOpen(false);
    setPendingMentions([]);
    setReplyingTo(null);
    setMessageMenuId(null);
    setPendingMedia((prev) => {
      if (prev?.preview?.startsWith("blob:")) URL.revokeObjectURL(prev.preview);
      return null;
    });
    setGroupInfoOpen(false);
    setGroupInfoData(null);
    setGiftSheetOpen(false);
    let nextDraft = "";
    try {
      const pending = sessionStorage.getItem(CHAT_SHARE_DRAFT_KEY);
      if (pending) {
        nextDraft = pending;
        sessionStorage.removeItem(CHAT_SHARE_DRAFT_KEY);
      }
    } catch {
      nextDraft = "";
    }
    setDraft(nextDraft);
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
      const members = res?.members || [];
      setRoomMembers(members);
      setReadUpToByUser((prev) => {
        const next = { ...prev };
        members.forEach((person) => {
          const uid = Number(person?.id);
          const mid = Number(person?.last_read_message_id || 0);
          if (!uid || uid === Number(me?.id) || !mid) return;
          if (mid > Number(next[uid] || 0)) next[uid] = mid;
        });
        return next;
      });
      return res;
    } catch {
      setRoomMembers([]);
      return null;
    }
  }, [me?.id]);

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
          const prevMessages = messagesRef.current || [];
          const isAck =
            Boolean(payload.client_id) &&
            prevMessages.some((m) => m.client_id === payload.client_id);
          const isDup = prevMessages.some((m) => m.id === payload.id);
          setMessages((prev) => {
            if (payload.client_id && prev.some((m) => m.client_id === payload.client_id)) {
              return prev.map((m) =>
                m.client_id === payload.client_id ? { ...payload, pending: false } : m
              );
            }
            if (prev.some((m) => m.id === payload.id)) return prev;
            return [...prev, payload];
          });
          // Outgoing already played on send; only alert for new inbound messages.
          if (shouldSound && !isAck && !isDup && !mine) {
            const callEventId = climateCallEventId(payload.body);
            if (callEventId) {
              playCallRingSound({ loops: 10 });
              setIncomingCall({
                eventId: callEventId,
                title: payload.body?.split("\n")?.[0] || "Incoming Climate Call",
                conversationId: convId,
              });
            } else {
              playIncomingChatSound();
            }
          }
          if (!mine && markRead) {
            markRead(convId, payload.id);
          }
          setTypingUsers((prev) => {
            const copy = { ...prev };
            delete copy[payload.sender?.id];
            return copy;
          });
        } else if (shouldSound && !mine) {
          const callEventId = climateCallEventId(payload.body);
          if (callEventId) {
            playCallRingSound({ loops: 10 });
            setIncomingCall({
              eventId: callEventId,
              title: payload.body?.split("\n")?.[0] || "Incoming Climate Call",
              conversationId: convId,
            });
          } else {
            playIncomingChatSound();
          }
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

      if (event === "read" && payload) {
        const convId = Number(payload.conversation_id);
        if (Number(activeIdRef.current) !== convId) return;
        const uid = Number(payload.user_id);
        const mid = Number(payload.message_id || 0);
        if (!uid || uid === Number(me?.id) || !mid) return;
        setReadUpToByUser((prev) => {
          if (mid <= Number(prev[uid] || 0)) return prev;
          return { ...prev, [uid]: mid };
        });
        setConversations((prev) =>
          prev.map((c) => {
            if (Number(c.id) !== convId) return c;
            if (c.conversation_type !== "dm" || Number(c.peer?.id) !== uid) return c;
            return {
              ...c,
              peer: {
                ...c.peer,
                last_read_message_id: mid,
              },
            };
          })
        );
      }

      if (event === "message_reaction" && payload) {
        const convId = Number(payload.conversation_id);
        const mid = Number(payload.message_id);
        if (!mid) return;
        if (Number(activeIdRef.current) !== convId) return;
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.id) === mid
              ? { ...m, reactions: payload.reactions || [] }
              : m
          )
        );
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

  const peerReadUpTo = useMemo(() => {
    if (!me?.id) return 0;
    const others = Object.entries(readUpToByUser)
      .filter(([uid]) => Number(uid) !== Number(me.id))
      .map(([, mid]) => Number(mid) || 0);
    if (activeConversation?.conversation_type === "dm") {
      const peerId = Number(activeConversation.peer?.id);
      return Number(
        readUpToByUser[peerId] ||
          activeConversation.peer?.last_read_message_id ||
          0
      );
    }
    return others.length ? Math.max(...others) : 0;
  }, [activeConversation, me?.id, readUpToByUser]);

  const headerSubtitle = useMemo(() => {
    if (!activeConversation) return "";
    if (typingLabel) return typingLabel;
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
  }, [activeConversation, isOnline, lastSeenMap, typingLabel]);

  const mentionCandidates = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    const people = (roomMembers || [])
      .filter((person) => Number(person.id) !== Number(me?.id))
      .filter((person) => {
        if (!q) return true;
        const hay = `${person.username || ""} ${person.first_name || ""} ${person.last_name || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
    const allOption =
      !q || "all".startsWith(q)
        ? [
            {
              id: 0,
              username: "all",
              first_name: "Everyone",
              last_name: "",
              kind: "all",
            },
          ]
        : [];
    return [...allOption, ...people];
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

  const attachMediaFile = (file) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File is too large (max 25MB).");
      return;
    }
    unlockNotificationSound();
    const kind = mediaKindFromFile(file);
    setPendingMedia((prev) => {
      if (prev?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(prev.preview);
      }
      return {
        file,
        kind,
        preview:
          kind === "image" || kind === "audio"
            ? URL.createObjectURL(file)
            : "",
        name: file.name || (kind === "image" ? "pasted-image.png" : "attachment"),
      };
    });
  };

  const onPickMedia = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    attachMediaFile(file);
  };

  const onPasteDraft = (event) => {
    const items = event.clipboardData?.items;
    if (!items?.length) return;
    for (const item of items) {
      if (!item?.type?.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      const ext = (item.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const named =
        file.name && file.name !== "image.png"
          ? file
          : new File([file], `pasted-image-${Date.now()}.${ext}`, {
              type: item.type || file.type || "image/png",
            });
      attachMediaFile(named);
      return;
    }
  };

  const clearPendingMedia = () => {
    if (pendingMedia?.preview?.startsWith("blob:")) {
      URL.revokeObjectURL(pendingMedia.preview);
    }
    setPendingMedia(null);
  };

  const startReplyTo = (msg) => {
    if (!msg || msg.is_deleted) return;
    const id = msg.id;
    if (!id || String(id).startsWith("tmp_") || Number(id) <= 0) return;
    unlockNotificationSound();
    setReplyingTo(msg);
    setMessageMenuId(null);
    setShowEmoji(false);
    requestAnimationFrame(() => draftRef.current?.focus());
  };

  const clearReplyTo = () => setReplyingTo(null);

  const applyLocalReaction = (messageId, emoji) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (Number(m.id) !== Number(messageId)) return m;
        const current = Array.isArray(m.reactions) ? [...m.reactions] : [];
        const mineEmoji = current.find((r) => r.mine)?.emoji;
        let next = current
          .map((r) => {
            if (!r.mine) return { ...r };
            const count = Math.max(0, (r.count || 1) - 1);
            if (count === 0) return null;
            return { ...r, count, mine: false };
          })
          .filter(Boolean);

        if (mineEmoji !== emoji) {
          const existing = next.find((r) => r.emoji === emoji);
          if (existing) {
            next = next.map((r) =>
              r.emoji === emoji
                ? { ...r, count: (r.count || 0) + 1, mine: true }
                : r
            );
          } else {
            next = [...next, { emoji, count: 1, mine: true }];
          }
        }
        next.sort(
          (a, b) => b.count - a.count || String(a.emoji).localeCompare(b.emoji)
        );
        return { ...m, reactions: next };
      })
    );
  };

  const reactToChatMessage = async (msg, emoji) => {
    if (!msg?.id || !activeId || !emoji) return;
    const messageId = Number(msg.id);
    if (!messageId) return;
    unlockNotificationSound();
    setMessageMenuId(null);
    applyLocalReaction(messageId, emoji);

    const viaSocket = reactToMessage?.(activeId, messageId, emoji);
    if (viaSocket) return;
    try {
      const res = await client.run(
        "post",
        endpoints.chatMessageReact(activeId, messageId),
        { emoji },
        true
      );
      if (res?.reactions) {
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.id) === messageId ? { ...m, reactions: res.reactions } : m
          )
        );
      }
    } catch {
      // Reload thread reactions on failure by refetching is heavy; leave optimistic.
      toast.error("Could not update reaction.");
    }
  };

  const scrollToMessage = (messageId) => {
    if (!messageId) return;
    const el = document.getElementById(`chat-msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary");
    }, 1200);
  };

  const stopRecordingTracks = () => {
    const stream = recordingStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
  };

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const resetRecordingState = () => {
    clearRecordingTimer();
    stopRecordingTracks();
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    recordingMimeRef.current = "";
    discardRecordingRef.current = false;
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const startAudioRecording = async () => {
    if (isRecording || sending || !activeId) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Audio recording is not supported in this browser.");
      return;
    }
    unlockNotificationSound();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredAudioMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingMimeRef.current = recorder.mimeType || mimeType || "audio/webm";
      discardRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const shouldDiscard = discardRecordingRef.current;
        const chunks = recordingChunksRef.current.slice();
        const mime = recordingMimeRef.current || "audio/webm";
        stopRecordingTracks();
        clearRecordingTimer();
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        setIsRecording(false);
        setRecordingSeconds(0);

        if (shouldDiscard || !chunks.length) {
          discardRecordingRef.current = false;
          return;
        }

        const blob = new Blob(chunks, { type: mime });
        if (!blob.size) {
          toast.error("Voice note was empty. Hold a moment longer, then stop.");
          return;
        }
        const ext = audioExtensionForMime(mime);
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, {
          type: mime.split(";")[0] || "audio/webm",
        });
        // WhatsApp-style: stop sends immediately (works with reply too).
        if (typeof sendVoiceNoteRef.current === "function") {
          sendVoiceNoteRef.current(file);
        } else {
          setPendingMedia((prev) => {
            if (prev?.preview?.startsWith("blob:")) {
              URL.revokeObjectURL(prev.preview);
            }
            return {
              file,
              kind: "audio",
              preview: URL.createObjectURL(file),
              name: file.name,
            };
          });
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      resetRecordingState();
      const denied =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      toast.error(
        denied
          ? "Microphone permission is required to record audio."
          : "Could not start audio recording."
      );
    }
  };

  const finishAudioRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      resetRecordingState();
      return;
    }
    discardRecordingRef.current = false;
    try {
      recorder.stop();
    } catch {
      resetRecordingState();
    }
  };

  const cancelAudioRecording = () => {
    const recorder = mediaRecorderRef.current;
    discardRecordingRef.current = true;
    if (!recorder || recorder.state === "inactive") {
      resetRecordingState();
      return;
    }
    try {
      recorder.stop();
    } catch {
      resetRecordingState();
    }
  };

  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        return;
      }
      discardRecordingRef.current = true;
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    };
  }, [activeId]);

  const submitMessage = async (e, overrides = null) => {
    e?.preventDefault?.();
    unlockNotificationSound();
    const body =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "body")
        ? String(overrides.body || "").trim()
        : draft.trim();
    const media = overrides?.media ?? pendingMedia;
    const replyTarget = overrides?.replyTarget ?? replyingTo;
    if ((!body && !media) || !activeId || sending || (isRecording && !overrides?.media)) {
      return;
    }
    const clientId = clientMessageId();
    let media_url = "";
    let media_type = "";
    setSending(true);
    try {
      if (media?.file) {
        const uploaded = await uploadFiles(media.file);
        media_url = Array.isArray(uploaded) ? uploaded[0] : uploaded;
        media_type = media.kind || mediaKindFromFile(media.file);
        if (!media_url) {
          toast.error("Could not upload that attachment. Try again.");
          setSending(false);
          return;
        }
      }
    } catch {
      toast.error(
        media?.kind === "audio"
          ? "Voice note upload failed. Check your connection and try again."
          : "Attachment upload failed. Try again."
      );
      setSending(false);
      return;
    }

    const mentions = pendingMentions.filter((m) =>
      body.toLowerCase().includes(`@${(m.username || "").toLowerCase()}`)
    );
    const replyToId =
      replyTarget?.id && Number(replyTarget.id) > 0 ? Number(replyTarget.id) : null;
    const optimistic = {
      id: `tmp_${clientId}`,
      conversation_id: activeId,
      body,
      media_url,
      media_type,
      mentions,
      reply_to_id: replyToId,
      reply_to: replyTarget
        ? {
            id: replyTarget.id,
            body: replyTarget.body || "",
            media_url: replyTarget.media_url || "",
            media_type: replyTarget.media_type || "",
            is_deleted: Boolean(replyTarget.is_deleted),
            sender: replyTarget.sender || null,
          }
        : null,
      reactions: [],
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
    playOutgoingChatSound();
    if (!overrides?.keepDraft) setDraft("");
    setPendingMentions([]);
    clearPendingMedia();
    clearReplyTo();
    setShowEmoji(false);
    setMentionOpen(false);
    setMessageMenuId(null);
    if (typingActiveRef.current && sendTyping) {
      typingActiveRef.current = false;
      sendTyping(activeId, false);
    }

    const extra = {
      media_url,
      media_type,
      mentions,
      reply_to_id: replyToId,
    };
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
        toast.error("Message failed to send.");
      }
    }
    setSending(false);
  };

  sendVoiceNoteRef.current = (file) => {
    if (!file) return;
    void submitMessage(null, {
      body: "",
      media: {
        file,
        kind: "audio",
        preview: "",
        name: file.name,
      },
      replyTarget: replyingToRef.current,
    });
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
                <p
                  className={`text-xs truncate ${
                    typingLabel ? "text-primary italic" : "text-muted"
                  }`}
                >
                  {headerSubtitle}
                </p>
              </button>
              <button
                type="button"
                disabled={startingCall}
                onClick={startOrRejoinClimateCall}
                className="min-h-10 min-w-10 flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-50"
                style={{ borderRadius: 8 }}
                aria-label="Start Climate Call"
                title="Start or rejoin Climate Call"
              >
                <IoCallOutline size={20} />
              </button>
              <button
                type="button"
                onClick={() => setGiftSheetOpen(true)}
                className="min-h-10 min-w-10 flex items-center justify-center text-primary hover:bg-primary/10"
                style={{ borderRadius: 8 }}
                aria-label="Gift a tree"
                title="Gift a tree"
              >
                <IoGiftOutline size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
              {loadingMessages ? (
                <div className="space-y-2" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`max-w-[62%] h-11 bg-surface border border-border animate-pulse ${
                        i % 2 ? "ml-auto" : ""
                      }`}
                      style={{ borderRadius: 12 }}
                    />
                  ))}
                </div>
              ) : null}

              {!loadingMessages && messages.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <span
                    className="mx-auto mb-3 flex h-12 w-12 items-center justify-center bg-surface border border-border text-primary"
                    style={{ borderRadius: 12 }}
                  >
                    <IoChatbubblesOutline size={22} />
                  </span>
                  <p className="font-medium">No messages yet</p>
                  <p className="mt-1 text-sm text-muted">
                    Say hello, paste a photo, or send a voice note.
                  </p>
                </div>
              ) : null}

              {messageGroups.map((group) => (
                <div key={group.day} className="mb-5 last:mb-0">
                  <div className="sticky top-0 z-[1] flex justify-center py-2 mb-1">
                    <span
                      className="text-[11px] font-medium px-2.5 py-1 bg-surface/95 border border-border text-muted backdrop-blur-sm"
                      style={{ borderRadius: 999 }}
                    >
                      {group.day}
                    </span>
                  </div>
                  <div className="flex flex-col">
                  {group.items.map((msg, idx) => {
                    const mine =
                      msg.is_mine || Number(msg.sender?.id) === Number(me?.id);
                    const prev = group.items[idx - 1];
                    const next = group.items[idx + 1];
                    const clusteredPrev = sameSender(prev, msg);
                    const clusteredNext = sameSender(next, msg);
                    const quoted = msg.reply_to;
                    const isAudio = msg.media_type === "audio";
                    const isVisual =
                      msg.media_type === "image" || msg.media_type === "video";
                    const mediaOnly = Boolean(
                      msg.media_url && !msg.body && !quoted && isVisual
                    );
                    const canAct =
                      Boolean(msg.id) &&
                      !String(msg.id).startsWith("tmp_") &&
                      Number(msg.id) > 0 &&
                      !msg.is_deleted;
                    const menuOpen = Number(messageMenuId) === Number(msg.id);
                    const reactions = Array.isArray(msg.reactions) ? msg.reactions : [];
                    const showSender =
                      !mine &&
                      activeConversation.conversation_type !== "dm" &&
                      !clusteredPrev;
                    return (
                      <div
                        key={msg.id || msg.client_id}
                        id={msg.id ? `chat-msg-${msg.id}` : undefined}
                        className={`group/msg relative flex items-end gap-1.5 transition-[box-shadow] ${
                          mine ? "justify-end" : "justify-start"
                        } ${clusteredPrev ? "mt-0.5" : "mt-2.5"} ${
                          reactions.length ? "mb-1" : ""
                        }`}
                        onDoubleClick={() => {
                          if (canAct) startReplyTo(msg);
                        }}
                      >
                        <div className="relative max-w-[85%] sm:max-w-[72%]">
                          {canAct ? (
                            <div
                              data-chat-msg-menu
                              className={`absolute top-1 z-[3] flex flex-col items-center gap-1 ${
                                mine ? "-left-3" : "-right-3"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setMessageMenuId(menuOpen ? null : msg.id)
                                }
                                className={`min-h-7 min-w-7 inline-flex items-center justify-center border border-border bg-surface text-muted shadow-sm hover:text-foreground transition-opacity ${
                                  menuOpen
                                    ? "opacity-100 text-foreground"
                                    : "opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100"
                                }`}
                                style={{ borderRadius: 999 }}
                                aria-label="Message actions"
                                title="Reply or react"
                                aria-expanded={menuOpen}
                              >
                                <IoEllipsisHorizontal size={14} />
                              </button>
                              {menuOpen ? (
                                <div
                                  className={`absolute top-8 z-[4] w-[220px] border border-border bg-surface shadow-lg p-2 animate-[fadeIn_160ms_ease-out] ${
                                    mine ? "left-0" : "right-0"
                                  }`}
                                  style={{ borderRadius: 10 }}
                                >
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {CHAT_QUICK_REACTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => reactToChatMessage(msg, emoji)}
                                        className="min-h-9 min-w-9 text-lg leading-none hover:bg-background"
                                        style={{ borderRadius: 8 }}
                                        aria-label={`React ${emoji}`}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => startReplyTo(msg)}
                                    className="w-full min-h-9 px-2.5 text-sm font-medium inline-flex items-center gap-2 hover:bg-background text-foreground"
                                    style={{ borderRadius: 8 }}
                                  >
                                    <IoArrowUndoOutline size={16} className="text-primary" />
                                    Reply
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        <div
                          className={`overflow-hidden border shadow-[0_1px_0_rgba(0,0,0,0.04)] ${
                            mine
                              ? "bg-primary text-primary-foreground border-primary/80"
                              : "bg-surface text-foreground border-border"
                          } ${
                            mediaOnly
                              ? "p-0"
                              : isAudio && !msg.body && !quoted
                                ? "p-1.5"
                                : "px-3 py-2"
                          } ${msg.pending ? "opacity-80" : ""}`}
                          style={bubbleRadius(mine, clusteredPrev, clusteredNext)}
                        >
                          {showSender ? (
                            msg.sender?.id ? (
                              <Link
                                to={profilePath(msg.sender.id)}
                                className={`text-[11px] font-semibold mb-1 block hover:underline ${
                                  mine ? "text-primary-foreground/85" : "text-primary"
                                } ${mediaOnly ? "px-3 pt-2" : ""}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {displayName(msg.sender)}
                              </Link>
                            ) : (
                              <p
                                className={`text-[11px] font-semibold mb-1 ${
                                  mine ? "text-primary-foreground/85" : "text-primary"
                                }`}
                              >
                                {displayName(msg.sender)}
                              </p>
                            )
                          ) : null}
                          {quoted ? (
                            <button
                              type="button"
                              onClick={() => scrollToMessage(quoted.id)}
                              className={`mb-1.5 w-full text-left border-l-[3px] px-2 py-1.5 ${
                                mine
                                  ? "border-primary-foreground/75 bg-black/20"
                                  : "border-primary bg-background"
                              }`}
                              style={{ borderRadius: 6 }}
                            >
                              <span
                                className={`block text-[11px] font-semibold truncate ${
                                  mine ? "text-primary-foreground" : "text-primary"
                                }`}
                              >
                                {displayName(quoted.sender)}
                              </span>
                              <span
                                className={`block text-[11px] truncate ${
                                  mine
                                    ? "text-primary-foreground/80"
                                    : "text-muted"
                                }`}
                              >
                                {replySnippet(quoted)}
                              </span>
                            </button>
                          ) : null}
                          {msg.media_url ? (
                            <div
                              className={`relative overflow-hidden group/media ${
                                msg.body && isVisual ? "-mx-3 -mt-0.5 mb-1.5" : ""
                              } ${quoted && isVisual ? "mb-1.5" : ""}`}
                              style={
                                isVisual
                                  ? {
                                      borderRadius: mediaOnly
                                        ? undefined
                                        : 8,
                                    }
                                  : undefined
                              }
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
                                <div
                                  className="flex items-center gap-2 min-w-[220px] sm:min-w-[260px] px-2.5 py-2 bg-background text-foreground border border-border/70"
                                  style={{ borderRadius: 8 }}
                                >
                                  <span
                                    className="shrink-0 h-9 w-9 inline-flex items-center justify-center bg-primary/15 text-primary"
                                    style={{ borderRadius: 999 }}
                                    aria-hidden
                                  >
                                    <IoMicOutline size={18} />
                                  </span>
                                  <audio
                                    src={secureMediaUrl(msg.media_url)}
                                    controls
                                    className="w-full min-w-0 h-8"
                                  />
                                  <button
                                    type="button"
                                    className="shrink-0 min-h-8 min-w-8 inline-flex items-center justify-center border border-border bg-surface text-foreground hover:bg-background"
                                    style={{ borderRadius: 5 }}
                                    aria-label="Download audio"
                                    title="Download"
                                    onClick={() =>
                                      downloadMedia(
                                        secureMediaUrl(msg.media_url),
                                        "climate-wavers-audio.mp3"
                                      )
                                    }
                                  >
                                    <IoDownloadOutline size={15} />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  className="flex items-center justify-between gap-2 px-3 py-2 bg-background text-foreground border border-border/70"
                                  style={{ borderRadius: 8 }}
                                >
                                  <a
                                    href={secureMediaUrl(msg.media_url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm underline truncate"
                                  >
                                    Open attachment
                                  </a>
                                  <button
                                    type="button"
                                    className="shrink-0 min-h-8 min-w-8 inline-flex items-center justify-center border border-border bg-surface text-foreground"
                                    style={{ borderRadius: 5 }}
                                    aria-label="Download attachment"
                                    title="Download"
                                    onClick={() =>
                                      downloadMedia(secureMediaUrl(msg.media_url))
                                    }
                                  >
                                    <IoDownloadOutline size={15} />
                                  </button>
                                </div>
                              )}
                              {isVisual ? (
                                <button
                                  type="button"
                                  className="absolute top-2 right-2 z-[1] min-h-8 min-w-8 inline-flex items-center justify-center bg-black/60 text-white hover:bg-black/75 opacity-100 sm:opacity-0 sm:group-hover/media:opacity-100 transition-opacity"
                                  style={{ borderRadius: 5 }}
                                  aria-label="Download media"
                                  title="Download"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    downloadMedia(
                                      secureMediaUrl(msg.media_url),
                                      msg.media_type === "video"
                                        ? "climate-wavers-video.mp4"
                                        : "climate-wavers-photo.jpg"
                                    );
                                  }}
                                >
                                  <IoDownloadOutline size={15} />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          {msg.body ? (
                            <div
                              className={`text-[15px] leading-snug break-words ${
                                msg.media_url && isVisual ? "px-3" : ""
                              }`}
                            >
                              {renderMessageBody(
                                msg.body,
                                mergeMentions(msg.mentions, roomMembers),
                                mine
                              )}
                              {climateCallEventId(msg.body) ? (
                                <button
                                  type="button"
                                  disabled={startingCall}
                                  onClick={() =>
                                    joinClimateCall(climateCallEventId(msg.body), {
                                      ring: false,
                                    })
                                  }
                                  className={`mt-2 min-h-10 w-full inline-flex items-center justify-center gap-2 px-3 text-sm font-semibold ${
                                    mine
                                      ? "bg-primary-foreground text-primary"
                                      : "bg-primary text-primary-foreground"
                                  }`}
                                  style={{ borderRadius: 5 }}
                                >
                                  <IoCallOutline size={16} />
                                  {startingCall ? "Joining…" : "Join Climate Call"}
                                </button>
                              ) : null}
                              <ChatLinkPreview text={msg.body} mine={mine} />
                            </div>
                          ) : null}
                          <p
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] leading-none ${
                              mediaOnly ? "absolute bottom-1.5 right-2 px-0" : ""
                            } ${
                              mediaOnly
                                ? "text-white drop-shadow"
                                : mine
                                  ? "text-primary-foreground/75"
                                  : "text-muted"
                            }`}
                          >
                            <span>{formatClock(msg.created_at)}</span>
                            {mine ? (
                              <MessageReceipt
                                pending={Boolean(msg.pending)}
                                read={
                                  !msg.pending &&
                                  Number(msg.id) > 0 &&
                                  Number(msg.id) <= Number(peerReadUpTo || 0)
                                }
                              />
                            ) : null}
                          </p>
                        </div>
                        {reactions.length ? (
                          <div
                            className={`absolute -bottom-3 z-[1] flex flex-wrap gap-1 max-w-full ${
                              mine ? "right-1 justify-end" : "left-1 justify-start"
                            }`}
                          >
                            {reactions.map((reaction) => (
                              <button
                                key={reaction.emoji}
                                type="button"
                                disabled={!canAct}
                                onClick={() =>
                                  canAct &&
                                  reactToChatMessage(msg, reaction.emoji)
                                }
                                className={`min-h-6 px-1.5 inline-flex items-center gap-1 text-[12px] border shadow-sm ${
                                  reaction.mine
                                    ? "border-primary bg-primary/15 text-foreground"
                                    : "border-border bg-surface text-foreground"
                                }`}
                                style={{ borderRadius: 999 }}
                                title={
                                  reaction.mine
                                    ? "Remove your reaction"
                                    : "Add this reaction"
                                }
                              >
                                <span>{reaction.emoji}</span>
                                {reaction.count > 1 ? (
                                  <span className="text-[10px] font-semibold tabular-nums text-muted">
                                    {reaction.count}
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              ))}

              {typingLabel ? (
                <div className="flex items-center gap-2 px-1 py-2 text-xs text-primary">
                  <span
                    className="inline-flex items-center justify-center min-h-8 min-w-[3.25rem] px-2.5 bg-surface border border-border"
                    style={{ borderRadius: 12 }}
                  >
                    <TypingDots className="text-muted" />
                  </span>
                  <span className="truncate italic">{typingLabel}</span>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {incomingCall?.eventId ? (
              <div className="shrink-0 mx-3 mb-2 border border-primary bg-primary/10 px-3 py-3 flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 animate-pulse">
                  <IoCallOutline size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {incomingCall.title || "Incoming Climate Call"}
                  </p>
                  <p className="text-xs text-muted">Tap answer to enter the same room</p>
                </div>
                <button
                  type="button"
                  disabled={startingCall}
                  onClick={() => joinClimateCall(incomingCall.eventId)}
                  className="min-h-10 px-3 text-sm font-semibold bg-primary text-primary-foreground"
                  style={{ borderRadius: 5 }}
                >
                  Answer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCallRingSound();
                    setIncomingCall(null);
                  }}
                  className="min-h-10 min-w-10 inline-flex items-center justify-center border border-border bg-background"
                  style={{ borderRadius: 5 }}
                  aria-label="Decline call"
                >
                  <IoClose size={16} />
                </button>
              </div>
            ) : null}

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
              onPaste={onPasteDraft}
            >
              {replyingTo ? (
                <div
                  className="flex items-start gap-2 border border-primary/25 bg-primary/5 px-3 py-2 animate-[fadeIn_200ms_ease-out]"
                  style={{ borderRadius: 8 }}
                >
                  <span className="mt-0.5 text-primary shrink-0">
                    <IoArrowUndoOutline size={16} />
                  </span>
                  <button
                    type="button"
                    onClick={() => scrollToMessage(replyingTo.id)}
                    className="min-w-0 flex-1 text-left border-l-[3px] border-primary pl-2"
                  >
                    <span className="block text-xs font-semibold text-primary truncate">
                      Replying to {displayName(replyingTo.sender)}
                    </span>
                    <span className="block text-xs text-muted truncate">
                      {replySnippet(replyingTo)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={clearReplyTo}
                    className="min-h-8 min-w-8 flex items-center justify-center text-muted hover:text-foreground"
                    aria-label="Cancel reply"
                  >
                    <IoClose size={16} />
                  </button>
                </div>
              ) : null}

              {pendingMedia ? (
                <div
                  className="flex items-center gap-3 border border-border bg-background px-3 py-2 animate-[fadeIn_200ms_ease-out]"
                  style={{ borderRadius: 8 }}
                >
                  {pendingMedia.kind === "audio" && pendingMedia.preview ? (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="shrink-0 h-9 w-9 inline-flex items-center justify-center bg-primary/15 text-primary"
                        style={{ borderRadius: 999 }}
                      >
                        <IoMicOutline size={18} />
                      </span>
                      <audio
                        src={pendingMedia.preview}
                        controls
                        className="min-w-0 flex-1 h-8"
                      />
                    </div>
                  ) : pendingMedia.kind === "image" && pendingMedia.preview ? (
                    <img
                      src={pendingMedia.preview}
                      alt=""
                      className="h-14 w-14 object-cover border border-border"
                      style={{ borderRadius: 6 }}
                    />
                  ) : pendingMedia.preview ? (
                    <img
                      src={pendingMedia.preview}
                      alt=""
                      className="h-12 w-12 object-cover"
                      style={{ borderRadius: 6 }}
                    />
                  ) : (
                    <span className="text-xs text-muted truncate">{pendingMedia.name}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">
                      {pendingMedia.kind === "audio"
                        ? "Voice note ready"
                        : pendingMedia.kind === "image"
                          ? "Photo ready"
                          : pendingMedia.name}
                    </p>
                    <p className="text-[11px] text-muted">Tap send to share</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearPendingMedia}
                    className="ml-auto min-h-8 min-w-8 flex items-center justify-center text-muted hover:text-foreground"
                    aria-label="Remove attachment"
                  >
                    <IoClose size={16} />
                  </button>
                </div>
              ) : null}

              {mentionOpen && mentionCandidates.length ? (
                <ul
                  className="border border-border bg-background max-h-40 overflow-y-auto shadow-sm"
                  style={{ borderRadius: 8 }}
                >
                  {mentionCandidates.map((person) => (
                    <li key={`${person.kind || "user"}-${person.id}-${person.username}`}>
                      <button
                        type="button"
                        onClick={() => insertMention(person)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface"
                      >
                        {person.kind === "all" ? (
                          <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center shrink-0">
                            <IoPeopleOutline size={14} />
                          </span>
                        ) : (
                          <img
                            src={avatarUrl(person)}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate">
                            {person.kind === "all" ? "Everyone" : displayName(person)}
                          </span>
                          <span className="block text-xs text-muted truncate">
                            {person.kind === "all"
                              ? "@all · notify room (app + email)"
                              : `@${person.username}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {showEmoji ? (
                <div
                  className="border border-border bg-background overflow-hidden"
                  style={{ borderRadius: 8 }}
                >
                  <LazyEmojiPicker
                    onEmojiClick={insertEmoji}
                    width="100%"
                    height={320}
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              ) : null}

              {isRecording ? (
                <div className="flex items-center gap-2 min-h-11">
                  <button
                    type="button"
                    onClick={cancelAudioRecording}
                    className="min-h-11 min-w-11 flex items-center justify-center text-muted hover:text-foreground border border-border bg-background"
                    style={{ borderRadius: 999 }}
                    aria-label="Cancel recording"
                    title="Cancel"
                  >
                    <IoTrashOutline size={20} />
                  </button>
                  <div
                    className="flex-1 flex items-center gap-2 border border-red-500/30 bg-red-500/5 px-3 py-2.5 min-h-11"
                    style={{ borderRadius: 12 }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"
                      aria-hidden
                    />
                    <span className="text-sm font-semibold tabular-nums">
                      {formatRecordingClock(recordingSeconds)}
                    </span>
                    <span className="text-xs text-muted truncate">
                      {replyingTo
                        ? "Recording reply… tap send when done"
                        : "Recording… tap send when done"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={finishAudioRecording}
                    className="min-h-11 min-w-11 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary-dark"
                    style={{ borderRadius: 999 }}
                    aria-label="Send voice note"
                    title="Send voice note"
                  >
                    <IoSend size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <input
                    ref={attachRef}
                    type="file"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={onPickMedia}
                  />
                  <div
                    className="flex-1 flex items-end gap-0.5 border border-border bg-background focus-within:border-primary transition-colors"
                    style={{ borderRadius: 12 }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        unlockNotificationSound();
                        attachRef.current?.click();
                      }}
                      className="min-h-11 min-w-10 flex items-center justify-center text-muted hover:text-foreground"
                      aria-label="Attach media"
                      title="Attach"
                    >
                      <IoAttachOutline size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        unlockNotificationSound();
                        setShowEmoji((v) => !v);
                      }}
                      className={`min-h-11 min-w-10 flex items-center justify-center hover:text-foreground ${
                        showEmoji ? "text-primary" : "text-muted"
                      }`}
                      aria-label="Emoji"
                      title="Emoji"
                    >
                      <IoHappyOutline size={20} />
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
                      <IoGiftOutline size={20} />
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
                      onPaste={onPasteDraft}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          submitMessage();
                        }
                        if (e.key === "Escape") {
                          setShowEmoji(false);
                          setMentionOpen(false);
                          if (replyingTo) clearReplyTo();
                        }
                      }}
                      placeholder={
                        replyingTo
                          ? `Reply to ${displayName(replyingTo.sender)}…`
                          : "Message · paste image · @mention"
                      }
                      className="flex-1 min-h-11 max-h-32 resize-none bg-transparent px-1.5 py-2.5 text-sm outline-none"
                    />
                  </div>
                  {draft.trim() || pendingMedia ? (
                    <button
                      type="submit"
                      disabled={sending}
                      className="min-h-11 min-w-11 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
                      style={{ borderRadius: 999 }}
                      aria-label="Send message"
                      title="Send"
                    >
                      <IoSend size={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startAudioRecording}
                      disabled={sending || !activeId}
                      className="min-h-11 min-w-11 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
                      style={{ borderRadius: 999 }}
                      aria-label="Record audio"
                      title="Record voice note"
                    >
                      <IoMicOutline size={20} />
                    </button>
                  )}
                </div>
              )}
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

      {climateCall ? (
        <JitsiMeetEmbed
          roomName={climateCall.roomName}
          displayName={climateCall.displayName}
          subject={climateCall.subject}
          domain={climateCall.domain}
          onClose={() => {
            stopCallRingSound();
            setClimateCall(null);
          }}
        />
      ) : null}

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

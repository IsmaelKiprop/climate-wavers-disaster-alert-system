import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { getUser } from "../../utils/factory";
import { chatbotApiUrl } from "../../config/env";
import { WaverXBotPageSEO } from "../../components/SEOComponents";

const chatbot = chatbotApiUrl("/api/v1");

const STARTERS = [
  "What live disasters are active right now?",
  "How does Climate Wavers verify an alert?",
  "What should I do during a flood warning?",
  "How can I reduce my carbon footprint?",
];

function sortMessages(rows = []) {
  return [...rows].sort((a, b) => (a.postedAt || 0) - (b.postedAt || 0));
}

function userId() {
  const user = getUser();
  return user?.id ? String(user.id) : "";
}

function displayName() {
  const user = getUser() || {};
  return user.first_name || user.firstName || user.username || "there";
}

const WaverXChatPage = () => {
  const [chats, setChats] = useState([]);
  const [current, setCurrent] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const me = userId();

  const loadChats = async () => {
    if (!me) return [];
    const res = await axios.get(`${chatbot}/chats`, { params: { userId: me } });
    const next = Array.isArray(res.data) ? [...res.data].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
    setChats(next);
    return next;
  };

  useEffect(() => {
    loadChats().catch(() => {
      setError("WaverX could not load your chats yet. The assistant service may be waking up.");
    });
  }, [me]);

  useEffect(() => {
    if (!current) {
      setMessages([]);
      return undefined;
    }
    let cancelled = false;
    const loadMessages = async () => {
      try {
        const res = await axios.get(`${chatbot}/chats/${current}`);
        if (!cancelled && Array.isArray(res.data)) {
          setMessages(sortMessages(res.data));
        }
      } catch {
        if (!cancelled) setError("Could not load this conversation.");
      }
    };
    loadMessages();
    const timer = setInterval(loadMessages, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [current]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const createChat = async () => {
    if (!me) {
      throw new Error("Sign in to chat with WaverX.");
    }
    const res = await axios.post(`${chatbot}/chats`, { userId: me });
    setChats((prev) => [res.data, ...prev]);
    setCurrent(res.data.id);
    setMessages([]);
    return res.data;
  };

  const send = async (text) => {
    const body = String(text || draft).trim();
    if (!body || busy) return;
    setDraft("");
    setError("");
    setBusy(true);
    try {
      let chatId = current;
      if (!chatId) {
        const created = await createChat();
        chatId = created.id;
      }
      const optimistic = { id: `local-${Date.now()}`, body, postedBy: me, postedAt: Date.now() };
      setMessages((prev) => [...prev, optimistic]);
      const res = await axios.post(`${chatbot}/chats/${chatId}`, { body, userId: me });
      const incoming = [];
      if (res.data?.message) incoming.push(res.data.message);
      if (res.data?.response) incoming.push(res.data.response);
      if (incoming.length) {
        setMessages((prev) => sortMessages([...prev.filter((row) => row.id !== optimistic.id), ...incoming]));
      }
      await loadChats();
    } catch {
      setError("WaverX did not reply. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <WaverXBotPageSEO />
      <div className="flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-5.5rem)] min-h-[420px]">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <h1 className="text-lg font-semibold">WaverX</h1>
            <p className="text-sm text-muted">Ask about live alerts, verification, and climate action.</p>
          </div>
          <button
            type="button"
            onClick={() => createChat().catch((err) => setError(err.message))}
            className="h-10 px-3 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
          >
            New chat
          </button>
        </div>

        {chats.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto py-3">
            {chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => setCurrent(chat.id)}
                className={`shrink-0 px-3 py-2 text-sm border ${
                  chat.id === current ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"
                }`}
              >
                {chat.title || "Conversation"}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : null}

        <div ref={listRef} className="flex-1 overflow-y-auto py-4 space-y-3">
          {messages.length === 0 && !busy ? (
            <div>
              <p className="text-foreground">Hello {displayName()}. How can I help you today?</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTERS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    className="text-left p-3 border border-border bg-surface text-sm hover:border-primary"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const mine = String(message.postedBy) === String(me);
              return (
                <div key={message.id || `${message.postedAt}-${message.body}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <p className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${mine ? "bg-primary text-primary-foreground" : "bg-surface border border-border"}`}>
                    {message.body}
                  </p>
                </div>
              );
            })
          )}
          {busy ? <p className="text-sm text-muted">WaverX is writing...</p> : null}
        </div>

        <form
          className="flex gap-2 pt-3 border-t border-border"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <label htmlFor="waverx-input" className="sr-only">Message WaverX</label>
          <input
            id="waverx-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-11 flex-1 px-3 border border-border bg-surface"
            placeholder="Ask WaverX about climate, alerts, or verification"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="h-11 px-4 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
};

export default WaverXChatPage;

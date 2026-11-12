import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  IoClose,
  IoGiftOutline,
  IoLeafOutline,
  IoSend,
  IoSparklesOutline,
} from "react-icons/io5";
import { avatarUrl } from "../utils/factory";
import { giftTreesPath, profileOgShareUrl } from "../utils/profileCompleteness";

const PROMPTS = [
  {
    title: "Plant kindness in this chat",
    body: "A gifted tree is a living thank-you — lasting, local, and shareable.",
  },
  {
    title: "Celebrate someone with roots",
    body: "Surprise a friend here. They get the love; the planet gets the tree.",
  },
  {
    title: "Turn a hello into impact",
    body: "One tap gifts a verified tree and sends a warm invite they can open anytime.",
  },
];

function personName(person) {
  if (!person) return "a friend";
  const full = `${person.first_name || ""} ${person.last_name || ""}`.trim();
  return full || person.username || "a friend";
}

function giftInviteMessage(person) {
  const name = personName(person);
  const link = profileOgShareUrl(person.id);
  return (
    `🌱 I just thought of you, ${name}.\n` +
    `Gift a tree on Climate Wavers and grow impact together:\n` +
    `${link}`
  );
}

const ChatTreeGiftSheet = ({
  open,
  onClose,
  suggestions = [],
  conversationType = "group",
  onSendInvite,
  onGiftNow,
}) => {
  const [promptIndex, setPromptIndex] = useState(0);
  const [pickedId, setPickedId] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setPickedId(suggestions[0]?.id || null);
    const timer = window.setInterval(() => {
      setPromptIndex((i) => (i + 1) % PROMPTS.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open, suggestions]);

  const prompt = PROMPTS[promptIndex % PROMPTS.length];
  const picked = useMemo(
    () => suggestions.find((p) => Number(p.id) === Number(pickedId)) || suggestions[0] || null,
    [suggestions, pickedId]
  );

  if (!open) return null;

  const sendInvite = async () => {
    if (!picked?.id || sending) return;
    setSending(true);
    try {
      await onSendInvite?.(picked, giftInviteMessage(picked));
      onClose?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40">
      <button type="button" className="absolute inset-0" aria-label="Close gift ideas" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-gift-title"
        className="relative z-10 w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto border border-border bg-surface shadow-xl animate-[slideUp_220ms_ease-out]"
      >
        <div className="relative overflow-hidden border-b border-border bg-primary text-primary-foreground px-5 pt-5 pb-6">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary-foreground/10" />
          <div className="absolute right-10 bottom-2 h-16 w-16 rounded-full bg-primary-foreground/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary-foreground/85">
                <IoSparklesOutline size={14} />
                Tree gift ideas
              </p>
              <h2 id="chat-gift-title" className="mt-2 text-xl font-semibold leading-snug">
                {prompt.title}
              </h2>
              <p className="mt-2 text-sm text-primary-foreground/90 max-w-sm">{prompt.body}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 min-w-10 flex items-center justify-center bg-primary-foreground/15 hover:bg-primary-foreground/25"
              aria-label="Close"
            >
              <IoClose size={20} />
            </button>
          </div>
          <div className="relative mt-4 flex gap-1.5">
            {PROMPTS.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 ${
                  i === promptIndex % PROMPTS.length
                    ? "bg-primary-foreground"
                    : "bg-primary-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {conversationType === "dm" ? "Gift this chat" : "Suggested from this chat"}
            </p>
            {!suggestions.length ? (
              <p className="mt-3 text-sm text-muted">
                Open a conversation with friends, then gift them a tree from here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {suggestions.slice(0, 8).map((person, index) => {
                  const active = Number(person.id) === Number(picked?.id);
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => setPickedId(person.id)}
                        className={`w-full flex items-center gap-3 px-3 py-3 text-left border transition-colors ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background hover:border-primary/40"
                        }`}
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <img
                          src={avatarUrl(person)}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover bg-surface"
                          onError={(e) => {
                            e.currentTarget.src = "/avatar.png";
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">
                            {personName(person)}
                          </span>
                          <span className="block text-xs text-muted truncate">
                            @{person.username || "member"}
                            {person.is_online ? " · online now" : ""}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-background border border-border text-muted"
                          }`}
                        >
                          <IoLeafOutline size={16} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {picked ? (
            <div className="border border-border bg-background px-4 py-4 space-y-3">
              <p className="text-sm font-medium">
                Ready to gift {personName(picked)} a tree?
              </p>
              <p className="text-xs text-muted leading-relaxed">
                Plant a verified tree in their name, or drop a warm invite into this chat so
                they can open your gift link.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={sendInvite}
                  className="min-h-11 flex-1 inline-flex items-center justify-center gap-2 px-4 border border-border text-sm font-medium disabled:opacity-60"
                >
                  <IoSend size={16} />
                  {sending ? "Sending…" : "Send invite in chat"}
                </button>
                <Link
                  to={giftTreesPath(picked.id, personName(picked))}
                  onClick={() => {
                    onGiftNow?.(picked);
                    onClose?.();
                  }}
                  className="min-h-11 flex-1 inline-flex items-center justify-center gap-2 px-4 bg-primary text-primary-foreground text-sm font-medium"
                >
                  <IoGiftOutline size={16} />
                  Gift a tree now
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(18px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChatTreeGiftSheet;

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  FaCheck,
  FaCopy,
  FaFacebook,
  FaLinkedin,
  FaWhatsapp,
} from "react-icons/fa6";
import { FaTwitter } from "react-icons/fa";
import {
  IoChatbubbleEllipsesOutline,
  IoClose,
  IoLeafOutline,
  IoQrCodeOutline,
} from "react-icons/io5";
import {
  buyMeTreeShareText,
  collectSpeciesOptions,
  giftTreesPath,
  giftTreesUrl,
  profileOgPreviewImage,
  stashChatShareDraft,
} from "../utils/profileCompleteness";
import { secureMediaUrl } from "../utils/factory";
import { apiUrl } from "../config/env";
import { endpoints } from "../utils/endpoints";
import { unwrapList } from "../utils/apiData";
import BuyMeATreeQrModal from "./BuyMeATreeQrModal";

const shareChannels = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: FaWhatsapp,
    iconClass: "text-[#25D366]",
    build: (text, url) =>
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: FaFacebook,
    build: (_text, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "x",
    label: "X",
    icon: FaTwitter,
    build: (text, url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: FaLinkedin,
    build: (_text, url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
];

const BuyMeATreeShareModal = ({ user, onClose }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [showQr, setShowQr] = useState(false);

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.display_name ||
    user?.username ||
    "Climate Wavers member";

  const rawPhoto = secureMediaUrl(
    user?.profile_picture || user?.profile_pic || user?.picture,
    "/avatar.png"
  );
  const previewImage = useMemo(
    () => profileOgPreviewImage(rawPhoto, "/og-image.jpg"),
    [rawPhoto]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(apiUrl(endpoints.tree_projects_african), {
          headers: { Accept: "application/json" },
        });
        const data = response.ok ? await response.json() : [];
        const list = collectSpeciesOptions(unwrapList(data));
        if (!alive) return;
        setOptions(list);
        setSelectedKey(list[0]?.key || "");
      } catch {
        if (alive) {
          setOptions([]);
          setSelectedKey("");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape" && !showQr) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, showQr]);

  const selected = useMemo(
    () => options.find((o) => o.key === selectedKey) || null,
    [options, selectedKey]
  );

  const giftOpts = useMemo(() => {
    if (!selected) return {};
    return {
      projectId: selected.projectId,
      species: selected.species || undefined,
    };
  }, [selected]);

  const giftPath = useMemo(
    () => giftTreesPath(user?.id, displayName, giftOpts),
    [user?.id, displayName, giftOpts]
  );
  const giftUrl = useMemo(
    () => giftTreesUrl(user?.id, displayName, giftOpts),
    [user?.id, displayName, giftOpts]
  );

  const shareText = useMemo(() => {
    if (selected?.projectOnly) {
      return `Buy me a tree for “${selected.projectName}” on Climate Wavers! 🌱`;
    }
    return buyMeTreeShareText(selected?.species, displayName);
  }, [selected, displayName]);

  const copy = async () => {
    const payload = `${shareText}\n${giftUrl}`;
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const area = document.createElement("textarea");
      area.value = payload;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openShare = (url) => {
    window.open(url, "_blank", "noopener,noreferrer,width=640,height=520");
  };

  const sendInChat = () => {
    stashChatShareDraft(`${shareText}\n${giftUrl}`);
    onClose?.();
    navigate("/app/chat");
  };

  if (typeof document === "undefined" || !user) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(0, 0, 0, 0.72)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-[440px] border border-border shadow-2xl max-h-[88dvh] flex flex-col overflow-hidden"
        style={{
          background: "var(--cw-surface-elevated)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-me-tree-title"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3
              id="buy-me-tree-title"
              className="text-base font-semibold text-foreground truncate"
            >
              Buy me a tree
            </h3>
            <p className="text-xs text-muted">
              Pick a species from live projects, then share
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-[var(--cw-overlay-soft)]"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </header>

        <div className="overflow-y-auto min-h-0 flex-1">
          <div className="border-b border-border bg-[var(--cw-background)]">
            <div
              className="relative w-full overflow-hidden"
              style={{ aspectRatio: "1.91 / 1" }}
            >
              <img
                src={
                  selected?.cover
                    ? profileOgPreviewImage(selected.cover, previewImage)
                    : previewImage
                }
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  if (e.target.dataset.fallback === "1") return;
                  e.target.dataset.fallback = "1";
                  e.target.src = rawPhoto || "/og-image.jpg";
                }}
              />
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                Climate Wavers gift ask
              </p>
              <h4 className="text-sm font-semibold text-foreground leading-snug">
                {shareText.replace(/\s*🌱\s*$/, "")}
              </h4>
              {selected?.projectName ? (
                <p className="text-xs text-muted">
                  Via {selected.projectName}
                  {selected.country ? ` · ${selected.country}` : ""}
                </p>
              ) : null}
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted mb-2">
                Tree species
              </p>
              {loading ? (
                <p className="text-sm text-muted">Loading projects…</p>
              ) : options.length === 0 ? (
                <p className="text-sm text-muted">
                  No verified planting projects yet. You can still share a general
                  gift link.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                  {options.map((opt) => {
                    const active = opt.key === selectedKey;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSelectedKey(opt.key)}
                        className={`h-9 px-3 text-xs font-medium border inline-flex items-center gap-1.5 ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:bg-[var(--cw-overlay-soft)]"
                        }`}
                      >
                        <IoLeafOutline size={14} />
                        {opt.projectOnly
                          ? opt.label
                          : opt.species}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-muted mb-2">Gift link</p>
              <div className="flex gap-2">
                <div
                  className="flex-1 min-w-0 border border-border px-3 py-2.5 text-xs text-muted truncate"
                  style={{ background: "var(--cw-background)" }}
                >
                  {giftUrl}
                </div>
                <button
                  type="button"
                  onClick={copy}
                  className="h-10 px-3.5 border border-border text-sm text-foreground inline-flex items-center gap-2 shrink-0 hover:bg-[var(--cw-overlay-soft)]"
                >
                  {copied ? <FaCheck className="text-primary" /> : <FaCopy />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted mb-2">Share to</p>
              <div className="grid grid-cols-4 gap-2">
                {shareChannels.map(
                  ({ key, label, icon: Icon, iconClass, build }) => (
                    <button
                      key={key}
                      type="button"
                      className="h-[4.25rem] border border-border inline-flex flex-col items-center justify-center gap-1.5 text-xs text-foreground hover:bg-[var(--cw-overlay-soft)]"
                      onClick={() => openShare(build(shareText, giftUrl))}
                    >
                      <Icon size={18} className={iconClass || ""} />
                      <span>{label}</span>
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={sendInChat}
                className="mt-2 w-full h-11 border border-border text-sm text-foreground inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)]"
              >
                <IoChatbubbleEllipsesOutline size={18} />
                Send in Climate Wavers chat
              </button>
            </div>
          </div>
        </div>

        <footer
          className="shrink-0 border-t border-border p-4 grid grid-cols-2 gap-2"
          style={{ background: "var(--cw-surface-elevated)" }}
        >
          <a
            href={giftPath}
            className="h-11 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center hover:opacity-95"
          >
            Open gift page
          </a>
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="h-11 border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)]"
          >
            <IoQrCodeOutline size={18} />
            QR
          </button>
        </footer>
      </div>

      {showQr ? (
        <BuyMeATreeQrModal
          user={user}
          species={selected?.species || ""}
          projectId={selected?.projectId}
          shareHeadline={shareText}
          onClose={() => setShowQr(false)}
        />
      ) : null}
    </div>,
    document.body
  );
};

export default BuyMeATreeShareModal;

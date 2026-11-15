import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IoClose, IoLeafOutline } from "react-icons/io5";
import { env } from "../config/env";

function loadJitsiScript(domain) {
  const src = `https://${domain}/external_api.js`;
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Jitsi")));
      if (window.JitsiMeetExternalAPI) resolve();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Jitsi"));
    document.body.appendChild(script);
  });
}

/**
 * Immersive full-viewport Climate Wavers conference room (portaled above app chrome).
 */
const JitsiMeetEmbed = ({
  roomName,
  displayName = "Climate Wavers member",
  subject = "Climate Wavers",
  domain,
  onClose,
}) => {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const host = domain || env.jitsiDomain || "meet.jit.si";

  useEffect(() => {
    let cancelled = false;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);

    (async () => {
      try {
        await loadJitsiScript(host);
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) {
          return;
        }
        apiRef.current = new window.JitsiMeetExternalAPI(host, {
          roomName,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName },
          configOverwrite: {
            subject,
            prejoinConfig: { enabled: true },
            prejoinPageEnabled: true,
            startWithAudioMuted: false,
            startWithVideoMuted: true,
            disableDeepLinking: true,
            disableInviteFunctions: true,
            enableClosePage: false,
            enableWelcomePage: false,
            defaultLanguage: "en",
            hideConferenceTimer: false,
            hideConferenceSubject: true,
            notifications: [],
            disabledNotifications: [
              "dialog.grantModerator",
              "notify.disconnected",
              "notify.connectedOneMember",
              "notify.connectedTwoMembers",
              "notify.connectedThreePlusMembers",
            ],
            toolbarButtons: [
              "microphone",
              "camera",
              "desktop",
              "chat",
              "raisehand",
              "tileview",
              "hangup",
            ],
            analytics: { disabled: true },
          },
          interfaceConfigOverwrite: {
            APP_NAME: "Climate Wavers",
            NATIVE_APP_NAME: "Climate Wavers",
            PROVIDER_NAME: "Climate Wavers",
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_POWERED_BY: false,
            SHOW_CHROME_EXTENSION_BANNER: false,
            SHOW_PROMOTIONAL_CLOSE_PAGE: false,
            MOBILE_APP_PROMO: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            DISABLE_FOCUS_INDICATOR: true,
            DEFAULT_BACKGROUND: "#0f1411",
            DEFAULT_LOCAL_DISPLAY_NAME: "you",
            DEFAULT_REMOTE_DISPLAY_NAME: "Climate Wavers member",
            TOOLBAR_ALWAYS_VISIBLE: false,
            FILM_STRIP_MAX_HEIGHT: 96,
            SETTINGS_SECTIONS: ["devices", "language"],
            TOOLBAR_BUTTONS: [
              "microphone",
              "camera",
              "desktop",
              "chat",
              "raisehand",
              "tileview",
              "hangup",
            ],
          },
        });
        apiRef.current.addListener("videoConferenceJoined", () => {
          if (!cancelled) setPhase("ready");
        });
        apiRef.current.addListener("readyToClose", () => onClose?.());
        // Prejoin still counts as usable UI
        window.setTimeout(() => {
          if (!cancelled) setPhase((p) => (p === "loading" ? "ready" : p));
        }, 1200);
      } catch (err) {
        console.error(err);
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      try {
        apiRef.current?.dispose?.();
      } catch {
        /* ignore */
      }
      apiRef.current = null;
    };
  }, [roomName, displayName, subject, host, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "var(--cw-background, #0f1411)" }}
      role="dialog"
      aria-modal="true"
      aria-label={subject}
    >
      <header
        className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border"
        style={{ background: "var(--cw-surface-elevated, #151c18)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 border border-border bg-background inline-flex items-center justify-center text-primary">
            <IoLeafOutline size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Climate Wavers room
            </p>
            <h2 className="text-sm font-semibold text-foreground truncate">
              {subject}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-3 border border-border text-sm text-foreground inline-flex items-center gap-2 hover:bg-[var(--cw-overlay-soft)]"
          aria-label="Leave call"
        >
          <IoClose size={18} />
          Leave
        </button>
      </header>

      <div className="relative flex-1 min-h-0 w-full bg-background">
        {phase === "loading" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background">
            <div className="h-10 w-10 border border-border border-t-primary animate-spin" />
            <p className="text-sm text-muted">Opening Climate room…</p>
          </div>
        ) : null}
        {phase === "error" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center bg-background">
            <p className="text-sm font-medium text-foreground">
              Could not load the conference room
            </p>
            <p className="text-xs text-muted max-w-sm">
              Check your connection and try again. Public meet.jit.si may show
              temporary demo notices until a Climate Wavers host is configured.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium"
            >
              Back to calendar
            </button>
          </div>
        ) : null}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>,
    document.body
  );
};

export default JitsiMeetEmbed;

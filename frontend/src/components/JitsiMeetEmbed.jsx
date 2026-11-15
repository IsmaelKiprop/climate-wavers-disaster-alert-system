import { useEffect, useRef } from "react";
import { IoClose } from "react-icons/io5";
import { env } from "../config/env";

function loadJitsiScript(domain) {
  const src = `https://${domain}/external_api.js`;
  if (document.querySelector(`script[src="${src}"]`)) {
    return Promise.resolve();
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
 * Full-screen Climate Wavers conference room (Jitsi Meet embed).
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
  const host = domain || env.jitsiDomain || "meet.jit.si";

  useEffect(() => {
    let cancelled = false;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

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
            prejoinPageEnabled: true,
            startWithAudioMuted: false,
            startWithVideoMuted: true,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_REMOTE_DISPLAY_NAME: "Climate Wavers member",
            TOOLBAR_BUTTONS: [
              "microphone",
              "camera",
              "desktop",
              "chat",
              "raisehand",
              "tileview",
              "hangup",
              "fullscreen",
            ],
          },
        });
        apiRef.current.addListener("readyToClose", () => onClose?.());
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      try {
        apiRef.current?.dispose?.();
      } catch {
        /* ignore */
      }
      apiRef.current = null;
    };
  }, [roomName, displayName, subject, host, onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col"
      style={{ background: "#0b0f0c" }}
      role="dialog"
      aria-modal="true"
      aria-label={subject}
    >
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-white/50">
            Climate Wavers room
          </p>
          <h2 className="text-sm font-semibold text-white truncate">{subject}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 inline-flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10"
          aria-label="Leave call"
        >
          <IoClose size={22} />
        </button>
      </header>
      <div ref={containerRef} className="flex-1 min-h-0 w-full" />
    </div>
  );
};

export default JitsiMeetEmbed;

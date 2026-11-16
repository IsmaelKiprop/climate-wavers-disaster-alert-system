import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";

/**
 * Full-screen siren when a proximity_alert notification arrives.
 * Parent should call openSiren(payload) via the exported event bus or props.
 */
export function openProximitySiren(detail) {
  window.dispatchEvent(new CustomEvent("cw-proximity-siren", { detail }));
}

const ProximitySirenOverlay = () => {
  const [active, setActive] = useState(null);
  const audioCtx = useRef(null);
  const oscRef = useRef(null);

  useEffect(() => {
    const onSiren = (e) => setActive(e.detail || {});
    window.addEventListener("cw-proximity-siren", onSiren);
    return () => window.removeEventListener("cw-proximity-siren", onSiren);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return undefined;
      const ctx = new Ctx();
      audioCtx.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      oscRef.current = osc;
      const pulse = window.setInterval(() => {
        osc.frequency.value = osc.frequency.value === 880 ? 660 : 880;
      }, 400);
      return () => {
        window.clearInterval(pulse);
        try {
          osc.stop();
          ctx.close();
        } catch {
          /* ignore */
        }
      };
    } catch {
      return undefined;
    }
  }, [active]);

  const dismiss = async (ack) => {
    const blastId = active?.blast_id;
    if (blastId) {
      try {
        await client.run("post", endpoints.championsWarnAck(blastId), { ack }, true);
      } catch {
        /* ignore */
      }
    }
    setActive(null);
  };

  if (!active || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center p-6 text-center"
      style={{ background: "rgba(8,12,12,0.94)" }}
      role="alertdialog"
      aria-modal="true"
      aria-label="Proximity hazard alert"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-white/70 mb-3">
        Community Champion warning
      </p>
      <h2 className="text-2xl sm:text-4xl font-semibold text-white max-w-lg leading-tight animate-pulse">
        {active.message || "Hazard nearby — stay safe"}
      </h2>
      {active.note ? (
        <p className="mt-3 text-sm text-white/80 max-w-md">{active.note}</p>
      ) : null}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-md">
        <button
          type="button"
          onClick={() => dismiss("got_it")}
          className="h-12 bg-primary text-primary-foreground text-sm font-semibold"
        >
          Got it
        </button>
        <button
          type="button"
          onClick={() => dismiss("need_help")}
          className="h-12 bg-destructive text-white text-sm font-semibold"
        >
          I need help
        </button>
        <button
          type="button"
          onClick={() => dismiss("false_alarm")}
          className="h-12 border border-white/30 text-white text-sm"
        >
          False alarm
        </button>
      </div>
    </div>,
    document.body
  );
};

export default ProximitySirenOverlay;

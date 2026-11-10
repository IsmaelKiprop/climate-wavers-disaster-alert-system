let audioCtx = null;
let unlocked = false;
let lastPlayedAt = 0;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  // Only construct after a user gesture — Chrome blocks autoplay AudioContext.
  if (!unlocked) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  return audioCtx;
}

/** Browsers block sound until a user gesture — call once from a click/tap. */
export function unlockNotificationSound() {
  if (typeof window === "undefined") return;
  unlocked = true;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

/**
 * Soft two-tone chime for new in-app notifications.
 * Skips if called too often (rapid burst) or before unlock.
 */
export function playNotificationSound() {
  if (!unlocked) return;

  const now = Date.now();
  if (now - lastPlayedAt < 1200) return;
  lastPlayedAt = now;

  const ctx = getContext();
  if (!ctx) return;

  const start = () => {
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    master.connect(ctx.destination);

    const tones = [
      { freq: 880, at: 0 },
      { freq: 1174.66, at: 0.12 },
    ];

    tones.forEach(({ freq, at }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0 + at);
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.28);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.32);
    });
  };

  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(start)
      .catch(() => {});
    return;
  }
  start();
}

export function bindNotificationSoundUnlock() {
  if (typeof window === "undefined" || unlocked) return () => {};
  const unlock = () => unlockNotificationSound();
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

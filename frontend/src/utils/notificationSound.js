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
function playToneSequence(tones, { volume = 0.12, minGapMs = 400 } = {}) {
  if (!unlocked) return;

  const now = Date.now();
  if (now - lastPlayedAt < minGapMs) return;
  lastPlayedAt = now;

  const ctx = getContext();
  if (!ctx) return;

  const start = () => {
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    master.connect(ctx.destination);

    tones.forEach(({ freq, at, duration = 0.28 }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0 + at);
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0 + at);
      osc.stop(t0 + at + duration + 0.02);
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

/** Soft two-tone chime for new in-app notifications / incoming chat. */
export function playNotificationSound() {
  playToneSequence(
    [
      { freq: 880, at: 0 },
      { freq: 1174.66, at: 0.12 },
    ],
    { volume: 0.12, minGapMs: 900 }
  );
}

/** Incoming WhatsApp-style chat pop. */
export function playIncomingChatSound() {
  playToneSequence(
    [
      { freq: 740, at: 0, duration: 0.16 },
      { freq: 988, at: 0.1, duration: 0.2 },
    ],
    { volume: 0.11, minGapMs: 350 }
  );
}

/** Short outgoing send tick. */
export function playOutgoingChatSound() {
  playToneSequence([{ freq: 1200, at: 0, duration: 0.1 }], {
    volume: 0.08,
    minGapMs: 180,
  });
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

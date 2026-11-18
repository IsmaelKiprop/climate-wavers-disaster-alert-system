let audioCtx = null;
let unlocked = false;
let lastPlayedAt = 0;
let unlockBound = false;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  return audioCtx;
}

async function ensureRunning() {
  const ctx = getContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }
  return ctx.state === "running" || ctx.state === "suspended" ? ctx : null;
}

/** Browsers block sound until a user gesture — call from click/tap/send. */
export function unlockNotificationSound() {
  if (typeof window === "undefined") return;
  unlocked = true;
  try {
    sessionStorage.setItem("cw_sound_unlocked", "1");
  } catch {
    /* ignore */
  }
  ensureRunning();
}

function wasUnlockedBefore() {
  try {
    return sessionStorage.getItem("cw_sound_unlocked") === "1";
  } catch {
    return false;
  }
}

/**
 * Hard notification tones (Web Audio). Louder + punchier than soft chimes.
 */
function playToneSequence(tones, { volume = 0.55, minGapMs = 400 } = {}) {
  if (typeof window === "undefined") return;
  if (!unlocked && !wasUnlockedBefore()) return;
  unlocked = true;

  const now = Date.now();
  if (now - lastPlayedAt < minGapMs) return;
  lastPlayedAt = now;

  const start = (ctx) => {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    // Hard attack, sustained body, clean release
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(Math.min(volume, 0.85), t0 + 0.008);
    const endAt =
      t0 +
      tones.reduce((max, tone) => Math.max(max, tone.at + (tone.duration || 0.22)), 0.2) +
      0.08;
    master.gain.exponentialRampToValueAtTime(0.0001, endAt);
    master.connect(ctx.destination);

    tones.forEach(({ freq, at, duration = 0.22, type = "square", gain = 0.35 }) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const startAt = t0 + at;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startAt);
      amp.gain.setValueAtTime(0.0001, startAt);
      amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(amp);
      amp.connect(master);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.03);

      // Soft sine layer for body (less harsh than pure square)
      const soft = ctx.createOscillator();
      const softGain = ctx.createGain();
      soft.type = "sine";
      soft.frequency.setValueAtTime(freq, startAt);
      softGain.gain.setValueAtTime(0.0001, startAt);
      softGain.gain.exponentialRampToValueAtTime(gain * 0.55, startAt + 0.012);
      softGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      soft.connect(softGain);
      softGain.connect(master);
      soft.start(startAt);
      soft.stop(startAt + duration + 0.03);
    });
  };

  ensureRunning().then((ctx) => {
    if (!ctx) return;
    start(ctx);
  });
}

/** Strong two-tone for in-app notifications (follows, alerts, etc.). */
export function playNotificationSound() {
  playToneSequence(
    [
      { freq: 880, at: 0, duration: 0.2, type: "square", gain: 0.42 },
      { freq: 1175, at: 0.14, duration: 0.28, type: "square", gain: 0.48 },
    ],
    { volume: 0.62, minGapMs: 700 }
  );
}

/** Hard incoming chat pop. */
export function playIncomingChatSound() {
  playToneSequence(
    [
      { freq: 660, at: 0, duration: 0.14, type: "square", gain: 0.4 },
      { freq: 990, at: 0.09, duration: 0.22, type: "square", gain: 0.5 },
    ],
    { volume: 0.68, minGapMs: 280 }
  );
}

/** Clear outgoing send tick. */
export function playOutgoingChatSound() {
  playToneSequence(
    [{ freq: 1400, at: 0, duration: 0.1, type: "triangle", gain: 0.45 }],
    { volume: 0.5, minGapMs: 120 }
  );
}

/**
 * Keep listening for gestures until AudioContext is actually running.
 * `once: true` was too brittle — first tap sometimes failed to resume.
 */
export function bindNotificationSoundUnlock() {
  if (typeof window === "undefined" || unlockBound) return () => {};
  unlockBound = true;

  if (wasUnlockedBefore()) {
    unlocked = true;
  }

  const unlock = () => {
    unlockNotificationSound();
    ensureRunning().then((ctx) => {
      if (ctx?.state === "running") {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("touchstart", unlock);
        document.removeEventListener("visibilitychange", onVisible);
      }
    });
  };

  const onVisible = () => {
    if (document.visibilityState === "visible" && (unlocked || wasUnlockedBefore())) {
      ensureRunning();
    }
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    unlockBound = false;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

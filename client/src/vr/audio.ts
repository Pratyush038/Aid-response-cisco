// Sound and haptics, generated at run time with the Web Audio API.
// No audio files: every sound is synthesised from oscillators and noise.

let ctx: AudioContext | null = null;
let enabled = true;

function audio(): AudioContext | null {
  if (!enabled || typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  // Browsers create the context "suspended" until a user gesture; any click on
  // the page counts, so resuming here (called from event handlers) is enough.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** Call from a click handler so the context is allowed to start. */
export function unlockAudio() {
  audio();
}

/**
 * Collapse: a burst of white noise (crumbling debris) through a low-pass
 * filter that closes over time, plus a low sine "thump" that drops in pitch.
 * `strength` in [0, 1] sets loudness and length.
 */
export function playCollapse(strength = 0.7) {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  const dur = 0.6 + 1.0 * strength;

  const noise = c.createBufferSource();
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;

  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1800, now);
  lp.frequency.exponentialRampToValueAtTime(120, now + dur);

  const ng = c.createGain();
  ng.gain.setValueAtTime(0.0001, now);
  ng.gain.exponentialRampToValueAtTime(0.5 * strength + 0.1, now + 0.03);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(lp).connect(ng).connect(c.destination);
  noise.start(now);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, now);
  og.gain.exponentialRampToValueAtTime(0.6 * strength + 0.1, now + 0.02);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  osc.connect(og).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.7);
}

/** Alert tone for "route lost": three short alternating beeps. */
export function playAlert() {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  [880, 660, 880].forEach((f, i) => {
    const t = now + i * 0.22;
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

/** Short thud for a projectile hit. */
export function playImpact() {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

/** Phone vibration where supported (Android Chrome). Silently ignored elsewhere. */
export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

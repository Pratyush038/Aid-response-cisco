// Earthquake ground-motion model.
//
// A quake is a sum of a few sinusoids (different frequencies per axis) shaped
// by an envelope: ramp up, strong shaking, decay. Real ground motion is
// broadband noise; two or three tones are enough to look and feel like it and
// keep the math explainable.
//
// We define the ground ACCELERATION a(t) directly, because that is what loads
// the buildings. The visual displacement is its double integral, which for a
// sinusoid is just  x(t) = -a(t) / w^2  (w = 2*pi*f).

export const QUAKE_DURATION = 9; // seconds of simulated time

/** Visual shake is multiplied by this. Physical shake amplitudes (millimetres
 *  to centimetres) are too small to see on a 60-unit wide map. Only the drawn
 *  ground moves by this much; the physics uses the true acceleration. */
export const VISUAL_GAIN = 7;

interface Tone {
  /** Peak acceleration of this tone, m/s^2, at intensity 1. */
  amp: number;
  freq: number;
  phase: number;
}

const X_TONES: Tone[] = [
  { amp: 3.2, freq: 2.1, phase: 0 },
  { amp: 1.6, freq: 3.7, phase: 1.3 },
];
const Z_TONES: Tone[] = [
  { amp: 2.6, freq: 2.6, phase: 0.7 },
  { amp: 1.2, freq: 4.1, phase: 0 },
];

/** 0 -> 1 -> 0 envelope: 1.5 s ramp, hold, 3 s decay. */
export function envelope(t: number): number {
  if (t <= 0 || t >= QUAKE_DURATION) return 0;
  if (t < 1.5) return t / 1.5;
  if (t < QUAKE_DURATION - 3) return 1;
  return (QUAKE_DURATION - t) / 3;
}

function accel(tones: Tone[], t: number): number {
  let a = 0;
  for (const k of tones) a += k.amp * Math.sin(2 * Math.PI * k.freq * t + k.phase);
  return a * envelope(t);
}

function disp(tones: Tone[], t: number): number {
  let x = 0;
  for (const k of tones) {
    const w = 2 * Math.PI * k.freq;
    x += (-k.amp / (w * w)) * Math.sin(w * t + k.phase);
  }
  return x * envelope(t);
}

/** Ground acceleration [ax, az] in m/s^2 at quake time t. */
export function groundAccel(t: number, intensity: number): [number, number] {
  return [accel(X_TONES, t) * intensity, accel(Z_TONES, t) * intensity];
}

/** Exaggerated ground displacement [dx, dz] in world units, for drawing. */
export function groundOffset(t: number, intensity: number): [number, number] {
  return [
    disp(X_TONES, t) * intensity * VISUAL_GAIN,
    disp(Z_TONES, t) * intensity * VISUAL_GAIN,
  ];
}

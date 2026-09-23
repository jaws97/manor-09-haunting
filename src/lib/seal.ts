"use client";

/**
 * Phone-side sound for the invitation, synthesised from filtered noise so the
 * gate works before any audio asset exists: the envelope feeding through the
 * letter slot, the wax stamp, paper tearing fibre by fibre, the wax snapping.
 *
 * Phones only let a page start audio after a COMPLETED gesture (tap / touchend),
 * and the audio hardware then takes a few hundred ms to wake. Unlocking at the
 * start of the swipe is too late: the first half of the tear would be silent.
 * So we unlock on the earliest tap we can get (`armSealOnFirstTouch`, and the
 * "Summon my invitation" tap) and play a silent sample to warm the output up.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function unlockSeal() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== "running") void ctx.resume();
    // one silent sample: wakes the audio hardware now instead of on the first tick
    const warm = ctx.createBufferSource();
    warm.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    warm.connect(ctx.destination);
    warm.start();
  } catch {
    ctx = null;
  }
}

/** Unlock on the first completed touch anywhere on the page, then stop listening. */
export function armSealOnFirstTouch() {
  const events = ["pointerup", "touchend", "click", "keydown"] as const;
  const once = () => {
    unlockSeal();
    events.forEach((e) => document.removeEventListener(e, once));
  };
  events.forEach((e) => document.addEventListener(e, once, { passive: true }));
  return () => events.forEach((e) => document.removeEventListener(e, once));
}

function burst(duration: number, gain: number, freq: number, q = 0.7, at = 0) {
  if (!ctx || !noise) return;
  // while suspended the clock is frozen: anything scheduled now would pile up and fire at once later
  if (ctx.state !== "running") return void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.6;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(band).connect(g).connect(ctx.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + duration + 0.02);
}

function thump(freq: number, to: number, duration: number, gain: number, at = 0) {
  if (!ctx) return;
  if (ctx.state !== "running") return void ctx.resume();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime + at;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(to, t + duration);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + duration + 0.02);
}

/* --------------------------------------------------------------- arrival */

/** the envelope dragging through the letter slot, one push at a time */
export const paperStep = () => {
  burst(0.05 + Math.random() * 0.03, 0.3, 1400 + Math.random() * 900, 0.9);
  burst(0.03, 0.15, 300, 0.7);
};
/** the brass flap of the slot clacking shut */
export const slotClack = () => {
  burst(0.05, 0.6, 3200, 2.5);
  thump(900, 300, 0.06, 0.35);
  burst(0.12, 0.25, 1800, 4, 0.02);
};
/** the wax stamp coming down */
export const stamp = () => {
  thump(120, 40, 0.22, 0.9);
  burst(0.08, 0.5, 900);
};

/* ------------------------------------------------------------------ tear */

/** one more fibre giving way */
export const ripTick = () => burst(0.07, 0.5, 2600 + Math.random() * 1800);
/** the strip coming free */
export const ripFinish = () => {
  burst(0.32, 0.8, 1800);
  burst(0.18, 0.5, 4200);
};
/** the wax crazing as the tear reaches it */
export const crackTick = () => {
  burst(0.05, 0.6, 2800 + Math.random() * 2400, 2);
  thump(220, 90, 0.05, 0.25);
};
/** the seal snapping in two */
export const sealSnap = () => {
  burst(0.06, 0.9, 3800, 1.6);
  burst(0.2, 0.7, 1200, 0.9, 0.03);
  thump(180, 50, 0.28, 0.85);
};
/** the letter sliding out */
export const rustle = () => {
  burst(0.18, 0.28, 2200, 0.6);
  burst(0.22, 0.2, 4200, 0.8, 0.08);
};
/** something leaving in a hurry */
export const flutter = () => {
  for (let i = 0; i < 9; i++) burst(0.03, 0.25, 700 + Math.random() * 400, 3, i * 0.05);
};

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

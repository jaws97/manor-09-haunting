"use client";

/**
 * Phone-side sound for the invitation, synthesised from filtered noise so the
 * gate works before any audio asset exists: the quill scratching, the wax
 * stamp, the seal cracking under a thumb and finally giving way.
 *
 * Phones only let a page start audio after a COMPLETED gesture (tap / touchend),
 * and the audio hardware then takes a few hundred ms to wake. So we unlock on
 * the earliest tap we can get and play a silent sample to warm the output up.
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

/** the quill scratching one stroke */
export const quill = () => burst(0.05 + Math.random() * 0.04, 0.22, 3200 + Math.random() * 2500, 1.2);
/** the wax stamp coming down */
export const stamp = () => {
  thump(120, 40, 0.22, 0.9);
  burst(0.08, 0.5, 900);
};
/** the wax giving a little under the thumb */
export const crackTick = () => {
  burst(0.05, 0.6, 2800 + Math.random() * 2400, 2);
  thump(220, 90, 0.05, 0.25);
};
/** the seal going */
export const sealBreak = () => {
  burst(0.09, 0.9, 3600, 1.4);
  burst(0.22, 0.7, 1400, 0.8, 0.02);
  burst(0.35, 0.4, 500, 0.7, 0.05);
  thump(160, 45, 0.3, 0.8);
};
/** the flap lifting: a paper rustle */
export const rustle = () => {
  burst(0.18, 0.28, 2200, 0.6);
  burst(0.22, 0.2, 4200, 0.8, 0.08);
};
/** a bat leaving in a hurry */
export const flutter = () => {
  for (let i = 0; i < 7; i++) burst(0.03, 0.25, 700 + Math.random() * 400, 3, i * 0.05);
};

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

"use client";

/**
 * Phone-side sound for the invitation, synthesised from filtered noise so the
 * gate works before any audio asset exists: paper tearing fibre by fibre, the
 * wax snapping, the letter sliding out. (The cat that brings the invitation
 * makes its own sound, in its clip.)
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

/* ------------------------------------------------------------ jump scare */

/** a slow breath out, just behind you, in the moment before */
export function breath() {
  if (!ctx || !noise) return;
  if (ctx.state !== "running") return void ctx.resume();
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(1500, t);
  band.frequency.exponentialRampToValueAtTime(450, t + 1.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.13, t + 0.45);
  g.gain.linearRampToValueAtTime(0, t + 1.1);
  src.connect(band).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + 1.2);
}

/** tanh soft clipping: loud without the harsh digital crackle of hard clipping */
function softClip(k: number) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

/**
 * The jump scare: a slam, a sub-bass hit, a cluster of shrieking strings and a
 * scream, all at once, driven into a soft clipper so a phone speaker gives it
 * everything it has. Most of the energy sits between 1 and 4 kHz, where a
 * phone speaker is loudest.
 */
export function scream() {
  if (!ctx || !noise) return;
  if (ctx.state !== "running") return void ctx.resume();
  const c = ctx;
  const t = c.currentTime + 0.005;
  const drive = c.createWaveShaper();
  drive.curve = softClip(2.6);
  drive.oversample = "2x";
  // the clipper's oversampling rings a hair past full scale; this keeps the peak under it
  const out = c.createGain();
  out.gain.value = 0.85;
  drive.connect(out).connect(c.destination);

  const env = (peak: number, attack: number, hold: number, release: number) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(drive);
    return g;
  };
  const end = t + 1.2;

  // the slam
  const slam = c.createBufferSource();
  slam.buffer = noise;
  const slamTone = c.createBiquadFilter();
  slamTone.type = "lowpass";
  slamTone.frequency.value = 4500;
  slam.connect(slamTone).connect(env(1, 0.003, 0.02, 0.3));
  slam.start(t);
  slam.stop(t + 0.4);

  // the floor dropping out
  const sub = c.createOscillator();
  sub.frequency.setValueAtTime(95, t);
  sub.frequency.exponentialRampToValueAtTime(36, t + 0.55);
  sub.connect(env(0.9, 0.005, 0.05, 0.55));
  sub.start(t);
  sub.stop(end);

  // strings shrieking in a cluster, bending upward
  const strings = env(0.3, 0.012, 0.5, 0.4);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2200;
  band.Q.value = 0.7;
  band.connect(strings);
  for (const f of [1180, 1253, 1397, 1660]) {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.1, t + 0.8);
    const vib = c.createOscillator();
    vib.frequency.value = 11 + Math.random() * 4;
    const depth = c.createGain();
    depth.gain.value = 30; // cents
    vib.connect(depth).connect(o.detune);
    o.connect(band);
    for (const x of [o, vib]) {
      x.start(t);
      x.stop(end);
    }
  }

  // the scream itself: a torn voice through an "ah"
  const voice = c.createOscillator();
  voice.type = "sawtooth";
  voice.frequency.setValueAtTime(640, t);
  voice.frequency.linearRampToValueAtTime(990, t + 0.12);
  voice.frequency.exponentialRampToValueAtTime(760, t + 0.95);
  const rasp = c.createGain();
  rasp.gain.value = 0.55;
  const shake = c.createOscillator();
  shake.type = "square";
  shake.frequency.value = 70;
  const shakeDepth = c.createGain();
  shakeDepth.gain.value = 0.45;
  shake.connect(shakeDepth).connect(rasp.gain);
  voice.connect(rasp);
  const screamEnv = env(0.7, 0.015, 0.55, 0.35);
  for (const [f, q, level] of [[850, 6, 1], [1350, 7, 0.8], [2900, 8, 0.5]] as const) {
    const formant = c.createBiquadFilter();
    formant.type = "bandpass";
    formant.frequency.value = f;
    formant.Q.value = q;
    const g = c.createGain();
    g.gain.value = level;
    rasp.connect(formant).connect(g).connect(screamEnv);
  }
  for (const x of [voice, shake]) {
    x.start(t);
    x.stop(end);
  }

  // and a hiss on top
  const hiss = c.createBufferSource();
  hiss.buffer = noise;
  const hissTone = c.createBiquadFilter();
  hissTone.type = "highpass";
  hissTone.frequency.value = 4500;
  hiss.connect(hissTone).connect(env(0.25, 0.01, 0.15, 0.3));
  hiss.start(t);
  hiss.stop(t + 0.6);
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

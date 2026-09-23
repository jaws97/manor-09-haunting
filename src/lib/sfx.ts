"use client";

/**
 * Show sound for /screen, synthesised with WebAudio so the whole run of show
 * has audio before a single asset exists: thunder, wind, creaking doors,
 * knocks, the tolling clock, a cathedral organ, wolves, whispers and bats.
 * Each cue is a function; swapping one for a recorded file later doesn't
 * touch callers. Browsers only allow audio after a user gesture: call `arm()`
 * from a click.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
/** a big stone hall, for anything that should ring: bells, organ, knocks */
let hall: ConvolverNode | null = null;

export const isArmed = () => !!ctx && ctx.state === "running";

export async function arm() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // impulse response: decaying noise, 2.6s — the manor's entrance hall
      const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.6), ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const b = ir.getChannelData(c);
        for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / b.length, 3.2);
      }
      hall = ctx.createConvolver();
      hall.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.4;
      hall.connect(wet).connect(master);
    }
    if (ctx.state !== "running") await ctx.resume();
  } catch {}
  return isArmed();
}

export function setMuted(muted: boolean) {
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
}

/* ------------------------------------------------------------ primitives */

type Env = {
  a?: number;
  d: number;
  peak: number;
  at?: number;
  /** lowpass on this voice */
  lp?: number;
  /** send to the hall */
  ring?: boolean;
};

function envGain({ a = 0.01, d, peak, at = 0, ring }: Env) {
  const g = ctx!.createGain();
  const t = ctx!.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  g.connect(master!);
  if (ring && hall) g.connect(hall);
  return g;
}

function tone(freq: number, type: OscillatorType, env: Env, glideTo?: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const t = ctx.currentTime + (env.at ?? 0);
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + (env.a ?? 0.01) + env.d);
  let out: AudioNode = o;
  if (env.lp) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = env.lp;
    o.connect(f);
    out = f;
  }
  out.connect(envGain(env));
  o.start(t);
  o.stop(t + (env.a ?? 0.01) + env.d + 0.05);
}

function noise(filter: BiquadFilterType, freq: number, q: number, env: Env, sweepTo?: number) {
  if (!ctx || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  const t = ctx.currentTime + (env.at ?? 0);
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + (env.a ?? 0.01) + env.d);
  src.connect(f).connect(envGain(env));
  src.start(t, Math.random());
  src.stop(t + (env.a ?? 0.01) + env.d + 0.05);
}

/* ------------------------------------------------------------------ cues */

/** the clock's escapement */
export function tick() {
  noise("bandpass", 2600, 3, { a: 0.002, d: 0.03, peak: 0.28 });
  tone(1500, "square", { a: 0.001, d: 0.015, peak: 0.04 });
}

/** a window lights on the gates screen: a music-box note, one more for a resident */
export function chime(cast: boolean) {
  const notes = cast ? [1046.5, 1568, 2093] : [1046.5, 1318.5];
  notes.forEach((f, i) => {
    tone(f, "sine", { at: i * 0.11, a: 0.004, d: 1.5, peak: 0.13, ring: true });
    tone(f * 2.01, "sine", { at: i * 0.11, a: 0.004, d: 0.6, peak: 0.03 });
  });
}

/** thunder: a crack when it is close, then the roll */
export function thunder(near = false) {
  if (near) {
    noise("highpass", 2500, 0.6, { a: 0.002, d: 0.12, peak: 0.9 });
    noise("bandpass", 700, 0.8, { a: 0.004, d: 0.35, peak: 0.7 });
  }
  const at = near ? 0.1 : 0;
  noise("lowpass", 160, 0.7, { at, a: 0.05, d: 2.4 + Math.random(), peak: near ? 0.9 : 0.45 }, 40);
  tone(38 + Math.random() * 10, "sine", { at, a: 0.08, d: 2.2, peak: near ? 0.5 : 0.25 }, 24);
  noise("lowpass", 90, 0.5, { at: at + 0.9, a: 0.4, d: 2.6, peak: near ? 0.35 : 0.18 });
}

/** a door on a dry hinge */
export function creak(long = false) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  const k = long ? 1.5 : 1;
  o.frequency.setValueAtTime(70, t);
  o.frequency.linearRampToValueAtTime(130, t + 0.5 * k);
  o.frequency.linearRampToValueAtTime(85, t + 0.9 * k);
  o.frequency.linearRampToValueAtTime(150, t + 1.4 * k);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 700;
  f.Q.value = 6;
  o.connect(f).connect(envGain({ a: 0.2, d: 1.3 * k, peak: 0.16, ring: true }));
  o.start(t);
  o.stop(t + 1.7 * k);
}

/** knuckles on an oak door */
export function knock(n = 3) {
  for (let i = 0; i < n; i++) {
    const at = i * 0.38;
    tone(85, "sine", { at, a: 0.002, d: 0.25, peak: 0.9, ring: true }, 45);
    noise("lowpass", 500, 0.7, { at, a: 0.001, d: 0.05, peak: 0.55 });
  }
}

/** the tower bell: inharmonic partials with long decays, into the hall */
export function toll(deep = true) {
  const base = deep ? 130.81 : 261.63;
  const partials: [ratio: number, peak: number, decay: number][] = [
    [1, 0.5, 4.5],
    [2.0, 0.28, 3.2],
    [2.74, 0.2, 2.6],
    [4.07, 0.12, 2.0],
    [5.43, 0.07, 1.4],
  ];
  partials.forEach(([r, p, d]) => tone(base * r, "sine", { a: 0.004, d, peak: p * 0.5, ring: true }));
  noise("bandpass", base * 4, 1.5, { a: 0.001, d: 0.08, peak: 0.35 });
}

/** a minor chord on the cathedral organ; a sting hits, a swell breathes in */
export function organ(sting = true) {
  const chord = [73.42, 110, 146.83, 174.61, 220, 293.66, 349.23]; // D minor
  chord.forEach((f, i) => {
    tone(f, "sawtooth", { at: i * 0.02, a: sting ? 0.03 : 0.9, d: sting ? 2.6 : 5, peak: 0.07, lp: 1100, ring: true });
    tone(f * 2.002, "square", { at: i * 0.02, a: sting ? 0.03 : 0.9, d: sting ? 2.2 : 4.5, peak: 0.018, lp: 1600, ring: true });
  });
  tone(36.71, "sine", { a: 0.05, d: 3, peak: 0.45 });
}

/** a portrait unveiled: organ, a crack of lightning, and a shimmer */
export function sting() {
  organ(true);
  thunder(true);
  noise("highpass", 6000, 0.5, { at: 0.15, a: 0.3, d: 1.4, peak: 0.07 });
  [293.66, 349.23, 440, 587.33, 698.46, 880].forEach((f, i) =>
    tone(f, "triangle", { at: 0.3 + i * 0.07, d: 1.1, peak: 0.07, ring: true }),
  );
}

/** a wolf on the moor */
export function howl() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(280, t);
  o.frequency.exponentialRampToValueAtTime(560, t + 0.9);
  o.frequency.setValueAtTime(560, t + 1.5);
  o.frequency.exponentialRampToValueAtTime(240, t + 2.6);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const depth = ctx.createGain();
  depth.gain.value = 9;
  lfo.connect(depth).connect(o.frequency);
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1400;
  o.connect(f).connect(envGain({ a: 0.5, d: 2.2, peak: 0.14, ring: true }));
  o.start(t);
  lfo.start(t);
  o.stop(t + 2.9);
  lfo.stop(t + 2.9);
}

/** something said just behind you */
export function whisper() {
  for (let i = 0; i < 3; i++)
    noise("bandpass", 1200 + Math.random() * 1600, 2.2, { at: i * 0.13, a: 0.04, d: 0.16 + Math.random() * 0.1, peak: 0.13 });
}

/** a flock leaving the rafters */
export function bats() {
  for (let i = 0; i < 12; i++) {
    noise("bandpass", 700 + Math.random() * 500, 3, { at: i * 0.045 + Math.random() * 0.01, a: 0.003, d: 0.03, peak: 0.22 });
    if (i % 4 === 0) tone(2800 + Math.random() * 900, "sine", { at: i * 0.045, a: 0.003, d: 0.05, peak: 0.05 }, 2200);
  }
}

/** one good shriek */
export function shriek() {
  tone(1200, "sawtooth", { a: 0.03, d: 0.6, peak: 0.08, lp: 3000 }, 2400);
  tone(1207, "sawtooth", { a: 0.03, d: 0.6, peak: 0.06, lp: 3000 }, 2500);
}

/** a dead channel between two pictures */
export function staticBurst(d = 0.35) {
  noise("highpass", 1200, 0.5, { a: 0.005, d, peak: 0.45 });
  noise("bandpass", 60, 2, { a: 0.005, d, peak: 0.3 });
}

/** the planchette landing on a letter */
export function planchette() {
  noise("bandpass", 380, 2.5, { a: 0.004, d: 0.12, peak: 0.35 });
  tone(180, "sine", { a: 0.003, d: 0.14, peak: 0.3 }, 90);
  whisper();
}

/** candles guttering out */
export function gutter() {
  noise("bandpass", 900, 1.2, { a: 0.02, d: 0.5, peak: 0.25 }, 200);
  noise("lowpass", 300, 0.7, { at: 0.1, a: 0.1, d: 0.6, peak: 0.2 });
}

/* ---------------------------------------------------------------- loops */

type Loop = { stop: () => void; level?: (v: number) => void };

/** wind around the eaves: filtered noise that breathes */
export function wind(): Loop {
  if (!ctx || !noiseBuf || !master) return { stop() {} };
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(0.2, ctx.currentTime, 1.2);
  out.connect(master);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 500;
  f.Q.value = 1.4;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.09;
  const depth = ctx.createGain();
  depth.gain.value = 320;
  lfo.connect(depth).connect(f.frequency);
  const lfo2 = ctx.createOscillator();
  lfo2.frequency.value = 0.23;
  const depth2 = ctx.createGain();
  depth2.gain.value = 0.08;
  lfo2.connect(depth2).connect(out.gain);
  src.connect(f).connect(out);
  src.start();
  lfo.start();
  lfo2.start();
  return {
    stop() {
      if (!ctx) return;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
      setTimeout(() => [src, lfo, lfo2].forEach((n) => n.stop()), 2500);
    },
  };
}

/** a heartbeat that quickens as the level rises */
export function heartbeat(): Loop {
  let dead = false;
  let lvl = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const beat = () => {
    if (dead) return;
    tone(55, "sine", { a: 0.004, d: 0.18, peak: 0.85 }, 35);
    tone(55, "sine", { at: 0.17, a: 0.004, d: 0.14, peak: 0.55 }, 35);
    timer = setTimeout(beat, 900 - lvl * 420);
  };
  timer = setTimeout(beat, 200);
  return {
    level(v) {
      lvl = Math.max(0, Math.min(1, v));
    },
    stop() {
      dead = true;
      clearTimeout(timer);
    },
  };
}

/** an uneasy low drone under a scene */
export function drone(): Loop {
  if (!ctx || !master) return { stop() {} };
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(0.06, ctx.currentTime, 1.5);
  out.connect(master);
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 220;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = ctx.createGain();
  depth.gain.value = 120;
  lfo.connect(depth).connect(f.frequency);
  const voices = [55, 55.4, 82.5].map((fr) => {
    const o = ctx!.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = fr;
    o.connect(f);
    o.start();
    return o;
  });
  f.connect(out);
  lfo.start();
  return {
    stop() {
      if (!ctx) return;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
      setTimeout(() => [...voices, lfo].forEach((n) => n.stop()), 3000);
    },
  };
}

/** the house screaming: a wash whose size follows the meter (0..1), with shrieks on top */
export function screams(): Loop {
  if (!ctx || !noiseBuf || !master) return { stop() {}, level() {} };
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(master);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1900;
  band.Q.value = 0.5;
  src.connect(band).connect(out);
  src.start();

  let lvl = 0;
  const timer = setInterval(() => {
    if (Math.random() < lvl * 0.9) {
      const f = 500 + Math.random() * 900;
      tone(f, "sawtooth", { a: 0.04, d: 0.25 + Math.random() * 0.4, peak: 0.05 * lvl + 0.01, lp: 2600 }, f * (1.4 + Math.random()));
    }
  }, 160);

  return {
    level(v) {
      lvl = Math.max(0, Math.min(1, v));
      if (ctx) out.gain.setTargetAtTime(lvl * 0.45, ctx.currentTime, 0.15);
    },
    stop() {
      clearInterval(timer);
      if (!ctx) return;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => src.stop(), 1500);
    },
  };
}

/** the candy break: a slightly-off music box waltz and wrappers crinkling */
export function candyBreak(): Loop {
  let dead = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // E minor waltz, one bar at a time
  const tune = [329.63, 392, 493.88, 392, 329.63, 293.66, 246.94, 293.66, 329.63, 392, 493.88, 587.33];
  let i = 0;
  const step = () => {
    if (dead) return;
    const f = tune[i % tune.length];
    tone(f, "triangle", { a: 0.003, d: 0.55, peak: 0.13, ring: true });
    tone(f * 3.01, "sine", { a: 0.003, d: 0.3, peak: 0.025 });
    if (i % 3 === 0) tone(f / 2, "sine", { a: 0.004, d: 0.4, peak: 0.12 });
    if (Math.random() < 0.3) noise("bandpass", 3200 + Math.random() * 2000, 1.6, { at: 0.12, a: 0.002, d: 0.06, peak: 0.12 });
    i++;
    timer = setTimeout(step, 300);
  };
  timer = setTimeout(step, 150);
  return {
    stop() {
      dead = true;
      clearTimeout(timer);
    },
  };
}

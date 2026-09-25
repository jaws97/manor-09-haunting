"use client";

/**
 * The manor's music, synthesised like everything in ./sfx.ts and played on
 * its music bus, which ducks under the keeper:
 *
 *  - toccata()       the title card: the opening of Bach's Toccata in D minor
 *                    (public domain) on a full organ. TOCCATA.letters says when
 *                    each letter of the title lands, so the card carves them in
 *                    on the notes.
 *  - gatesAmbience() the long wait at the gates: a haunted music box, a crooked
 *                    waltz, a theremin, the Dies Irae on a far-off bell, all over
 *                    wind, with owls, wolves, chains, footsteps upstairs and doors
 *                    in the gaps between them.
 *  - closingLullaby() under the guest book.
 *  - caw(), moan()   voices for the gates scene's crow and ghost, called when
 *                    they move so sound and picture agree.
 *
 * Everything but the Toccata and the Dies Irae (a medieval chant) is written
 * for the manor. All of it stays in D minor or its relative A minor, the keys
 * the arrival chime is written in.
 */
import { engine, noise, tone, wind, type Bus, type Loop } from "./sfx";

type Engine = NonNullable<ReturnType<typeof engine>>;
const noop: Loop = { stop() {} };

const SEMI: Record<string, number> = {
  C: -9, "C#": -8, Db: -8, D: -7, "D#": -6, Eb: -6, E: -5, F: -4,
  "F#": -3, Gb: -3, G: -2, "G#": -1, Ab: -1, A: 0, "A#": 1, Bb: 1, B: 2,
};
/** "C#4" → Hz, A4 = 440 */
export function hz(note: string) {
  const m = /^([A-G][#b]?)(\d)$/.exec(note);
  if (!m) throw new Error(`not a note: ${note}`);
  return 440 * Math.pow(2, (SEMI[m[1]] + (Number(m[2]) - 4) * 12) / 12);
}
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ------------------------------------------------------------- plumbing */

/** A scene's own bus inside the music bus, so everything in it fades as one. */
function scene(e: Engine, level: number, fadeIn = 0) {
  const dry = e.ctx.createGain();
  const wet = e.ctx.createGain();
  dry.connect(e.music.dry);
  if (e.music.wet) wet.connect(e.music.wet);
  const set = (to: number, tc: number) => {
    const t = e.ctx.currentTime;
    for (const g of [dry, wet]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.setTargetAtTime(to, t, tc);
    }
  };
  if (fadeIn > 0) {
    dry.gain.value = wet.gain.value = 0;
    set(level, fadeIn);
  } else dry.gain.value = wet.gain.value = level;
  return {
    bus: { dry, wet } as Bus,
    set,
    close(ms = 4000) {
      setTimeout(() => {
        dry.disconnect();
        wet.disconnect();
      }, ms);
    },
  };
}

/** Route a voice to a bus: optionally panned, and with the dry and hall sends weighted (a far-off sound is mostly hall). */
function send(e: Engine, node: AudioNode, bus: Bus, { pan = 0, dry = 1, wet = 1 } = {}) {
  let tail = node;
  if (pan) {
    const p = e.ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(p);
    tail = p;
  }
  const level = (to: AudioNode, v: number) => {
    if (v === 1) return tail.connect(to);
    const g = e.ctx.createGain();
    g.gain.value = v;
    tail.connect(g).connect(to);
  };
  if (dry > 0) level(bus.dry, dry);
  if (wet > 0 && bus.wet) level(bus.wet, wet);
}

function osc(e: Engine, type: OscillatorType, f: number) {
  const o = e.ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  return o;
}
function filter(e: Engine, type: BiquadFilterType, f: number, q = 0.7) {
  const b = e.ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}
function gain(e: Engine, v: number) {
  const g = e.ctx.createGain();
  g.gain.value = v;
  return g;
}

type Ev = { at: number; play: (t: number) => void };
type Piece = { evs: Ev[]; length: number };

/**
 * Plays timed events on the audio clock, scheduling each a little before it is
 * due, so a busy main thread never smears the rhythm. Returns a canceller.
 */
function sequence(e: Engine, evs: Ev[], t0: number) {
  const list = [...evs].sort((a, b) => a.at - b.at);
  let i = 0;
  const pump = () => {
    const horizon = e.ctx.currentTime + 0.4;
    while (i < list.length && t0 + list[i].at < horizon) {
      list[i].play(Math.max(t0 + list[i].at, e.ctx.currentTime + 0.005));
      i++;
    }
    if (i >= list.length) clearInterval(timer);
  };
  const timer = setInterval(pump, 100);
  pump();
  return () => clearInterval(timer);
}

/* --------------------------------------------------------------- voices */

/**
 * A pipe organ with the reeds out: a trumpet rank and a second one a hair sharp (the chorus of a
 * big instrument), octave and mixture pipes, a 16' bourdon under the low notes, and the chiff of
 * each pipe speaking.
 */
function organ(e: Engine, bus: Bus, f: number, t: number, dur: number, vel: number) {
  const hold = Math.max(0.03, dur);
  const rel = 0.25;
  const env = e.ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vel, t + 0.02);
  env.gain.setValueAtTime(vel, t + hold);
  env.gain.linearRampToValueAtTime(0, t + hold + rel);
  const body = filter(e, "lowpass", Math.min(7500, 900 + f * 7), 0.5);
  body.connect(env);
  send(e, env, bus);
  const ranks: [ratio: number, type: OscillatorType, level: number][] = [
    [1, "sawtooth", 0.28],
    [1.0035, "sawtooth", 0.14],
    [2, "square", 0.07],
    [3, "sine", 0.05],
    [4, "sine", 0.05],
  ];
  if (f < 500) ranks.push([0.5, "sine", 0.3]);
  const end = t + hold + rel + 0.05;
  for (const [r, type, level] of ranks) {
    const o = osc(e, type, f * r);
    o.connect(gain(e, level)).connect(body);
    o.start(t);
    o.stop(end);
  }
  const chiff = e.ctx.createBufferSource();
  chiff.buffer = e.noise;
  const cg = e.ctx.createGain();
  cg.gain.setValueAtTime(0.0001, t);
  cg.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.008);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  chiff.connect(filter(e, "bandpass", Math.min(6000, f * 5), 2)).connect(cg);
  send(e, cg, bus, { wet: 0.5 });
  chiff.start(t, Math.random());
  chiff.stop(t + 0.1);
}

/** One tine of an old music box: a bright strike with the tine's own inharmonic ring, a little out of tune. */
function box(e: Engine, bus: Bus, f: number, t: number, vel: number) {
  const ff = f * Math.pow(2, rand(-4, 4) / 1200);
  const d = Math.max(0.6, 2.3 - f / 1400);
  const partials: [ratio: number, level: number, decay: number][] = [
    [1, 0.16, d],
    [2.756, 0.035, d * 0.35],
    [5.404, 0.012, d * 0.18],
  ];
  for (const [r, level, decay] of partials) {
    const o = osc(e, "sine", ff * r);
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level * vel, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    send(e, g, bus, { wet: 0.8 });
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

/** A plucked string, harpsichord-ish: bright on the pluck, dark a moment later. */
function pluck(e: Engine, bus: Bus, f: number, t: number, vel: number, dur = 0.55) {
  const lp = filter(e, "lowpass", Math.min(9000, f * 9), 1.5);
  lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.3), t + 0.3);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09 * vel, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g);
  send(e, g, bus, { wet: 0.6 });
  const string = osc(e, "sawtooth", f);
  const octave = osc(e, "square", f * 2.003);
  string.connect(lp);
  octave.connect(gain(e, 0.3)).connect(lp);
  for (const o of [string, octave]) {
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** A double bass played pizzicato: the walking floor under the waltz. */
function pizz(e: Engine, bus: Bus, f: number, t: number, vel: number) {
  const o = osc(e, "triangle", f);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2 * vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(filter(e, "lowpass", 700)).connect(g);
  send(e, g, bus, { wet: 0.4 });
  o.start(t);
  o.stop(t + 0.5);
}

/** Voices in the walls, singing "ooh": detuned saws through a vowel, breathing in and out on a chord. */
function choir(e: Engine, bus: Bus, freqs: number[], t: number, dur: number, vel: number) {
  const rel = 1.6;
  const env = e.ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vel, t + Math.min(1.2, dur * 0.45));
  env.gain.setValueAtTime(vel, t + dur);
  env.gain.linearRampToValueAtTime(0, t + dur + rel);
  send(e, env, bus, { wet: 1.2 });
  const vowel: [f: number, q: number, level: number][] = [
    [480, 3, 1],
    [920, 5, 0.55],
    [2700, 7, 0.14],
  ];
  const mouth = gain(e, 1);
  for (const [f, q, level] of vowel) mouth.connect(filter(e, "bandpass", f, q)).connect(gain(e, level)).connect(env);
  const vib = osc(e, "sine", 4.6);
  const depth = gain(e, 11); // cents
  vib.connect(depth);
  const end = t + dur + rel + 0.05;
  for (const f of freqs)
    for (const cents of [-7, 6]) {
      const o = osc(e, "sawtooth", f);
      o.detune.value = cents;
      depth.connect(o.detune);
      o.connect(gain(e, 0.5)).connect(mouth);
      o.start(t);
      o.stop(end);
    }
  vib.start(t);
  vib.stop(end);
}

/** A bell in a far tower: partials close enough to harmonic to carry a tune, far enough off to haunt it. */
function bell(e: Engine, bus: Bus, f: number, t: number, vel: number) {
  const partials: [ratio: number, level: number, decay: number][] = [
    [0.5, 0.05, 5],
    [1, 0.16, 4],
    [2, 0.07, 2.6],
    [3.01, 0.04, 1.6],
    [4.2, 0.025, 1.1],
  ];
  for (const [r, level, decay] of partials) {
    const o = osc(e, "sine", f * r);
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    send(e, g, bus, { dry: 0.7, wet: 1.4 });
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

/** A theremin: one voice sliding between notes, with the wide wobble that makes it sound like a ghost. */
function theremin(e: Engine, bus: Bus, line: [note: string, dur: number][], t: number, vel: number) {
  const main = osc(e, "sine", hz(line[0][0]));
  const body = osc(e, "triangle", hz(line[0][0]));
  const vib = osc(e, "sine", 5.6);
  const depth = gain(e, 24); // cents
  vib.connect(depth);
  depth.connect(main.detune);
  depth.connect(body.detune);
  const amp = e.ctx.createGain();
  amp.gain.setValueAtTime(0, t);
  main.connect(amp);
  body.connect(gain(e, 0.22)).connect(amp);
  const soften = filter(e, "lowpass", 2600);
  amp.connect(soften);
  send(e, soften, bus, { wet: 1.1 });
  let at = t;
  for (const [n, d] of line) {
    const f = hz(n);
    main.frequency.setTargetAtTime(f, at, 0.07);
    body.frequency.setTargetAtTime(f, at, 0.07);
    amp.gain.setTargetAtTime(vel, at, 0.12);
    amp.gain.setTargetAtTime(vel * 0.7, at + d * 0.65, 0.25);
    at += d;
  }
  amp.gain.setTargetAtTime(0, at, 0.4);
  for (const o of [main, body, vib]) {
    o.start(t);
    o.stop(at + 2.5);
  }
  return at - t;
}

/* ------------------------------------------------------- the title card */

type Note = { f: number; at: number; dur: number; vel: number };

/**
 * The opening of the Toccata: the mordent and the falling run, three times, each an octave lower,
 * then the low D in the pedals, the diminished chord built up from the bottom, and the resolution.
 * Times in seconds from the downbeat.
 */
export const TOCCATA = (() => {
  const figure: [note: string, at: number, dur: number][] = [
    ["A", 0, 0.075],
    ["G", 0.08, 0.075],
    ["A", 0.16, 0.62],
    ["G", 0.9, 0.07],
    ["F", 0.975, 0.07],
    ["E", 1.05, 0.07],
    ["D", 1.125, 0.07],
    ["C#", 1.2, 0.16],
    ["D", 1.38, 0.75],
  ];
  const statements = [0, 2.25, 4.5];
  const notes: Note[] = [];
  statements.forEach((start, k) => {
    const top = 5 - k;
    for (const [n, at, dur] of figure)
      for (const octave of [top, top - 1])
        notes.push({ f: hz(`${n}${octave}`), at: start + at, dur, vel: octave === top ? 0.34 : 0.26 });
  });
  notes.push({ f: hz("D2"), at: 6.75, dur: 4.6, vel: 0.34 });
  ["C#3", "E3", "G3", "Bb3", "C#4", "E4", "G4"].forEach((n, i) => {
    const at = 6.95 + i * 0.15;
    notes.push({ f: hz(n), at, dur: 8.6 - at, vel: 0.17 });
  });
  for (const n of ["A2", "D3", "F3", "A3", "D4", "F4", "A4", "D5"]) notes.push({ f: hz(n), at: 8.75, dur: 2.6, vel: 0.17 });
  return {
    notes,
    /** when each letter of the title lands, in ms from the downbeat: on the mordents, the runs and the long Ds */
    letters: [0, 1380, 2250, 3630, 4500, 5400, 5625, 5880],
    /** the resolution: the whole title flares */
    chord: 8750,
  };
})();

export function toccata(): Loop {
  const e = engine();
  if (!e) return noop;
  const s = scene(e, 1);
  const cancel = sequence(
    e,
    TOCCATA.notes.map((n) => ({ at: n.at, play: (t: number) => organ(e, s.bus, n.f, t, n.dur, n.vel) })),
    e.ctx.currentTime + 0.05,
  );
  return {
    stop() {
      cancel();
      s.set(0, 0.3);
      s.close(3000);
    },
  };
}

/* ---------------------------------------------------------------- tunes */

type Bar = [note: string, beats: number][];

/** "The residents' lullaby", 3/4 in D minor, for the music box. */
const LULLABY: Bar[] = [
  [["A4", 1], ["D5", 1], ["F5", 1]],
  [["E5", 2], ["D5", 1]],
  [["Bb4", 1], ["D5", 1], ["G5", 1]],
  [["F5", 1], ["E5", 1], ["C#5", 1]],
  [["D5", 1], ["F5", 1], ["A5", 1]],
  [["Bb5", 2], ["A5", 1]],
  [["G5", 1], ["F5", 1], ["E5", 1]],
  [["E5", 3]],
  [["A4", 1], ["D5", 1], ["F5", 1]],
  [["E5", 1], ["D5", 1], ["C5", 1]],
  [["Bb4", 1], ["D5", 1], ["F5", 1]],
  [["G5", 2], ["Bb4", 1]],
  [["A4", 1], ["F5", 1], ["E5", 1]],
  [["G5", 1], ["E5", 1], ["C#5", 1]],
  [["D5", 3]],
  [],
];
const LULLABY_BASS = ["D3", "D3", "G3", "A3", "D3", "Bb2", "G3", "A3", "D3", "C3", "Bb2", "G3", "A3", "A3", "D3", ""];
const LULLABY_CHORDS = [
  ["D3", "F3", "A3"], ["D3", "F3", "A3"], ["G3", "Bb3", "D4"], ["E3", "A3", "C#4"],
  ["D3", "F3", "A3"], ["F3", "Bb3", "D4"], ["G3", "Bb3", "D4"], ["E3", "A3", "C#4"],
  ["D3", "F3", "A3"], ["C3", "E3", "G3"], ["F3", "Bb3", "D4"], ["G3", "Bb3", "D4"],
  ["D3", "F3", "A3"], ["E3", "G3", "C#4"], ["D3", "F3", "A3"], ["D3", "A3", "D4"],
];

function lullaby(
  e: Engine,
  bus: Bus,
  { beat, up = 1, vel = 1, choirs = true, windDown = false }: { beat: number; up?: number; vel?: number; choirs?: boolean; windDown?: boolean },
): Piece {
  const evs: Ev[] = [];
  let t = 0;
  LULLABY.forEach((bar, i) => {
    // the spring running out: the last bars drag, and the pitch sags with them
    const drag = windDown && i >= 13 ? 1 + (i - 12) * 0.24 : 1;
    const sag = Math.pow(2, (-(drag - 1) * 40) / 1200);
    const b = beat * drag;
    let at = t;
    for (const [n, beats] of bar) {
      const f = hz(n) * up * sag;
      const when = at + rand(-0.01, 0.02); // a worn mechanism never plays quite on the beat
      evs.push({ at: when, play: (tt) => box(e, bus, f, tt, vel) });
      at += beats * b;
    }
    const bass = LULLABY_BASS[i];
    if (bass) evs.push({ at: t, play: (tt) => box(e, bus, hz(bass) * sag, tt, vel * 0.9) });
    if (choirs) {
      const chord = LULLABY_CHORDS[i].map(hz);
      evs.push({ at: t, play: (tt) => choir(e, bus, chord, tt, 3 * b, 0.05 * vel) });
    }
    t += 3 * b;
  });
  return { evs, length: t + 2.5 };
}

/** "The crooked waltz", 3/4 in A minor: a harpsichord on top, a pizzicato bass walking underneath. */
const WALTZ: Bar[] = [
  [["E5", 1], ["A5", 1], ["E5", 1]],
  [["D#5", 1], ["E5", 1], ["C5", 1]],
  [["D5", 1], ["F5", 1], ["D5", 1]],
  [["B4", 1], ["G#4", 1], ["E4", 1]],
  [["A4", 1], ["C5", 1], ["E5", 1]],
  [["F5", 2], ["E5", 1]],
  [["D5", 1], ["B4", 1], ["G#4", 1]],
  [["A4", 3]],
  [["E5", 1], ["A5", 1], ["E5", 1]],
  [["D#5", 1], ["E5", 1], ["C5", 1]],
  [["A5", 1], ["F5", 1], ["C5", 1]],
  [["D5", 1], ["F5", 1], ["A5", 1]],
  [["C6", 1], ["B5", 1], ["A5", 1]],
  [["G#5", 1], ["F5", 1], ["D5", 1]],
  [["E5", 1], ["D5", 1], ["B4", 1]],
  [["A4", 3]],
];
const WALTZ_BASS = ["A2", "A2", "D3", "E2", "A2", "F2", "E2", "A2", "A2", "A2", "F2", "D3", "E2", "E2", "E2", "A2"];
const WALTZ_CHORDS = [
  ["A3", "C4", "E4"], ["A3", "C4", "E4"], ["D3", "F3", "A3"], ["E3", "G#3", "B3"],
  ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["E3", "G#3", "D4"], ["A3", "C4", "E4"],
  ["A3", "C4", "E4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["D3", "F3", "A3"],
  ["A3", "C4", "E4"], ["E3", "G#3", "D4"], ["E3", "G#3", "B3"], ["A3", "C4", "E4"],
];

function waltz(e: Engine, bus: Bus, beat: number): Piece {
  const evs: Ev[] = [];
  let t = 0;
  for (let pass = 0; pass < 2; pass++)
    WALTZ.forEach((bar, i) => {
      let at = t;
      for (const [n, beats] of bar) {
        const f = hz(n);
        // second time round the music box takes the tune an octave up, with the voices behind it
        if (pass === 0) evs.push({ at, play: (tt) => pluck(e, bus, f, tt, 1) });
        else evs.push({ at, play: (tt) => box(e, bus, f * 2, tt, 0.8) });
        at += beats * beat;
      }
      const root = hz(WALTZ_BASS[i]);
      const chord = WALTZ_CHORDS[i].map(hz);
      // oom-pah-pah: the bass on one, the chord plucked on two and three
      evs.push({ at: t, play: (tt) => pizz(e, bus, root, tt, 1) });
      for (const k of [1, 2]) evs.push({ at: t + k * beat, play: (tt) => chord.forEach((f) => pluck(e, bus, f, tt, 0.35, 0.25)) });
      if (pass === 1) evs.push({ at: t, play: (tt) => choir(e, bus, chord, tt, 3 * beat, 0.04) });
      t += 3 * beat;
    });
  return { evs, length: t + 2 };
}

/** "Ghost song", for theremin, over the voices in the walls. */
const GHOST: [note: string, dur: number][] = [
  ["D5", 1.2], ["A5", 1.6], ["G5", 0.6], ["F5", 0.6], ["E5", 1.2], ["F5", 0.6], ["D5", 2.0],
  ["A4", 1.0], ["D5", 1.0], ["F5", 0.8], ["E5", 0.6], ["C#5", 1.2], ["D5", 2.8],
];
const GHOST_CHORDS: [at: number, dur: number, notes: string[]][] = [
  [0, 2.8, ["D3", "F3", "A3"]],
  [2.8, 1.2, ["G3", "Bb3", "D4"]],
  [4.0, 1.2, ["E3", "A3", "C#4"]],
  [5.2, 4.6, ["D3", "F3", "A3"]],
  [9.8, 0.8, ["F3", "Bb3", "D4"]],
  [10.6, 1.8, ["E3", "A3", "C#4"]],
  [12.4, 2.6, ["D3", "A3", "D4"]],
];

function ghostSong(e: Engine, bus: Bus): Piece {
  const evs: Ev[] = [{ at: 0.6, play: (tt) => void theremin(e, bus, GHOST, tt, 0.075) }];
  for (const [at, dur, notes] of GHOST_CHORDS) {
    const chord = notes.map(hz);
    evs.push({ at, play: (tt) => choir(e, bus, chord, tt, dur, 0.045) });
  }
  evs.push({ at: 0, play: (tt) => bell(e, bus, hz("D3"), tt, 0.8) });
  return { evs, length: 17 };
}

/** The Dies Irae, the old chant of the day of wrath, tolled on a far-off bell over a low drone of voices. */
const DIES: [note: string, beats: number][] = [
  ["F4", 1], ["E4", 1], ["F4", 1], ["D4", 1], ["E4", 1], ["C4", 1], ["D4", 1], ["D4", 2],
];

function diesIrae(e: Engine, bus: Bus): Piece {
  const beat = 1.05;
  const evs: Ev[] = [{ at: 0, play: (tt) => choir(e, bus, ["D2", "A2", "D3"].map(hz), tt, 9.5, 0.06) }];
  let at = 0.8;
  for (const [n, beats] of DIES) {
    const f = hz(n);
    evs.push({ at, play: (tt) => bell(e, bus, f, tt, 1) });
    at += beats * beat;
  }
  return { evs, length: at + 4 };
}

/* ------------------------------------------------ things that go bump */

/** a great horned owl somewhere in the grounds: hoo, h'hoo, hoo, hooo */
function owl(e: Engine, bus: Bus, pan: number) {
  const base = rand(330, 390);
  const t0 = e.ctx.currentTime + 0.05;
  for (const [at, d] of [[0, 0.3], [0.55, 0.16], [0.78, 0.3], [1.3, 0.42]]) {
    const t = t0 + at;
    const o = osc(e, "sine", base * 1.04);
    o.frequency.setValueAtTime(base * 1.04, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.93, t + d);
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.075, t + 0.05);
    g.gain.setValueAtTime(0.075, t + d * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
    o.connect(filter(e, "lowpass", 1100)).connect(g);
    send(e, g, bus, { pan, dry: 0.6, wet: 1.2 });
    o.start(t);
    o.stop(t + d + 0.2);
  }
}

/** a crow on the roof: two or three raw, rasping caws. Exported so the crow's beak can open with it. */
export function caw(pan = 0.4, n = 3) {
  const e = engine();
  if (!e) return;
  const t0 = e.ctx.currentTime + 0.03;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * rand(0.38, 0.5);
    const f0 = rand(560, 680);
    const voice = osc(e, "sawtooth", f0);
    voice.frequency.setValueAtTime(f0, t);
    voice.frequency.linearRampToValueAtTime(f0 * 1.08, t + 0.06);
    voice.frequency.exponentialRampToValueAtTime(f0 * 0.78, t + 0.3);
    // the rasp: the voice's own loudness shaken at 85 Hz
    const rasp = e.ctx.createGain();
    rasp.gain.value = 0.6;
    const shake = osc(e, "square", 85);
    shake.connect(gain(e, 0.4)).connect(rasp.gain);
    voice.connect(rasp);
    const env = e.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.1, t + 0.012);
    env.gain.setValueAtTime(0.1, t + 0.17);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    for (const [f, q, level] of [[1150, 2.2, 1], [2300, 3, 0.55], [3400, 4, 0.2]] as const)
      rasp.connect(filter(e, "bandpass", f, q)).connect(gain(e, level)).connect(env);
    send(e, env, e.music, { pan, wet: 0.6 });
    for (const o of [voice, shake]) {
      o.start(t);
      o.stop(t + 0.35);
    }
  }
}

/** chains shaken somewhere below the floor */
function chains(e: Engine, bus: Bus, pan: number) {
  let at = 0;
  const n = 10 + Math.floor(Math.random() * 7);
  for (let i = 0; i < n; i++) {
    at += rand(0.03, 0.12);
    const v = 0.05 * (1 - (i / n) * 0.6);
    for (const f of [2100, 3350, 4800, 6300])
      tone(f * rand(0.9, 1.12), "sine", { at, a: 0.001, d: rand(0.05, 0.16), peak: v * rand(0.4, 1), out: bus, pan, ring: true });
    noise("highpass", 3500, 0.7, { at, a: 0.001, d: 0.01, peak: v * 1.2, out: bus, pan });
  }
}

/** somebody walking across the floor upstairs; a board complains twice */
function steps(e: Engine, bus: Bus, pan: number) {
  for (let i = 0; i < 5; i++) {
    const at = i * 0.64 + rand(-0.03, 0.03);
    const p = Math.max(-1, Math.min(1, pan + i * 0.08));
    tone(78, "sine", { at, a: 0.004, d: 0.14, peak: 0.22, lp: 400, out: bus, pan: p }, 48);
    noise("lowpass", 300, 0.7, { at, a: 0.002, d: 0.06, peak: 0.12, out: bus, pan: p });
    if (i === 1 || i === 3) tone(210, "sawtooth", { at: at + 0.05, a: 0.05, d: 0.28, peak: 0.025, lp: 900, out: bus, pan: p, ring: true }, 290);
  }
}

/** a wolf, a long way off across the moor */
function howl(e: Engine, bus: Bus, pan: number) {
  const t = e.ctx.currentTime + 0.05;
  const lift = rand(0.9, 1.1);
  const o = osc(e, "triangle", 280 * lift);
  o.frequency.setValueAtTime(280 * lift, t);
  o.frequency.exponentialRampToValueAtTime(540 * lift, t + 0.9);
  o.frequency.setValueAtTime(540 * lift, t + 1.6);
  o.frequency.exponentialRampToValueAtTime(230 * lift, t + 2.8);
  const vib = osc(e, "sine", 5.2);
  vib.connect(gain(e, 8)).connect(o.frequency);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.5);
  g.gain.setValueAtTime(0.09, t + 2.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
  o.connect(filter(e, "lowpass", 900)).connect(g);
  send(e, g, bus, { pan, dry: 0.5, wet: 1.4 });
  for (const x of [o, vib]) {
    x.start(t);
    x.stop(t + 3.1);
  }
}

/** a door opening slowly somewhere down the corridor */
function door(e: Engine, bus: Bus, pan: number) {
  const t = e.ctx.currentTime + 0.05;
  const o = osc(e, "sawtooth", 90);
  o.frequency.setValueAtTime(90, t);
  o.frequency.linearRampToValueAtTime(150, t + 0.6);
  o.frequency.linearRampToValueAtTime(110, t + 1.1);
  o.frequency.linearRampToValueAtTime(170, t + 1.8);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.25);
  g.gain.setValueAtTime(0.07, t + 1.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
  o.connect(filter(e, "bandpass", 750, 6)).connect(g);
  send(e, g, bus, { pan, dry: 0.6, wet: 1.2 });
  o.start(t);
  o.stop(t + 2.1);
}

/**
 * Something drifting past: "oooOOOooo", a breathy voice through an "oo" vowel, gliding up and
 * sagging back, panned across the room the way the ghost crosses the screen.
 */
export function moan(from = -0.7, to = 0.7, dur = 3.4, level = 1) {
  const e = engine();
  if (!e) return;
  const t = e.ctx.currentTime + 0.05;
  const voice = osc(e, "sawtooth", 240);
  const pure = osc(e, "sine", 240);
  for (const o of [voice, pure]) {
    o.frequency.setValueAtTime(240, t);
    o.frequency.linearRampToValueAtTime(380, t + dur * 0.35);
    o.frequency.linearRampToValueAtTime(330, t + dur * 0.6);
    o.frequency.exponentialRampToValueAtTime(215, t + dur);
  }
  const vib = osc(e, "sine", 4.2);
  const depth = gain(e, 20);
  vib.connect(depth);
  depth.connect(voice.detune);
  depth.connect(pure.detune);
  const env = e.ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.085 * level, t + dur * 0.3);
  env.gain.setValueAtTime(0.085 * level, t + dur * 0.7);
  env.gain.linearRampToValueAtTime(0, t + dur);
  voice.connect(filter(e, "bandpass", 330, 5)).connect(env);
  voice.connect(filter(e, "bandpass", 850, 7)).connect(gain(e, 0.5)).connect(env);
  pure.connect(gain(e, 0.5)).connect(env);
  const p = e.ctx.createStereoPanner();
  p.pan.setValueAtTime(from, t);
  p.pan.linearRampToValueAtTime(to, t + dur);
  env.connect(p);
  send(e, p, e.music, { dry: 0.7, wet: 1.2 });
  for (const o of [voice, pure, vib]) {
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

/* ----------------------------------------------------------- the scenes */

type Programme = (e: Engine, bus: Bus, n: number) => Piece;

/** The gates' running order. It goes round for as long as the gates are open. */
const PROGRAMME: Programme[] = [
  (e, bus) => lullaby(e, bus, { beat: 0.68, windDown: true }),
  (e, bus) => waltz(e, bus, 0.42),
  (e, bus) => ghostSong(e, bus),
  (e, bus, n) => lullaby(e, bus, { beat: 0.62, up: 2, vel: 0.75, choirs: n % 2 === 0 }),
  (e, bus) => diesIrae(e, bus),
];

const BUMPS: [weight: number, play: (e: Engine, bus: Bus, pan: number) => void][] = [
  [3, owl],
  [2, howl],
  [1, chains],
  [1, steps],
  [1, door],
];

/**
 * The gates' soundscape: wind throughout; a piece of music; a quiet stretch where
 * the grounds make their own noises; another piece. Owls and wolves and the rest
 * mostly keep to the quiet stretches.
 */
export function gatesAmbience(): Loop {
  const e = engine();
  if (!e) return noop;
  const s = scene(e, 1, 2.5);
  const air = wind({ level: 0.085, out: s.bus.dry });
  let dead = false;
  let playingUntil = 0;
  let cancel: (() => void) | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
  };

  let n = 0;
  const next = () => {
    const piece = PROGRAMME[n % PROGRAMME.length](e, s.bus, n);
    n++;
    cancel = sequence(e, piece.evs, e.ctx.currentTime + 0.2);
    playingUntil = performance.now() + piece.length * 1000;
    later(next, (piece.length + rand(18, 30)) * 1000);
  };
  later(next, 5000);

  const total = BUMPS.reduce((a, [w]) => a + w, 0);
  const bump = () => {
    const busy = performance.now() < playingUntil;
    if (!busy || Math.random() < 0.3) {
      let r = Math.random() * total;
      const [, play] = BUMPS.find(([w]) => (r -= w) < 0) ?? BUMPS[0];
      play(e, s.bus, rand(-0.75, 0.75));
    }
    later(bump, rand(7, 14) * 1000);
  };
  later(bump, 2500);

  return {
    stop() {
      dead = true;
      timers.forEach(clearTimeout);
      cancel?.();
      air.stop();
      s.set(0, 0.6);
      s.close(4000);
    },
  };
}

/**
 * Happy Birthday (the tune is public domain) on the music box, for the room to sing to once the
 * cake's candles have caught. In F, the relative major of the manor's D minor, with the box an
 * octave above where a room of people sings it; slow enough to sing along to, and the spring runs
 * down a little over the last line, the way a room slows into the last note. The first two notes
 * are the pickup; the keeper's hold on the name is written in.
 */
const BIRTHDAY: [note: string, beats: number][] = [
  ["C5", 0.75], ["C5", 0.25],
  ["D5", 1], ["C5", 1], ["F5", 1],
  ["E5", 2], ["C5", 0.75], ["C5", 0.25],
  ["D5", 1], ["C5", 1], ["G5", 1],
  ["F5", 2], ["C5", 0.75], ["C5", 0.25],
  ["C6", 1], ["A5", 1], ["F5", 1],
  ["E5", 1], ["D5", 1.6], ["Bb5", 0.75], ["Bb5", 0.25],
  ["A5", 1], ["F5", 1], ["G5", 1],
  ["F5", 3],
];
/** [beat the chord comes in on, bass, the voices in the walls] */
const BIRTHDAY_HARMONY: [at: number, bass: string, chord: string[]][] = [
  [1, "F3", ["F3", "A3", "C4"]],
  [4, "C3", ["E3", "G3", "Bb3"]],
  [7, "C3", ["E3", "G3", "Bb3"]],
  [10, "F3", ["F3", "A3", "C4"]],
  [13, "F3", ["F3", "A3", "C4"]],
  [16, "Bb2", ["D3", "F3", "Bb3"]],
  [19.6, "F3", ["F3", "A3", "C4"]],
  [21.6, "C3", ["E3", "G3", "Bb3"]],
  [22.6, "F3", ["F3", "A3", "C4"]],
];

export function happyBirthday(): Loop {
  const e = engine();
  if (!e) return noop;
  const s = scene(e, 1.5);
  const beat = 0.62;
  // the last line drags as the spring runs down: beats past this one stretch, a little more each
  const dragFrom = 19.6;
  const time = (b: number) => (b <= dragFrom ? b : dragFrom + (b - dragFrom) * (1 + (b - dragFrom) * 0.035)) * beat;
  const evs: Ev[] = [];
  // the box being wound: a few clicks of the ratchet before the first note
  for (let i = 0; i < 5; i++)
    evs.push({ at: i * 0.11, play: (tt) => noise("bandpass", 3200, 4, { at: tt - e.ctx.currentTime, a: 0.001, d: 0.02, peak: 0.12, out: s.bus }) });
  const start = 1;
  let b = 0;
  for (const [n, beats] of BIRTHDAY) {
    const f = hz(n);
    evs.push({ at: start + time(b) + rand(-0.008, 0.012), play: (tt) => box(e, s.bus, f, tt, 1.25) });
    b += beats;
  }
  for (let i = 0; i < BIRTHDAY_HARMONY.length; i++) {
    const [at, bass, chord] = BIRTHDAY_HARMONY[i];
    const until = i + 1 < BIRTHDAY_HARMONY.length ? BIRTHDAY_HARMONY[i + 1][0] : b + 2;
    const freqs = chord.map(hz);
    evs.push({ at: start + time(at), play: (tt) => box(e, s.bus, hz(bass), tt, 0.85) });
    evs.push({ at: start + time(at), play: (tt) => choir(e, s.bus, freqs, tt, time(until) - time(at), 0.045) });
  }
  const cancel = sequence(e, evs, e.ctx.currentTime + 0.1);
  return {
    stop() {
      cancel();
      s.set(0, 0.5);
      s.close(4000);
    },
  };
}

/** After the cake is cut, while the room eats it: the crooked waltz and the manor's other tunes, back to back. */
const PARTY: Programme[] = [
  (e, bus) => waltz(e, bus, 0.42),
  (e, bus) => lullaby(e, bus, { beat: 0.6, up: 2, vel: 0.8 }),
  (e, bus) => waltz(e, bus, 0.4),
  (e, bus) => ghostSong(e, bus),
];

export function partyMusic(): Loop {
  const e = engine();
  if (!e) return noop;
  const s = scene(e, 1, 2);
  let dead = false;
  let cancel: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let n = 0;
  const next = () => {
    if (dead) return;
    const piece = PARTY[n % PARTY.length](e, s.bus, n);
    n++;
    cancel = sequence(e, piece.evs, e.ctx.currentTime + 0.2);
    timer = setTimeout(next, (piece.length + rand(2, 4)) * 1000);
  };
  next();
  return {
    stop() {
      dead = true;
      clearTimeout(timer);
      cancel?.();
      s.set(0, 0.6);
      s.close(4000);
    },
  };
}

/** Under the guest book: the residents' lullaby twice, the second time higher and running down at the end. */
export function closingLullaby(): Loop {
  const e = engine();
  if (!e) return noop;
  const s = scene(e, 0.9, 1.5);
  const first = lullaby(e, s.bus, { beat: 0.8 });
  const second = lullaby(e, s.bus, { beat: 0.8, up: 2, vel: 0.8, windDown: true });
  const cancel = sequence(
    e,
    [...first.evs, ...second.evs.map((ev) => ({ ...ev, at: ev.at + first.length - 2.5 }))],
    e.ctx.currentTime + 0.3,
  );
  return {
    stop() {
      cancel();
      s.set(0, 0.8);
      s.close(5000);
    },
  };
}

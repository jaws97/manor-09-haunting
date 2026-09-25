"use client";

import { useEffect, useRef, useState } from "react";
import * as sfx from "@/lib/sfx";
import { reduced } from "./hooks";

/**
 * Fog: a handful of big soft blobs drifting across the bottom of the stage,
 * drawn at quarter resolution and stretched. It is all soft light, and the
 * projector laptop's integrated GPU has better things to do.
 */
export function Fog({ density = 1, tint = "170,160,210" }: { density?: number; tint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const W = (cv.width = 480);
    const H = (cv.height = 270);
    const blobs = Array.from({ length: Math.round(16 * density) }, () => ({
      x: Math.random() * W,
      y: H * 0.5 + Math.random() * H * 0.6,
      r: 60 + Math.random() * 130,
      vx: 0.06 + Math.random() * 0.14,
      a: 0.05 + Math.random() * 0.07,
      ph: Math.random() * Math.PI * 2,
    }));
    let raf = 0;
    const still = reduced();
    const draw = (t: number) => {
      g.clearRect(0, 0, W, H);
      for (const b of blobs) {
        if (!still) {
          b.x += b.vx;
          if (b.x - b.r > W) b.x = -b.r;
        }
        const y = b.y + Math.sin(t / 3000 + b.ph) * 6;
        const grd = g.createRadialGradient(b.x, y, 0, b.x, y, b.r);
        grd.addColorStop(0, `rgba(${tint},${b.a})`);
        grd.addColorStop(1, `rgba(${tint},0)`);
        g.fillStyle = grd;
        g.beginPath();
        g.arc(b.x, y, b.r, 0, Math.PI * 2);
        g.fill();
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [density, tint]);
  return <canvas className="fogfx" ref={ref} aria-hidden="true" />;
}

/* -------------------------------------------------------------- lightning */

type Listener = (near: boolean) => void;
const listeners = new Set<Listener>();

/** Anything on the stage can call for a strike; every mounted <Lightning> answers. */
export const lightning = {
  strike(near = false) {
    listeners.forEach((l) => l(near));
  },
};

/** A flash over the whole stage. `every` seconds (roughly) it strikes on its own; 0 = only on demand. */
export function Lightning({ every = 0 }: { every?: number }) {
  const [flash, setFlash] = useState(0);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const on: Listener = (n) => {
      setNear(n);
      setFlash((k) => k + 1);
      // light before sound, unless it is right overhead
      setTimeout(() => sfx.thunder(n), n ? 80 : 400 + Math.random() * 900);
    };
    listeners.add(on);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (every > 0 && !reduced()) {
      const schedule = () => {
        timer = setTimeout(
          () => {
            // through the broadcast, so anything else on stage (a bolt in the sky) sees it too
            lightning.strike(Math.random() < 0.25);
            schedule();
          },
          (every * 0.6 + Math.random() * every * 0.8) * 1000,
        );
      };
      schedule();
    }
    return () => {
      listeners.delete(on);
      clearTimeout(timer);
    };
  }, [every]);
  if (!flash) return null;
  return <div key={flash} className={`flash${near ? " near" : ""}`} aria-hidden="true" />;
}

/** a jagged channel from the top of the sky down, with two forks off it (in a 200×600 box) */
function boltPath() {
  const pts: [number, number][] = [[100, 0]];
  let x = 100;
  for (let y = 26; y < 600; y += 20 + Math.random() * 26) {
    x = Math.max(20, Math.min(180, x + (Math.random() - 0.5) * 46));
    pts.push([x, y]);
  }
  let d = "M" + pts.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(" L");
  for (let k = 0; k < 2; k++) {
    let [fx, fy] = pts[3 + Math.floor(Math.random() * (pts.length - 6))];
    const dir = Math.random() < 0.5 ? -1 : 1;
    d += ` M${fx.toFixed(1)} ${fy.toFixed(1)}`;
    for (let i = 0; i < 5; i++) {
      fx += dir * (8 + Math.random() * 16);
      fy += 16 + Math.random() * 20;
      d += ` L${fx.toFixed(1)} ${fy.toFixed(1)}`;
    }
  }
  return d;
}

/**
 * The bolt itself, seen in the sky whenever lightning strikes. Mount it behind whatever should stand
 * black against it. `left`..`right` is the band of the stage (in %) it may strike in, `depth` how far
 * down (in %) it reaches.
 */
export function Bolts({ left = 0, right = 100, depth = 45 }: { left?: number; right?: number; depth?: number }) {
  const [bolt, setBolt] = useState<{ k: number; d: string; x: number } | null>(null);
  useEffect(() => {
    if (reduced()) return;
    let k = 0;
    let clear: ReturnType<typeof setTimeout> | undefined;
    const on: Listener = () => {
      setBolt({ k: ++k, d: boltPath(), x: left + Math.random() * (right - left) });
      clearTimeout(clear);
      clear = setTimeout(() => setBolt(null), 900);
    };
    listeners.add(on);
    return () => {
      listeners.delete(on);
      clearTimeout(clear);
    };
  }, [left, right]);
  if (!bolt) return null;
  return (
    <svg
      key={bolt.k}
      className="bolt"
      style={{ left: `${bolt.x}%`, height: `${depth}%` }}
      viewBox="0 0 200 600"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={bolt.d} />
    </svg>
  );
}

/* ------------------------------------------------------------------- bats */

type BatSpec = { id: number; top: number; dur: number; delay: number; size: number; rev: boolean };

/** Now and then a small flock crosses the stage. */
export function Bats({ every = 14, max = 5 }: { every?: number; max?: number }) {
  const [flock, setFlock] = useState<BatSpec[]>([]);
  useEffect(() => {
    if (reduced()) return;
    let id = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clears: ReturnType<typeof setTimeout>[] = [];
    const spawn = () => {
      const n = 1 + Math.floor(Math.random() * max);
      const rev = Math.random() < 0.5;
      const batch: BatSpec[] = Array.from({ length: n }, () => ({
        id: ++id,
        top: 4 + Math.random() * 48,
        dur: 5 + Math.random() * 4,
        delay: Math.random() * 1.6,
        size: 34 + Math.random() * 40,
        rev,
      }));
      setFlock((f) => [...f, ...batch]);
      sfx.bats();
      clears.push(setTimeout(() => setFlock((f) => f.filter((b) => !batch.includes(b))), 12000));
      timer = setTimeout(spawn, (every * 0.6 + Math.random() * every * 0.8) * 1000);
    };
    timer = setTimeout(spawn, 1500 + Math.random() * 3000);
    return () => {
      clearTimeout(timer);
      clears.forEach(clearTimeout);
    };
  }, [every, max]);
  return (
    <div className="bats" aria-hidden="true">
      {flock.map((b) => (
        <div
          key={b.id}
          className={`bat-track${b.rev ? " rev" : ""}`}
          style={{ top: `${b.top}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
        >
          <Bat size={b.size} />
        </div>
      ))}
    </div>
  );
}

export function Bat({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`bat ${className}`} style={{ width: size }} viewBox="0 0 100 50" aria-hidden="true">
      <g className="wing l">
        <path d="M50 25 C40 5, 20 0, 2 12 C12 16, 14 22, 10 30 C20 26, 30 28, 36 34 C40 30, 46 28, 50 25Z" />
      </g>
      <g className="wing r">
        <path d="M50 25 C60 5, 80 0, 98 12 C88 16, 86 22, 90 30 C80 26, 70 28, 64 34 C60 30, 54 28, 50 25Z" />
      </g>
      <ellipse cx="50" cy="27" rx="7" ry="10" />
      <path d="M45 18 l-3 -8 l6 4z M55 18 l3 -8 l-6 4z" />
    </svg>
  );
}

/* ------------------------------------------------------------------- moon */

export function Moon({ x = 76, y = 8, size = 220 }: { x?: number; y?: number; size?: number }) {
  return (
    <div className="moon" style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }} aria-hidden="true">
      <i className="crater c1" />
      <i className="crater c2" />
      <i className="crater c3" />
      <i className="cloud k1" />
      <i className="cloud k2" />
    </div>
  );
}

/* ----------------------------------------------------------------- candle */

export function Candle({ h = 120, lit = true }: { h?: number; lit?: boolean }) {
  return (
    <div className={`candle${lit ? " lit" : ""}`} style={{ height: h }} aria-hidden="true">
      <i className="glow" />
      <i className="flame" />
      <i className="wick" />
      <i className="wax" />
      <i className="drip d1" />
      <i className="drip d2" />
    </div>
  );
}

/* ----------------------------------------------------------------- cobweb */

/** A web in one corner: spokes from the corner and a few sagging threads between them. */
export function Cobweb({ corner = "tl", size = 260 }: { corner?: "tl" | "tr" | "bl" | "br"; size?: number }) {
  const spokes = 7;
  const rings = 5;
  const lines: string[] = [];
  for (let i = 0; i <= spokes; i++) {
    const a = (Math.PI / 2) * (i / spokes);
    lines.push(`M0 0 L${(Math.cos(a) * 100).toFixed(1)} ${(Math.sin(a) * 100).toFixed(1)}`);
  }
  const threads: string[] = [];
  for (let r = 1; r <= rings; r++) {
    const rad = (100 / rings) * r;
    let d = "";
    for (let i = 0; i < spokes; i++) {
      const a0 = (Math.PI / 2) * (i / spokes);
      const a1 = (Math.PI / 2) * ((i + 1) / spokes);
      const x0 = Math.cos(a0) * rad, y0 = Math.sin(a0) * rad;
      const x1 = Math.cos(a1) * rad, y1 = Math.sin(a1) * rad;
      // control point pulled toward the corner so each segment sags
      const cx = ((x0 + x1) / 2) * 0.86, cy = ((y0 + y1) / 2) * 0.86;
      d += `${i === 0 ? `M${x0.toFixed(1)} ${y0.toFixed(1)}` : ""} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    threads.push(d);
  }
  return (
    <svg className={`cobweb ${corner}`} style={{ width: size, height: size }} viewBox="0 0 100 100" aria-hidden="true">
      {lines.map((d, i) => (
        <path key={`s${i}`} d={d} />
      ))}
      {threads.map((d, i) => (
        <path key={`t${i}`} d={d} />
      ))}
    </svg>
  );
}

/* ----------------------------------------------------------------- embers */

/** Sparks rising off the candles, for the warmer rooms. */
export function Embers({ count = 40 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g || reduced()) return;
    const W = (cv.width = 480);
    const H = (cv.height = 270);
    const sparks = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: H + Math.random() * H,
      r: 0.5 + Math.random() * 1.3,
      vy: 0.12 + Math.random() * 0.25,
      tw: Math.random() * Math.PI * 2,
    }));
    let raf = 0;
    const draw = (t: number) => {
      g.clearRect(0, 0, W, H);
      for (const s of sparks) {
        s.y -= s.vy;
        s.x += Math.sin(t / 900 + s.tw) * 0.15;
        if (s.y < -4) {
          s.y = H + 4;
          s.x = Math.random() * W;
        }
        const a = 0.25 + 0.45 * Math.abs(Math.sin(t / 400 + s.tw));
        g.fillStyle = `rgba(255,170,70,${a.toFixed(3)})`;
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [count]);
  return <canvas className="embersfx" ref={ref} aria-hidden="true" />;
}

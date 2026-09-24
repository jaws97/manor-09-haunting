"use client";

import { useEffect, useState } from "react";
import { residents } from "@/data/residents";
import { showCues } from "@/data/vo";
import * as sfx from "@/lib/sfx";
import { say } from "@/lib/vo";
import { Candle, Fog, Lightning, lightning } from "./atmosphere";

/*
 * The spirit board, in stage px. Two arcs of letters, a row of numbers,
 * YES and NO in the corners and GOODBYE along the bottom.
 */
const BOARD_W = 1240;
const BOARD_H = 720;
type Spot = { key: string; label: string; x: number; y: number };

function arc(letters: string, r: number): Spot[] {
  const cx = BOARD_W / 2;
  const cy = 700;
  const from = Math.PI * 1.12;
  const to = Math.PI * 1.88;
  return [...letters].map((l, i) => {
    const a = from + ((to - from) * i) / (letters.length - 1);
    return { key: l, label: l, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

const SPOTS: Spot[] = [
  { key: "YES", label: "Yes", x: 150, y: 120 },
  { key: "NO", label: "No", x: BOARD_W - 150, y: 120 },
  ...arc("ABCDEFGHIJKLM", 520),
  ...arc("NOPQRSTUVWXYZ", 410),
  ..."1234567890".split("").map((d, i) => ({ key: d, label: d, x: 290 + i * 74, y: 545 })),
  { key: "GOODBYE", label: "Goodbye", x: BOARD_W / 2, y: 640 },
];
const AT = new Map(SPOTS.map((s) => [s.key, s]));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The séance: the keeper asks for a sign, the planchette spells SEPTEMBER,
 * then the number of residents, then slides to YES as the candles gutter.
 * Waits for the host.
 */
export function Seance() {
  const [at, setAt] = useState<string>("GOODBYE");
  const [lit, setLit] = useState<string | null>(null);
  const [message, setMessage] = useState<string[]>([]);
  const [out, setOut] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let dead = false;
    const beat = sfx.heartbeat();
    const land = async (key: string, word?: boolean) => {
      if (dead) return;
      setAt(key);
      setLit(null);
      await sleep(word ? 1000 : 1100);
      if (dead) return;
      setLit(key);
      sfx.planchette();
    };
    (async () => {
      await sleep(1300);
      if (dead) return;
      setAsked(true);
      say(showCues.seance);
      await sleep(4600);
      for (const l of "SEPTEMBER") {
        await land(l);
        if (dead) return;
        setMessage((m) => [...m, l]);
      }
      await sleep(700);
      setMessage((m) => [...m, " · "]);
      // however many residents there are tonight, so the board can never spell a stale count
      for (const d of String(residents.length)) {
        await land(d);
        if (dead) return;
        setMessage((m) => [...m, d]);
      }
      await sleep(900);
      setMessage((m) => [...m, " · "]);
      await land("YES", true);
      if (dead) return;
      setMessage((m) => [...m, "YES"]);
      lightning.strike(true);
      sfx.gutter();
      beat.level?.(1);
      await sleep(500);
      if (dead) return;
      setOut(true);
      await sleep(1600);
      if (dead) return;
      say(showCues.seanceAfter);
    })();
    return () => {
      dead = true;
      beat.stop();
    };
  }, []);

  const spot = AT.get(at) ?? AT.get("GOODBYE")!;
  return (
    <div className={`seance${out ? " out" : ""}`}>
      <div className="seance-room" />
      <Fog density={1.2} tint="120,100,170" />
      <Lightning />
      <div className="seance-candles l">
        <Candle h={140} lit={!out} />
        <Candle h={110} lit={!out} />
      </div>
      <div className="seance-candles r">
        <Candle h={110} lit={!out} />
        <Candle h={140} lit={!out} />
      </div>
      <h2 className="seance-head">
        The séance
        <span>{asked ? "Spirits of September, give us a sign." : "Hands on the planchette. Nobody push."}</span>
      </h2>
      <div className="board" style={{ width: BOARD_W, height: BOARD_H }}>
        <div className="board-sun" aria-hidden="true">
          ☉
        </div>
        <div className="board-moon" aria-hidden="true">
          ☾
        </div>
        {SPOTS.map((s) => (
          <span
            key={s.key}
            className={`spot${s.key.length > 1 ? " word" : ""}${lit === s.key ? " lit" : ""}`}
            style={{ left: s.x, top: s.y }}
          >
            {s.label}
          </span>
        ))}
        <div className="planchette" style={{ transform: `translate(${spot.x - 80}px, ${spot.y - 108}px)` }}>
          <svg viewBox="0 0 160 190" aria-hidden="true">
            <path d="M80 8 C40 8, 8 40, 8 88 C8 130, 40 160, 80 184 C120 160, 152 130, 152 88 C152 40, 120 8, 80 8Z" />
            <circle className="lens" cx="80" cy="108" r="26" />
            <circle className="foot" cx="34" cy="60" r="7" />
            <circle className="foot" cx="126" cy="60" r="7" />
            <circle className="foot" cx="80" cy="166" r="7" />
          </svg>
        </div>
      </div>
      <p className="seance-message" aria-live="polite">
        {message.length ? message.join("") : "…"}
      </p>
    </div>
  );
}

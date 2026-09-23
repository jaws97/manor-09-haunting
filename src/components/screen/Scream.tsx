"use client";

import { useEffect, useRef, useState } from "react";
import { showCues } from "@/data/vo";
import * as sfx from "@/lib/sfx";
import { say } from "@/lib/vo";
import type { ShowState } from "@/lib/show";
import { Bats, Fog, Lightning, lightning } from "./atmosphere";
import { useCue } from "./hooks";

/**
 * Screams per second that pin the meter. It scales with the house so making
 * the manor tremble needs most of the room screaming, whether 30 came or 130.
 */
const fullHouse = (arrived: number) => Math.max(25, arrived * 1.5);

const LABELS = ["Whimper", "Shriek", "Blood-curdling", "The manor trembles"];

export function Scream({ state }: { state: ShowState }) {
  const total = useRef(state.screams);
  const full = useRef(fullHouse(state.arrived.length));
  useEffect(() => {
    total.current = state.screams;
    full.current = fullHouse(state.arrived.length);
  }, [state.screams, state.arrived.length]);
  const [level, setLevel] = useState(0);
  const [trembling, setTrembling] = useState(false);
  const peaked = useRef(false);
  const crowd = useRef<ReturnType<typeof sfx.screams> | null>(null);
  const beat = useRef<ReturnType<typeof sfx.heartbeat> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      crowd.current = sfx.screams();
      beat.current = sfx.heartbeat();
    }, 40);
    return () => {
      clearTimeout(t);
      crowd.current?.stop();
      beat.current?.stop();
      crowd.current = null;
      beat.current = null;
    };
  }, []);
  useEffect(() => {
    crowd.current?.level?.(level);
    beat.current?.level?.(level);
  }, [level]);
  useCue(() => say(showCues.scream), 700);

  useEffect(() => {
    const samples: [number, number][] = [];
    const t = setInterval(() => {
      const now = performance.now();
      samples.push([now, total.current]);
      while (samples.length > 1 && now - samples[0][0] > 2000) samples.shift();
      const [t0, c0] = samples[0];
      const rate = now > t0 ? ((total.current - c0) / (now - t0)) * 1000 : 0;
      setLevel((prev) => prev + (Math.min(1, rate / full.current) - prev) * 0.35);
    }, 100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (level > 0.92 && !peaked.current) {
      peaked.current = true;
      setTrembling(true);
      say(showCues.tremble);
      sfx.shriek();
      lightning.strike(true);
      setTimeout(() => lightning.strike(true), 700);
      setTimeout(() => setTrembling(false), 2600);
      import("canvas-confetti").then(({ default: confetti }) => {
        const colors = ["#ff7a1a", "#f5c76a", "#8dff6a", "#8a5cd6", "#efe6d0"];
        confetti({ particleCount: 240, spread: 120, startVelocity: 55, origin: { x: 0.5, y: 0.7 }, colors });
        setTimeout(() => confetti({ particleCount: 160, angle: 60, spread: 80, origin: { x: 0, y: 0.8 }, colors }), 250);
        setTimeout(() => confetti({ particleCount: 160, angle: 120, spread: 80, origin: { x: 1, y: 0.8 }, colors }), 400);
      });
    }
    if (level < 0.5) peaked.current = false;
  }, [level]);

  const band = Math.min(3, Math.floor(level * 4));
  return (
    <div className={`scream${trembling ? " tremble" : ""}`}>
      <Fog density={1.2} tint="150,60,80" />
      <Lightning every={11} />
      {trembling && <Bats every={1} max={7} />}
      <h2>
        The scream<span>Scream into your phone, or just tap. The manor is listening.</span>
      </h2>
      <div className="scream-body">
        <div className="fearometer" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
          <div className="fear-tube">
            <div className="fear-fill" style={{ height: `${Math.max(3, level * 100)}%` }} />
            <div className="fear-ticks">
              {Array.from({ length: 11 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
          </div>
          <div className="fear-bulb">
            <i className="pupil" style={{ transform: `scale(${0.6 + level * 0.8})` }} />
          </div>
        </div>
        <div className="fear-labels">
          {LABELS.map((l, i) => (
            <span key={l} className={i === band ? "on" : undefined} style={{ opacity: i <= band ? 1 : 0.35 }}>
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="screams-count">
        <b>{state.screams.toLocaleString("en-IN")}</b> screams from the house
      </div>
    </div>
  );
}

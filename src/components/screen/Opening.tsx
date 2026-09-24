"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { showCues } from "@/data/vo";
import * as sfx from "@/lib/sfx";
import { say } from "@/lib/vo";
import { Bats, Candle, Fog, Lightning, lightning, Moon } from "./atmosphere";
import { useCue } from "./hooks";

/* ------------------------------------------------------------------ storm */

/**
 * House lights down. Wind. A distant roll of thunder, then a strike that shows
 * the manor for the first time. The gates swing open, and the camera pushes
 * in through the front door. Runs on by itself.
 */
export function Storm({ onDone }: { onDone: () => void }) {
  const finish = useEffectEvent(onDone);
  useEffect(() => {
    const wind = sfx.wind();
    const drone = sfx.drone();
    const t = [
      setTimeout(() => sfx.thunder(false), 500),
      setTimeout(() => lightning.strike(true), 1500),
      setTimeout(() => lightning.strike(false), 2900),
      setTimeout(() => sfx.creak(true), 3300),
      setTimeout(() => sfx.howl(), 4100),
      setTimeout(() => finish(), 7000),
    ];
    return () => {
      t.forEach(clearTimeout);
      wind.stop();
      drone.stop();
    };
  }, []);
  return (
    <div className="storm">
      <div className="storm-scene">
        <div className="storm-manor" />
        <Fog density={1.5} tint="150,140,190" />
        <div className="storm-gates" aria-hidden="true">
          <Gate side="l" />
          <Gate side="r" />
        </div>
      </div>
      <Lightning />
      <div className="storm-black" />
    </div>
  );
}

function Gate({ side }: { side: "l" | "r" }) {
  return (
    <svg className={`iron-gate ${side}`} viewBox="0 0 200 400" aria-hidden="true">
      <path d="M0 40 Q100 -30 200 40" fill="none" strokeWidth="10" />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1={16 + i * 28} y1={30 + Math.abs(3 - i) * 8} x2={16 + i * 28} y2="400" strokeWidth="7" />
      ))}
      <line x1="0" y1="110" x2="200" y2="110" strokeWidth="9" />
      <line x1="0" y1="330" x2="200" y2="330" strokeWidth="9" />
      {Array.from({ length: 7 }, (_, i) => (
        <path key={`s${i}`} d={`M${16 + i * 28} ${18 + Math.abs(3 - i) * 8} l-7 14 l7 8 l7 -8z`} />
      ))}
    </svg>
  );
}

/* --------------------------------------------------------------- midnight */

/** The tower clock: the last five strokes before midnight, then the manor wakes. */
export function Midnight({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(5);
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const t = setInterval(sfx.tick, 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    sfx.toll(true);
    if (n === 0) {
      lightning.strike(true);
      sfx.bats();
    }
  }, [n]);
  useEffect(() => {
    if (n === 0) {
      const t = setTimeout(() => finish(), 2200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [n]);

  return (
    <div className="midnight">
      <Lightning />
      <Fog density={0.8} />
      {n === 0 && <Bats every={2} max={6} />}
      <div className="clock" aria-hidden="true">
        <svg viewBox="0 0 200 200">
          <circle className="face" cx="100" cy="100" r="92" />
          <circle className="rim" cx="100" cy="100" r="98" />
          {Array.from({ length: 60 }, (_, i) => (
            <line
              key={i}
              className={i % 5 === 0 ? "hour" : "min"}
              x1="100"
              y1={i % 5 === 0 ? 18 : 22}
              x2="100"
              y2="26"
              transform={`rotate(${i * 6} 100 100)`}
            />
          ))}
          {["XII", "III", "VI", "IX"].map((num, i) => (
            <text
              key={num}
              className="numeral"
              x={[100, 158, 100, 42][i]}
              y={[46, 106, 166, 106][i]}
              textAnchor="middle"
            >
              {num}
            </text>
          ))}
          <line className="hand hour-hand" x1="100" y1="100" x2="100" y2="56" transform="rotate(-2 100 100)" />
          <line className="hand min-hand" x1="100" y1="100" x2="100" y2="34" transform={`rotate(${-6 * n} 100 100)`} />
          <line className="hand sec-hand" x1="100" y1="112" x2="100" y2="28" />
          <circle className="pin" cx="100" cy="100" r="5" />
        </svg>
      </div>
      <div className="midnight-num" key={n}>
        {n > 0 ? n : "Midnight"}
      </div>
      <p className="midnight-sub">{n > 0 ? "The clock strikes" : "The manor wakes"}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ ident */

/** The team's ident film, haunted cut (public/media/ident.mp4, 8s, with sound), on a haunted television. If it can't play, the title card stands in. */
export function Ident({ muted, onDone }: { muted: boolean; onDone: () => void }) {
  const [failed, setFailed] = useState(false);
  const [noise, setNoise] = useState(true);
  const video = useRef<HTMLVideoElement>(null);

  useCue(() => sfx.staticBurst(0.5), 40);
  useEffect(() => {
    const t = setTimeout(() => setNoise(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = muted;
    // autoplay with sound is allowed because the operator armed the room with a click
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => setFailed(true));
    });
  }, [muted]);

  const ended = () => {
    setNoise(true);
    sfx.staticBurst(0.4);
    setTimeout(onDone, 450);
  };

  if (!failed)
    return (
      <div className="ident">
        <video
          ref={video}
          className="ident-video"
          src="/media/ident.mp4"
          poster="/media/ident.webp"
          playsInline
          preload="auto"
          onEnded={ended}
          onError={() => setFailed(true)}
        />
        <div className="ident-caption">present</div>
        {noise && <div className="tv-static" aria-hidden="true" />}
      </div>
    );
  return <IdentCard onDone={onDone} />;
}

function IdentCard({ onDone }: { onDone: () => void }) {
  useCue(() => sfx.organ(false), 200);
  useCue(onDone, 5200);
  return (
    <div className="ident">
      <div className="ident-mark">
        <span>Party People</span>
        <b>present</b>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ title */

export function TitleCard() {
  useCue(() => sfx.organ(true), 300);
  useCue(() => say(showCues.title), 1400);
  return (
    <div className="titlecard">
      <Moon x={72} y={6} size={260} />
      <Fog />
      <Bats every={12} />
      <Lightning every={14} />
      <div className="title-candles l">
        <Candle h={150} />
      </div>
      <div className="title-candles r">
        <Candle h={150} />
      </div>
      <div className="season-card">
        <span>A Manor 09 production</span>
        <b>The Haunting</b>
        <em>Twenty-seven residents. Not one of them at rest.</em>
      </div>
    </div>
  );
}

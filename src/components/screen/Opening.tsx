"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { event } from "@/data/event";
import { showCues } from "@/data/vo";
import { TOCCATA, toccata } from "@/lib/music";
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

/**
 * The tower clock, after the title card: the minute hand creeps the last five minutes to twelve with
 * the ticks, then the strike lands with lightning, bats and three tolls, and the manor wakes. Runs on
 * by itself into the séance. No numbers count down: it is a clock, not a timer.
 */
export function Midnight({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(5);
  const finish = useEffectEvent(onDone);
  const struck = n === 0;

  useEffect(() => {
    const t = setInterval(sfx.tick, 500);
    return () => clearInterval(t);
  }, []);
  // one minute a second until the strike; keyed on n so every minute schedules the next
  useEffect(() => {
    if (n > 0) {
      const t = setTimeout(() => setN((v) => v - 1), 1000);
      return () => clearTimeout(t);
    }
    const t = [
      setTimeout(() => {
        lightning.strike(true);
        sfx.bats();
        sfx.toll(true);
      }, 0),
      setTimeout(() => sfx.toll(true), 750),
      setTimeout(() => sfx.toll(true), 1500),
      setTimeout(() => finish(), 2600),
    ];
    return () => t.forEach(clearTimeout);
  }, [n]);

  return (
    <div className="midnight">
      <Lightning />
      <Fog density={0.8} />
      {struck && <Bats every={2} max={6} />}
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
      {/* kept in the layout while hidden so the clock does not jump when the word lands */}
      <div className="midnight-num" key={struck ? "strike" : "wait"} style={{ visibility: struck ? "visible" : "hidden" }}>
        Midnight
      </div>
      <p className="midnight-sub">{struck ? "The manor wakes" : "The manor holds its breath"}</p>
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

/**
 * The title card, played on the opening of Bach's Toccata in D minor. Each letter
 * of the title arrives on a note: the first half (HULU, in Hulu green) flickers
 * in out of a green mist on the first two statements, the second (WEEN) rises
 * out of the flames on the low third one. The pedal comes in, the chord builds,
 * and on the resolution lightning strikes, a flash runs through the word, the
 * candles catch and bats pour out. Then the keeper reads it, and it waits for
 * the host.
 *
 * `leaving` is the card's exit: the finished title, silent, its letters rising
 * off it like spirits while the next phase comes up underneath (see Screen).
 */
export function TitleCard({ leaving = false }: { leaving?: boolean }) {
  const [head, tail] = event.showHalves;
  const title = [...`${head}${tail}`.toUpperCase()];
  const [carved, setCarved] = useState(leaving ? title.length : 0);
  const [lit, setLit] = useState(leaving);
  const [bats, setBats] = useState(false);

  useEffect(() => {
    if (leaving) return;
    let score: ReturnType<typeof toccata> | null = null;
    const t: ReturnType<typeof setTimeout>[] = [];
    // a beat of silence after the storm, then the first note; the timer also keeps dev StrictMode's
    // double mount from playing it twice
    const downbeat = setTimeout(() => {
      score = toccata();
      // however long the title is, its letters share out the eight notes the Toccata gives them
      const hits = TOCCATA.letters;
      title.forEach((_, i) => {
        const at = hits[Math.round((i * (hits.length - 1)) / Math.max(1, title.length - 1))];
        t.push(setTimeout(() => setCarved((n) => Math.max(n, i + 1)), at + 60));
      });
      t.push(
        setTimeout(() => {
          setLit(true);
          setBats(true);
          lightning.strike(true);
        }, TOCCATA.chord + 60),
      );
      t.push(setTimeout(() => setBats(false), TOCCATA.chord + 3200));
      t.push(setTimeout(() => say(showCues.title), TOCCATA.chord + 1900));
    }, 900);
    return () => {
      clearTimeout(downbeat);
      t.forEach(clearTimeout);
      score?.stop();
    };
    // the title is fixed for the night
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`titlecard${lit ? " lit" : ""}`}>
      <div className="title-sky">
        <Moon x={72} y={6} size={260} />
        <Fog />
        {!leaving && <Bats every={12} />}
        {bats && <Bats every={1} max={7} />}
        {/* no stray thunder over the organ: the sky only starts up once the chord has landed */}
        {!leaving && <Lightning every={lit ? 14 : 0} />}
        <div className="title-candles l">
          <Candle h={150} lit={lit} />
        </div>
        <div className="title-candles r">
          <Candle h={150} lit={lit} />
        </div>
      </div>
      <div className="season-card">
        <span>{event.presents}</span>
        <h1 className="huluween" aria-label={event.show}>
          {title.map((ch, i) => (
            // the letter arrives and hovers; the glyph inside it glows, flickers, ripples and drips
            <b
              key={i}
              className={`${i < head.length ? "hulu" : "ween"}${i < carved ? " on" : ""}${i % 3 === 1 ? " drip" : ""}`}
              style={{ "--i": i, "--n": title.length } as React.CSSProperties}
              aria-hidden="true"
            >
              <i>{ch}</i>
            </b>
          ))}
        </h1>
        <em>{event.titleLine}</em>
      </div>
      {lit && !leaving && (
        <>
          <i className="title-shock hulu" aria-hidden="true" />
          <i className="title-shock ween" aria-hidden="true" />
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { residents } from "@/data/residents";
import { showCues } from "@/data/vo";
import * as sfx from "@/lib/sfx";
import { say, setVoMuted, stopVo } from "@/lib/vo";
import { PHASE_LABEL, useShow } from "@/lib/show";
import { Candy } from "./Candy";
import { Gates } from "./Gates";
import { GuestBook } from "./GuestBook";
import { STAGE_W, STAGE_H, useStageScale } from "./hooks";
import { Ident, Midnight, Storm, TitleCard } from "./Opening";
import { Portrait } from "./Portrait";
import { Reactions } from "./Reactions";
import { Scream } from "./Scream";
import { Seance } from "./Seance";

export function Screen() {
  const { state, dispatch, ready, online } = useShow();
  const scale = useStageScale();
  const [armed, setArmed] = useState(false);

  // There is one projector on one laptop, so opening this page IS the start of the night: always begin
  // at the gates (QR) screen, whatever phase was left behind by a rehearsal. Guests already in and
  // screams are kept. After a mid-show refresh the host jumps back from /host.
  const [opened, setOpened] = useState(false);
  const opening = useRef(false);
  useEffect(() => {
    if (!ready || opening.current) return;
    opening.current = true;
    void dispatch({ type: "goto", phase: "gates" }).finally(() => setOpened(true));
  }, [ready, dispatch]);

  useEffect(() => {
    sfx.setMuted(state.muted);
    setVoMuted(state.muted);
  }, [state.muted, armed]);

  // a phase change cuts the keeper off; the new phase brings its own line
  useEffect(() => stopVo, [state.phase, state.portrait]);

  // announcer lines the host fires by hand
  const cueN = state.cue?.n ?? 0;
  const heard = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (heard.current !== null && cueN > heard.current && state.cue && armed) say(showCues[state.cue.id]);
    heard.current = cueN;
  }, [cueN, ready, armed, state.cue]);

  // Browsers only play audio after a gesture, so the operator wakes the manor once.
  const wake = async () => {
    setArmed(await sfx.arm());
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // Keyboard control on the projector laptop: the host drives from here as much as from /host.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") void dispatch({ type: "next" });
    else if (e.key === "ArrowLeft" || e.key === "PageUp") void dispatch({ type: "prev" });
    else if (e.key === "Home") void dispatch({ type: "goto", phase: "gates" });
    else if (e.key === "c") void dispatch({ type: "candy", on: !state.candy });
    else if (e.key === "f") document.documentElement.requestFullscreen?.();
  });
  useEffect(() => {
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="screen-root">
      <div
        className={`stage on-${state.phase}`}
        style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {ready && opened && (
          <div className="phase" key={state.phase}>
            {state.phase === "gates" && <Gates arrived={state.arrived} photos={state.photos} />}
            {state.phase === "storm" && <Storm onDone={() => void dispatch({ type: "next", ifPhase: "storm" })} />}
            {state.phase === "midnight" && (
              <Midnight onDone={() => void dispatch({ type: "next", ifPhase: "midnight" })} />
            )}
            {state.phase === "ident" && (
              <Ident muted={state.muted} onDone={() => void dispatch({ type: "next", ifPhase: "ident" })} />
            )}
            {state.phase === "title" && <TitleCard />}
            {state.phase === "seance" && <Seance />}
            {state.phase === "gallery" && <Portrait key={state.portrait} r={residents[state.portrait]} />}
            {state.phase === "scream" && <Scream state={state} />}
            {state.phase === "guestbook" && <GuestBook whispers={state.whispers} />}
          </div>
        )}
        {ready && opened && state.candy && <Candy />}
        {ready && opened && !armed && (
          <button type="button" className="wake" onClick={wake}>
            <b>Click to wake the manor</b>
            <span>arms sound + fullscreen · ← → step the show · c candy break · keeper&apos;s remote at /host</span>
          </button>
        )}
        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <div className="phase-chip">
          {state.candy ? "Candy break" : PHASE_LABEL[state.phase]}
          {!online && " · reconnecting…"}
        </div>
        {/* the gates screen is the busiest: two whisper cards there, three elsewhere */}
        {ready && <Reactions whispers={state.whispers} max={state.phase === "gates" ? 2 : 3} />}
      </div>
    </div>
  );
}

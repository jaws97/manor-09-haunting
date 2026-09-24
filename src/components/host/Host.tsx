"use client";

import { pad2, residents } from "@/data/residents";
import { PHASES, PHASE_LABEL, PHASE_NOTE, ROOMS, useShow, type AnnounceCue } from "@/lib/show";

const ANNOUNCE: [AnnounceCue, string][] = [
  ["gates", "“Welcome… present your invitation”"],
  ["rooms", "“Please find your rooms”"],
  ["gallery", "“Tonight's residents…”"],
];

export function Host() {
  const { state, dispatch, ready, online } = useShow();
  if (!ready) return null;

  const r = residents[state.portrait];
  const n = residents.length;

  return (
    <main className="host">
      <header>
        <span>Manor 09 · keeper&apos;s remote{!online && " · offline, retrying…"}</span>
        <b>{PHASE_LABEL[state.phase]}</b>
        {state.phase === "gallery" && (
          <em>
            {pad2(r.no)} / {n} · {r.title}
          </em>
        )}
      </header>

      <div className="transport">
        <button type="button" onClick={() => dispatch({ type: "prev" })}>
          ◀ Back
        </button>
        <button type="button" className="go" onClick={() => dispatch({ type: "next" })}>
          Next ▶
        </button>
      </div>
      {/* the candy snipe sits on top of the current phase; Next / Back end it too */}
      <button
        type="button"
        className={`inter${state.candy ? " on" : ""}`}
        onClick={() => dispatch({ type: "candy", on: !state.candy })}
      >
        🍬 {state.candy ? "End the candy break" : "Candy break"}
      </button>

      <section>
        <h2>Run of show</h2>
        <ol className="phases">
          {PHASES.map((p) => (
            <li key={p}>
              <button
                type="button"
                className={p === state.phase ? "on" : undefined}
                onClick={() => dispatch({ type: "goto", phase: p })}
              >
                {PHASE_LABEL[p]}
                {PHASE_NOTE[p] && <small>{PHASE_NOTE[p]}</small>}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Jump to a portrait</h2>
        <div className="grid">
          {residents.map((x, i) => (
            <button
              type="button"
              key={x.no}
              className={state.phase === "gallery" && i === state.portrait ? "on" : undefined}
              onClick={() => dispatch({ type: "portrait", index: i })}
              title={x.title}
            >
              {pad2(x.no)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>The keeper</h2>
        <div className="row">
          {ANNOUNCE.map(([cue, label]) => (
            <button type="button" key={cue} onClick={() => dispatch({ type: "announce", cue })}>
              {label}
            </button>
          ))}
          <a href="/host/script">Keeper&apos;s script &amp; recording sheet →</a>
          <a href="/host/portraits">Portrait review →</a>
        </div>
      </section>

      <section>
        <h2>House</h2>
        <div className="row">
          <button
            type="button"
            className={state.muted ? "on" : undefined}
            onClick={() => dispatch({ type: "mute", muted: !state.muted })}
          >
            {state.muted ? "Sound is muted — tap to unmute" : "Mute screen sound"}
          </button>
        </div>
      </section>

      <section>
        <h2>Rehearsal</h2>
        <div className="row">
          <button type="button" onClick={() => dispatch({ type: "simulate" })}>
            Simulate an arrival ({state.arrived.length}/{ROOMS})
          </button>
          <button type="button" onClick={() => dispatch({ type: "scream", n: 5 })}>
            +5 screams ({state.screams})
          </button>
          <button
            type="button"
            className="danger"
            onClick={() =>
              confirm("Reset the whole night? Invitations, whispers and photos are wiped.") &&
              dispatch({ type: "reset" })
            }
          >
            Reset show
          </button>
        </div>
      </section>
    </main>
  );
}

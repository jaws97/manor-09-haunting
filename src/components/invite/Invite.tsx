"use client";

import { useEffect, useRef, useState } from "react";
import { post, saveInvite, syncEnter, useInvite, type InviteData } from "@/lib/invite";
import {
  armSealOnFirstTouch,
  buzz,
  crackTick,
  flutter,
  quill,
  rustle,
  sealBreak,
  stamp,
  unlockSeal,
} from "@/lib/seal";
import { floorOf, roomLabel, wingOf } from "@/lib/show-core";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function InvitePage({ cast }: { cast: string[] }) {
  const invite = useInvite();
  // true only for an invitation written on this page load: the quill writes it and the wax comes down.
  // A reloaded invitation is already in the guest's hand, so it just appears.
  const [fresh, setFresh] = useState(false);
  useEffect(() => armSealOnFirstTouch(), []);
  if (invite === undefined) return <main className="invite-page" />;
  return (
    <main className="invite-page">
      <header className="ip-head">
        <b>Manor 09</b>
        <span>You are summoned · 7 October</span>
      </header>
      {invite ? (
        <Invitation invite={invite} fresh={fresh} />
      ) : (
        <Gatehouse cast={cast} onIssued={() => setFresh(true)} />
      )}
    </main>
  );
}

/* -------------------------------------------------------------- gatehouse */

function Gatehouse({ cast, onIssued }: { cast: string[]; onIssued: () => void }) {
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const ok = name.trim().length >= 2 && state !== "busy";

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    unlockSeal(); // this tap is the gesture that lets the quill and the wax make a sound
    setState("busy");
    try {
      const res = await post("/api/invite", { name });
      if (!res.ok) throw new Error(String(res.status));
      const issued = (await res.json()) as InviteData;
      onIssued();
      saveInvite(issued);
    } catch {
      setState("failed");
    }
  };

  const typed = name.trim().replace(/\s+/g, " ");
  const isCast = cast.some((c) => c.toLowerCase() === typed.toLowerCase());

  return (
    <div className="gh">
      {/* the gatehouse: generated art, no text in it, fading into the page */}
      <div className="gh-hero" role="img" aria-label="The gatehouse of Manor 09 at night" />

      {/* the invitation fills itself in as the guest types */}
      <div className={`gh-preview${isCast ? " cast" : ""}${typed ? " live" : ""}`} aria-hidden="true">
        <div>
          <small>The manor admits</small>
          <b className="script">{typed || "your name"}</b>
          <em>{isCast ? "☾ A resident of the manor" : "One night · 7 October"}</em>
        </div>
        <div className="gh-preview-room">
          <small>Room</small>
          <b>?</b>
        </div>
      </div>

      <form className="gatehouse" onSubmit={issue}>
        <p>Name on the invitation, please.</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          list="cast"
          placeholder="Your full name"
          autoComplete="name"
          enterKeyHint="go"
          maxLength={48}
        />
        <datalist id="cast">
          {cast.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button type="submit" disabled={!ok}>
          {state === "busy" ? "Writing…" : "Write my invitation"}
        </button>
        {state === "failed" && <p role="alert">The gatekeeper dropped the quill. Try once more.</p>}
      </form>

      <ol className="gh-steps">
        <li>
          <b>Your invitation is written</b>
          <span>A room is chosen for you. The manor does not take requests.</span>
        </li>
        <li>
          <b>Show it at the gate</b>
          <span>The gatekeeper presses the wax seal until it cracks. Sound on, it&apos;s satisfying.</span>
        </li>
        <li>
          <b>You&apos;re in</b>
          <span>Look up. Your window lights up in the manor on the big screen.</span>
        </li>
      </ol>
      <p className="gh-foot">One invitation per guest. No seal, no candy.</p>
    </div>
  );
}

/* ------------------------------------------------------------- invitation */

type Stage = "writing" | "sealing" | "sealed" | "broken";
/** how long a thumb has to stay on the wax */
const HOLD_MS = 1300;
const CRACKS = 8;

/**
 * The invitation as a sealed envelope. Fresh ones are written in front of the
 * guest (the quill scratches, the wax drops). At the gate, the gatekeeper
 * presses and holds the seal: it cracks a little more the longer it is held,
 * heals if it is let go early, and finally shatters — the flap lifts, the
 * letter with the room slides out, and a bat leaves in a hurry.
 */
function Invitation({ invite, fresh }: { invite: InviteData; fresh: boolean }) {
  const entered = invite.enteredAt != null;
  // with reduced motion there is no writing or wax-drop sequence: the sealed envelope just appears
  const [stage, setStage] = useState<Stage>(() =>
    entered
      ? "broken"
      : fresh && !matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "writing"
        : "sealed",
  );
  const [cracks, setCracks] = useState(0);
  const [hint, setHint] = useState(true);
  const holding = useRef(false);
  const raf = useRef(0);
  const p = useRef(0);
  const lastCrack = useRef(0);
  const sealRef = useRef<HTMLButtonElement>(null);

  // the quill writes the name, then the wax comes down; each stage schedules the next
  useEffect(() => {
    if (stage === "writing") {
      const scratches = setInterval(quill, 95);
      const t1 = setTimeout(() => clearInterval(scratches), 1500);
      const t2 = setTimeout(() => setStage("sealing"), 1700);
      return () => {
        clearInterval(scratches);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    if (stage === "sealing") {
      const t1 = setTimeout(() => {
        stamp();
        buzz([30, 20, 40]);
      }, 520);
      const t2 = setTimeout(() => setStage("sealed"), 1000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [stage]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const setProgress = (v: number) => {
    p.current = v;
    sealRef.current?.style.setProperty("--p", v.toFixed(3));
    const c = Math.min(CRACKS, Math.floor(v * (CRACKS + 1)));
    if (c !== lastCrack.current) {
      if (c > lastCrack.current) {
        crackTick();
        buzz(8);
      }
      lastCrack.current = c;
      setCracks(c);
    }
  };

  const complete = () => {
    holding.current = false;
    cancelAnimationFrame(raf.current);
    setProgress(1);
    setStage("broken");
    sealBreak();
    buzz([40, 30, 80]);
    setTimeout(rustle, 350);
    setTimeout(flutter, 900);
    saveInvite({ ...invite, enteredAt: Date.now() });
    void syncEnter();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      import("canvas-confetti").then(({ default: confetti }) =>
        confetti({
          particleCount: 90,
          spread: 80,
          startVelocity: 38,
          origin: { x: 0.5, y: 0.5 },
          colors: ["#ff7a1a", "#f5c76a", "#8a5cd6", "#efe6d0"],
        }),
      );
    }
  };

  /** the thumb on the wax: progress climbs while held, and the seal heals if it is let go */
  const run = (dir: 1 | -1) => {
    cancelAnimationFrame(raf.current);
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      const next = Math.max(0, Math.min(1, p.current + (dir * dt) / (dir > 0 ? HOLD_MS : 450)));
      setProgress(next);
      if (next >= 1) return complete();
      if (next <= 0 && dir < 0) return;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (stage !== "sealed") return;
    unlockSeal();
    holding.current = true;
    setHint(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    run(1);
  };
  const onUp = () => {
    if (!holding.current) return;
    holding.current = false;
    if (p.current < 1) run(-1);
  };
  // Keyboard and switch users: Enter or Space breaks it without the hold.
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === "Enter" || e.key === " ") && stage === "sealed") {
      e.preventDefault();
      unlockSeal();
      setHint(false);
      run(1);
    }
  };

  const first = invite.name.split(" ")[0];
  const where = invite.cast
    ? `The Gallery · Portrait ${pad2(invite.room)}`
    : `${wingOf(invite.room)} · Floor ${floorOf(invite.room)}`;

  return (
    <div className={`inv stage-${stage}${invite.cast ? " cast" : ""}`}>
      <div className="env">
        <div className="env-back" />
        <div className="env-letter">
          <small>Manor 09 · admits one</small>
          <b className="script">{invite.name}</b>
          <div className="env-room">
            <small>Your room</small>
            <b>{invite.cast ? `Portrait ${pad2(invite.room)}` : roomLabel(invite.room)}</b>
            <span>{where}</span>
          </div>
          <div className="env-stamp" aria-live="polite">
            The manor expects you
          </div>
        </div>
        <div className="env-front">
          <span className="env-to">By candlelight, to</span>
          <b className="env-name script">{invite.name}</b>
          <span className="env-line">{invite.cast ? "☾ Resident of the manor" : "Manor 09 · 7 October · one night"}</span>
        </div>
        <div className="env-flap" />
        <button
          ref={sealRef}
          type="button"
          className={`seal${hint && stage === "sealed" ? " nudge" : ""}`}
          aria-label="Press and hold to break the seal"
          disabled={stage !== "sealed"}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onKey}
        >
          <SealArt cracks={cracks} broken={stage === "broken"} />
        </button>
        <svg className="bat bat-out" viewBox="0 0 100 50" aria-hidden="true">
          <g className="wing l">
            <path d="M50 25 C40 5, 20 0, 2 12 C12 16, 14 22, 10 30 C20 26, 30 28, 36 34 C40 30, 46 28, 50 25Z" />
          </g>
          <g className="wing r">
            <path d="M50 25 C60 5, 80 0, 98 12 C88 16, 86 22, 90 30 C80 26, 70 28, 64 34 C60 30, 54 28, 50 25Z" />
          </g>
          <ellipse cx="50" cy="27" rx="7" ry="10" />
        </svg>
      </div>

      {stage === "broken" ? (
        <div className="inv-after">
          <b>Welcome, {first}.</b>
          <span>
            {invite.cast
              ? "Your portrait hangs in the gallery. Look up — your window just lit in the manor."
              : `Find ${roomLabel(invite.room)} in the ${wingOf(invite.room)}. Look up — your window just lit in the manor.`}
          </span>
          <a className="inv-alt" href="/join">
            Enter the parlour →
          </a>
        </div>
      ) : stage === "sealed" ? (
        <div className="inv-after">
          <b className={hint ? "pulse-hint" : undefined}>Gatekeeper: press and hold the seal</b>
          <button type="button" className="inv-alt quiet" onClick={() => saveInvite(null)}>
            Not {first}? Start over
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- the wax */

const BLOB =
  "M60 8 C82 6, 104 22, 110 44 C116 66, 106 92, 84 106 C62 120, 30 112, 16 92 C2 72, 6 40, 24 22 C36 10, 48 8, 60 8Z";
/** cracks radiating from a point just off centre, revealed one by one as the thumb presses */
const CRACK_PATHS = [
  "M58 52 L44 30 L40 22",
  "M58 52 L78 38 L92 34",
  "M58 52 L70 74 L76 94",
  "M58 52 L36 66 L20 72",
  "M44 30 L52 18",
  "M78 38 L86 24",
  "M70 74 L60 90",
  "M36 66 L28 88",
];
/** six wedges of the seal, each flying off its own way */
const SHARDS: [dx: number, dy: number, rot: number][] = [
  [-70, -40, -40],
  [60, -60, 35],
  [80, 30, 20],
  [-60, 60, -30],
  [20, 90, 50],
  [-20, -90, -15],
];
const wedge = (i: number) => {
  const a0 = (Math.PI * 2 * i) / SHARDS.length - 0.3;
  const a1 = (Math.PI * 2 * (i + 1)) / SHARDS.length - 0.3;
  const pt = (a: number) => `${(60 + Math.cos(a) * 80).toFixed(1)} ${(60 + Math.sin(a) * 80).toFixed(1)}`;
  return `M60 60 L${pt(a0)} L${pt((a0 + a1) / 2)} L${pt(a1)}Z`;
};

function SealArt({ cracks, broken }: { cracks: number; broken: boolean }) {
  return (
    <svg className="seal-svg" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="wax" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#d02a31" />
          <stop offset="0.6" stopColor="#8e1116" />
          <stop offset="1" stopColor="#4d080b" />
        </radialGradient>
        {SHARDS.map((_, i) => (
          <clipPath key={i} id={`shard-${i}`}>
            <path d={wedge(i)} />
          </clipPath>
        ))}
      </defs>
      {!broken ? (
        <g className="intact">
          <path className="blob" d={BLOB} fill="url(#wax)" />
          <circle className="ring" cx="60" cy="60" r="34" />
          <text className="mono" x="60" y="71" textAnchor="middle">
            09
          </text>
          <g className="cracks">
            {CRACK_PATHS.map((d, i) => (
              <path key={i} d={d} className={i < cracks ? "on" : undefined} />
            ))}
          </g>
        </g>
      ) : (
        <g className="shards">
          {SHARDS.map(([dx, dy, r], i) => (
            <g
              key={i}
              className="shard"
              style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--r": `${r}deg` } as React.CSSProperties}
            >
              <g clipPath={`url(#shard-${i})`}>
                <path d={BLOB} fill="url(#wax)" />
                <circle className="ring" cx="60" cy="60" r="34" />
              </g>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

"use client";

import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { post, saveInvite, syncEnter, useInvite, type InviteData } from "@/lib/invite";
import {
  armSealOnFirstTouch,
  breath,
  buzz,
  crackTick,
  flutter,
  paperStep,
  ripFinish,
  ripTick,
  rustle,
  scream,
  sealSnap,
  slotClack,
  stamp,
  unlockSeal,
} from "@/lib/seal";
import { floorOf, roomLabel, wingOf } from "@/lib/show-core";

/** distance between tear ticks in CSS px */
const PITCH = 14;
/** the wax sits halfway along the seam; tearing through it is what commits the tear */
const SEAL_AT = 0.5;
const COMMIT_AT = SEAL_AT;
/** the wax starts crazing this far before the tear reaches it */
const CRAZE_FROM = 0.26;
const CRACKS = 8;

/**
 * What was living in the envelope. One is picked per invitation and preloaded while the envelope
 * arrives, so it is decoded and ready the instant it is needed.
 */
const SCARES = ["/media/scare/banshee.webp", "/media/scare/ghoul.webp"];
/** how long the thing stays in your face, in ms; matches the .scare animations in invite.css */
const SCARE_MS = 1020;

const pad2 = (n: number) => String(n).padStart(2, "0");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function InvitePage({ cast }: { cast: string[] }) {
  const invite = useInvite();
  // true only for an invitation summoned on this page load: it comes in through the letter slot.
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
    unlockSeal(); // this tap is the gesture that lets the letter slot make a sound
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
          <small>By candlelight, to</small>
          <b className="script">{typed || "your name"}</b>
          <em>{isCast ? "☾ A resident of the manor" : "Manor 09 · 7 October · one night"}</em>
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
          {state === "busy" ? "Summoning…" : "Summon my invitation"}
        </button>
        {state === "failed" && <p role="alert">Nothing came through the slot. Try once more.</p>}
      </form>

      <ol className="gh-steps">
        <li>
          <b>Your invitation arrives</b>
          <span>It slides in through the letter slot, sealed in wax. A room is chosen for you; the manor does not take requests.</span>
        </li>
        <li>
          <b>Show it at the gate</b>
          <span>The gatekeeper tears it open along the top, straight through the wax. Sound on, it&apos;s satisfying.</span>
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

/* ------------------------------------------------------------- letterbox */

const FEED_STEPS = 14;

/**
 * The envelope coming in through the letter slot: the brass flap opens, the
 * paper is pushed through in nudges (a scrape and a buzz each), it drops with
 * a bounce as the flap clacks shut, and then the wax comes down on it.
 */
function usePostbox(deliver: boolean) {
  const [stage, setStage] = useState<"feed" | "drop" | "wax" | "done">(deliver ? "feed" : "done");
  const feed = useMotionValue(deliver ? 0 : 1);
  const drop = useMotionValue(0);
  const y = useTransform(() => `calc(${((feed.get() - 1) * 100).toFixed(2)}% + ${drop.get().toFixed(1)}px)`);

  // Runs once on mount (motion values are stable). Strict mode runs it twice in dev: the first run is
  // cancelled by its cleanup before it moves anything. Stage changes must NOT re-run it.
  useEffect(() => {
    if (feed.get() === 1) return; // nothing to deliver
    let dead = false;
    (async () => {
      if (reduced()) {
        feed.set(1);
        return setStage("done");
      }
      scrollTo({ top: 0, behavior: "smooth" });
      await wait(450); // the flap creaks open first
      for (let i = 1; i <= FEED_STEPS && !dead; i++) {
        paperStep();
        buzz(6);
        await animate(feed, i / FEED_STEPS, { duration: 0.07, ease: "easeOut" });
        await wait(35 + Math.random() * 55);
      }
      if (dead) return;
      setStage("drop");
      slotClack();
      buzz([12, 20, 12]);
      await Promise.all([animate(drop, 10, { type: "spring", stiffness: 360, damping: 13 }), wait(520)]);
      if (dead) return;
      setStage("wax");
      await wait(520); // the wax is in the air
      if (dead) return;
      stamp();
      buzz([30, 20, 40]);
      await wait(420);
      if (!dead) setStage("done");
    })();
    return () => {
      dead = true;
    };
  }, [feed, drop]);

  return { stage, y };
}

/* ------------------------------------------------------------- invitation */

/**
 * The invitation as a wax-sealed envelope. At the gate, the gatekeeper tears
 * along the top, from the left: every fibre ticks under the thumb, the wax
 * crazes as the tear gets near and snaps in two as it passes, the torn strip
 * flies off, the letter with the room slides out, and something that was
 * living in there leaves in a hurry. Let go before the wax and the paper
 * springs back whole.
 *
 * Then, while the guest is reading their room, the rest of what was living in
 * there comes out, straight at them. Only on a fresh tear: a reloaded, already
 * opened invitation never does it again.
 */
function Invitation({ invite, fresh }: { invite: InviteData; fresh: boolean }) {
  const torn = invite.enteredAt != null;
  const postbox = usePostbox(fresh && !torn);
  const ready = postbox.stage === "done";
  const progress = useMotionValue(torn ? 1 : 0);
  const seamRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastTick = useRef(0);
  const lastCrack = useRef(0);
  const snapped = useRef(torn);
  const ticks = useRef(22);
  const [hint, setHint] = useState(true);
  const [cracks, setCracks] = useState(torn ? CRACKS : 0);
  const [open, setOpen] = useState(torn);
  // "lurking" until the tear, "out" for the second it is in your face, "gone" after (or if it already happened)
  const [scare, setScare] = useState<"lurking" | "out" | "gone">(torn ? "gone" : "lurking");
  const [scared, setScared] = useState(false);
  const [scareArt, setScareArt] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const after = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (torn) return;
    const src = SCARES[Math.floor(Math.random() * SCARES.length)];
    const img = new Image();
    img.src = src;
    // only counted as ready once decoded: a half-loaded jump scare is a grey box
    img.decode().then(
      () => setScareArt(src),
      () => {},
    );
  }, [torn]);

  // Paper stays joined ahead of the tear, so the strip hinges AT the tear point: everything already
  // torn lifts to the left of it, everything still attached stays stuck down to the right.
  const stripRotate = useTransform(progress, [0, 1], [0, -9]);
  const hinge = useTransform(progress, (p) => `${(p * 100).toFixed(1)}% 100%`);
  const handleLeft = useTransform(progress, (p) => `${p * 100}%`);

  // Flying away after the tear completes.
  const flyY = useMotionValue(torn ? -900 : 0);
  const flyRotate = useMotionValue(torn ? -28 : 0);
  const flyOpacity = useMotionValue(torn ? 0 : 1);
  const rotate = useTransform(() => stripRotate.get() + flyRotate.get());

  useMotionValueEvent(progress, "change", (p) => {
    if (!dragging.current) return;
    const tick = Math.floor(p * ticks.current); // one tick and one buzz per fibre
    if (tick > lastTick.current) {
      lastTick.current = tick;
      ripTick();
      buzz(8);
    }
    // the wax crazes as the tear approaches it, then snaps when the tear goes through
    const c = Math.max(0, Math.min(CRACKS, Math.floor(((p - CRAZE_FROM) / (SEAL_AT - CRAZE_FROM)) * (CRACKS + 1))));
    if (c > lastCrack.current) {
      lastCrack.current = c;
      crackTick();
      setCracks(c);
    }
    if (p >= SEAL_AT && !snapped.current) {
      snapped.current = true;
      sealSnap();
      buzz([20, 15, 40]);
    }
  });

  const complete = () => {
    ripFinish();
    buzz([30, 20, 60]);
    animate(flyY, -900, { duration: 0.9, ease: [0.5, 0, 0.9, 0.6] });
    animate(flyRotate, -28, { duration: 0.9, ease: "easeIn" });
    animate(flyOpacity, 0, { duration: 0.35, delay: 0.55 });
    setOpen(true);
    after(300, rustle);
    after(700, flutter);
    saveInvite({ ...invite, enteredAt: Date.now() });
    void syncEnter();
    // a breath behind you, a moment to read the room number, and then it comes out. The moment
    // wanders by most of a second, so the queue watching the last guest can't count it in.
    after(550, breath);
    const at = 1500 + Math.random() * 900;
    after(at, () => {
      setScare("out");
      setScared(true);
      scream();
      buzz([320, 60, 480]);
    });
    after(at + SCARE_MS, () => {
      setScare("gone");
      if (reduced()) return;
      // and the relief: the stamp comes down and the paper goes up
      import("canvas-confetti").then(({ default: confetti }) =>
        confetti({
          particleCount: 110,
          spread: 90,
          startVelocity: 40,
          origin: { x: 0.5, y: 0.45 },
          colors: ["#ff7a1a", "#f5c76a", "#8a5cd6", "#8dff6a", "#efe6d0"],
        }),
      );
    });
  };

  const finishTear = () => animate(progress, 1, { duration: 0.22, ease: "easeOut" }).then(complete);

  const pAt = (clientX: number) => {
    const r = seamRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const onDown = (e: React.PointerEvent) => {
    if (torn || !ready) return;
    unlockSeal();
    // the tear has to start where the paper is still whole, not mid-envelope
    if (pAt(e.clientX) > progress.get() + 0.22) return;
    dragging.current = true;
    ticks.current = Math.max(8, Math.round(seamRef.current!.getBoundingClientRect().width / PITCH));
    setHint(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = pAt(e.clientX);
    if (p > progress.get()) progress.set(p); // paper doesn't un-tear
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (progress.get() >= COMMIT_AT) void finishTear();
    else {
      lastTick.current = 0;
      animate(progress, 0, { type: "spring", stiffness: 420, damping: 30 });
    }
  };

  // No visible button: the seam itself is the control. Keyboard and switch users can still focus it
  // and press Enter, Space or → to tear.
  const tearByKey = () => {
    unlockSeal();
    dragging.current = true; // so the fibres tick
    setHint(false);
    ticks.current = Math.max(8, Math.round((seamRef.current?.getBoundingClientRect().width ?? 300) / PITCH));
    animate(progress, 1, { duration: 0.8, ease: "easeInOut" }).then(() => {
      dragging.current = false;
      complete();
    });
  };

  const first = invite.name.split(" ")[0];
  const where = invite.cast
    ? `The Gallery · Portrait ${pad2(invite.room)}`
    : `${wingOf(invite.room)} · Floor ${floorOf(invite.room)}`;

  return (
    <div
      className={`inv${invite.cast ? " cast" : ""}${open ? " open" : ""}${scare === "gone" ? " settled" : ""}${!ready ? " arriving" : ""} pb-${postbox.stage}`}
    >
      {scare === "out" && createPortal(<JumpScare art={scareArt} />, document.body)}
      {/* the clip lives on this static wrapper: put on the moving paper it would travel with it */}
      <div className="env-feed">
        {postbox.stage !== "done" && (
          <div className={`letterbox ${postbox.stage}`} aria-hidden="true">
            <i className="lb-flap" />
            <span className="lb-slot" />
            <b>Manor 09</b>
          </div>
        )}
        <motion.div className="env-paper" style={{ y: postbox.y }}>
          {/* roughens the torn edges so the paper shows fibres instead of a vector-clean cut */}
          <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
            <filter id="inv-rough" x="-5%" y="-60%" width="110%" height="220%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85 0.3" numOctaves="2" seed="9" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>

          {/* the body: the pocket, with the letter inside it */}
          <div className="env-body">
            <div className="env-letter">
              <small>Manor 09 · admits one</small>
              <div className="env-room">
                <b>{invite.cast ? `Portrait ${pad2(invite.room)}` : roomLabel(invite.room)}</b>
                <span>{where}</span>
              </div>
              <div className="env-stamp" aria-live="polite">
                The manor expects you
              </div>
              <b className="script">{invite.name}</b>
            </div>
            <div className="env-front">
              <span className="env-to">By candlelight, to</span>
              <b className="env-name script">{invite.name}</b>
              <span className="env-line">{invite.cast ? "☾ Resident of the manor" : "Manor 09 · 7 October · one night"}</span>
            </div>
            <div className="postmark" aria-hidden="true">
              <span>Manor 09</span>
              <b>7 Oct</b>
            </div>
            <span className="env-fibre below" aria-hidden="true">
              <i />
            </span>
            {/* the lower half of the wax stays on the body when the strip goes */}
            <div className="seal-half bottom" aria-hidden="true">
              <SealArt cracks={cracks} />
            </div>
            {!torn && ready && (
              <div
                className="env-seam"
                ref={seamRef}
                role="slider"
                tabIndex={0}
                aria-label="Tear the invitation open along the top"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
                    e.preventDefault();
                    tearByKey();
                  }
                }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <motion.i className={`env-handle${hint ? " nudge" : ""}`} style={{ left: handleLeft }} />
              </div>
            )}
          </div>

          {/* the strip: the sealed flap, torn off along the seam */}
          <motion.div
            className="env-strip"
            style={{ rotate, y: flyY, opacity: flyOpacity, transformOrigin: hinge }}
            aria-hidden={torn}
          >
            <div className="strip-paper" />
            <span className="env-fibre above" aria-hidden="true">
              <i />
            </span>
            <div className="seal-half top" aria-hidden="true">
              <SealArt cracks={cracks} />
            </div>
          </motion.div>

          {/* something was living in there */}
          <div className="bats-out" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <BatOut key={i} i={i} />
            ))}
          </div>
        </motion.div>
      </div>

      {!ready ? null : open ? (
        <div className="inv-after">
          <b>Welcome, {first}.</b>
          <span>
            {invite.cast
              ? "Your portrait hangs in the gallery. Look up — your window just lit in the manor."
              : `Find ${roomLabel(invite.room)} in the ${wingOf(invite.room)}. Look up — your window just lit in the manor.`}
          </span>
          {scared && scare === "gone" && <em className="inv-sorry">Sorry about that. It gets everyone.</em>}
          <a className="inv-alt" href="/join">
            Enter the parlour →
          </a>
        </div>
      ) : (
        <div className="inv-after">
          <b className={hint ? "pulse-hint" : undefined}>Gatekeeper: tear along the top →</b>
          <button type="button" className="inv-alt quiet" onClick={() => saveInvite(null)}>
            Not {first}? Start over
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- the wax */

const BLOB =
  "M60 8 C82 6, 104 22, 110 44 C116 66, 106 92, 84 106 C62 120, 30 112, 16 92 C2 72, 6 40, 24 22 C36 10, 48 8, 60 8Z";
/** cracks spreading from the left edge, where the tear arrives, across the wax */
const CRACK_PATHS = [
  "M14 58 L30 54 L38 60",
  "M38 60 L50 50 L56 40",
  "M38 60 L52 66 L60 78",
  "M56 40 L66 44 L80 38",
  "M60 78 L74 82 L88 76",
  "M80 38 L92 46 L104 44",
  "M52 66 L64 60 L78 62",
  "M78 62 L92 64 L106 60",
];

function SealArt({ cracks }: { cracks: number }) {
  return (
    <svg className="seal-svg" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="wax" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#d02a31" />
          <stop offset="0.6" stopColor="#8e1116" />
          <stop offset="1" stopColor="#4d080b" />
        </radialGradient>
      </defs>
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
    </svg>
  );
}

/* ------------------------------------------------------------ jump scare */

/**
 * A second in its face: it lunges out of the dark, the picture tears into red and cyan and shakes,
 * then it is yanked back into the envelope. Split into a red copy and a cyan copy, screened back
 * together over black, so the two can be pulled apart for the glitch. If the art hasn't arrived
 * (dreadful venue Wi-Fi) a face drawn in CSS stands in.
 */
function JumpScare({ art }: { art: string | null }) {
  const style = art ? ({ "--scare": `url(${art})` } as React.CSSProperties) : undefined;
  return (
    <div className={`scare${art ? "" : " bare"}`} style={style} aria-hidden="true">
      <i className="scare-face r" />
      <i className="scare-face c" />
      <i className="scare-tear" />
      <i className="scare-lines" />
      <i className="scare-flash" />
    </div>
  );
}

const BAT_FLIGHTS: [dx: number, dy: number, delay: number, size: number][] = [
  [170, -420, 0.35, 64],
  [-150, -380, 0.5, 52],
  [60, -480, 0.65, 44],
];

function BatOut({ i }: { i: number }) {
  const [dx, dy, delay, size] = BAT_FLIGHTS[i];
  return (
    <svg
      className="bat bat-out"
      style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--d": `${delay}s`, width: size } as React.CSSProperties}
      viewBox="0 0 100 50"
      aria-hidden="true"
    >
      <g className="wing l">
        <path d="M50 25 C40 5, 20 0, 2 12 C12 16, 14 22, 10 30 C20 26, 30 28, 36 34 C40 30, 46 28, 50 25Z" />
      </g>
      <g className="wing r">
        <path d="M50 25 C60 5, 80 0, 98 12 C88 16, 86 22, 90 30 C80 26, 70 28, 64 34 C60 30, 54 28, 50 25Z" />
      </g>
      <ellipse cx="50" cy="27" rx="7" ry="10" />
    </svg>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useInvite } from "@/lib/invite";
import { buzz } from "@/lib/seal";

/**
 * The guest's second screen: the parlour. Deliberately does NOT subscribe to
 * the show: a hundred phones polling would be the heaviest thing in the
 * building. Phones only ever send (plus one invitation check when the page opens).
 */
export function Join() {
  const invite = useInvite();
  const router = useRouter();

  // No invitation (never written, or voided by a show reset): there is nothing to do here, so go
  // straight to the gatehouse instead of stopping on a dead-end screen.
  useEffect(() => {
    if (invite === null) router.replace("/invite");
  }, [invite, router]);

  if (!invite) return <main className="join" />;
  const name = invite.name;
  return (
    <main className="join">
      <header>
        <b>Manor 09</b>
        <span>{name} · in the parlour</span>
      </header>
      <ScreamButton />
      <Whisper name={name} />
      <SpiritPhoto name={name} />
    </main>
  );
}

/* ----------------------------------------------------------------- scream */

/**
 * Screams reach the big screen two ways: a tap, or the microphone. With the
 * mic on, loudness above a speaking voice counts as screams, so the whole
 * room can shout at the manor together. Either way phones batch and post
 * about once a second.
 */
function ScreamButton() {
  const [mine, setMine] = useState(0);
  const pending = useRef(0);
  const [mic, setMic] = useState<"off" | "on" | "denied">("off");
  const [level, setLevel] = useState(0);
  const stopMic = useRef<(() => void) | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const n = pending.current;
      if (!n) return;
      pending.current = 0;
      fetch("/api/scream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n }),
        keepalive: true,
      }).catch(() => {
        pending.current += n; // offline: try again with the next batch
      });
    }, 1000);
    return () => {
      clearInterval(t);
      stopMic.current?.();
    };
  }, []);

  const add = (n: number) => {
    pending.current = Math.min(pending.current + n, 60);
    setMine((m) => m + n);
  };

  const scream = async (ev: React.PointerEvent<HTMLButtonElement>) => {
    add(1);
    buzz(14);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 12,
      spread: 70,
      startVelocity: 28,
      ticks: 70,
      scalar: 0.8,
      colors: ["#ff7a1a", "#f5c76a", "#8dff6a", "#8a5cd6"],
      origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 3) / innerHeight },
    });
  };

  const toggleMic = async () => {
    if (mic === "on") {
      stopMic.current?.();
      stopMic.current = null;
      setMic("off");
      setLevel(0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const timer = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        // a speaking voice sits around 0.05; a proper scream into the phone is 0.3 and up
        const loud = Math.max(0, Math.min(1, (rms - 0.07) / 0.25));
        setLevel(loud);
        const n = Math.round(loud * 3);
        if (n) add(n);
      }, 250);
      stopMic.current = () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
      setMic("on");
    } catch {
      setMic("denied");
    }
  };

  return (
    <section className="j-card scream-card">
      <h2>The scream</h2>
      <button type="button" className="scream-btn" onPointerDown={scream}>
        Scream!
      </button>
      <p>
        {mine
          ? `${mine.toLocaleString("en-IN")} from you. Watch the eye on the big screen.`
          : "Tap like something is behind you. The manor is listening."}
      </p>
      <button type="button" className={`mic${mic === "on" ? " on" : ""}`} onClick={toggleMic}>
        {mic === "on" ? "🎙 Microphone on — scream into the phone" : mic === "denied" ? "🎙 No microphone. Tapping works too." : "🎙 Use my microphone instead"}
      </button>
      {mic === "on" && (
        <div className="mic-level" aria-hidden="true">
          <i style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- whisper */

/** one tap each: these drift up the big screen like spirits leaving */
const QUICK = ["🎃", "👻", "💀", "🦇", "🕷️", "🍬"];

/**
 * Whispers go straight to the big screen: an emoji drifts up like a live
 * reaction, a line of text appears as a whisper card, and the text ones are
 * written into the guest book at the end.
 */
function Whisper({ name }: { name: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed">("idle");
  const cooling = useRef(false);

  const send = async (body: string) => {
    if (!body.trim() || cooling.current) return; // one a second is plenty per phone
    cooling.current = true;
    setTimeout(() => (cooling.current = false), 800);
    setState("busy");
    const res = await fetch("/api/whisper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, text: body }),
    }).catch(() => null);
    if (res?.ok) {
      setState("sent");
      buzz(10);
    } else setState("failed");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text;
    setText("");
    await send(body);
  };

  return (
    <form className="j-card" onSubmit={submit}>
      <h2>Whisper to the manor</h2>
      <div className="j-emoji" role="group" aria-label="Quick reactions">
        {QUICK.map((e) => (
          <button type="button" key={e} disabled={state === "busy"} onClick={() => send(e)} aria-label={`Send ${e}`}>
            {e}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
        }}
        maxLength={80}
        rows={2}
        placeholder="Whisper something to tonight's residents…"
      />
      <div className="j-row">
        <small>{80 - Array.from(text).length} left</small>
        <button type="submit" className="j-btn" disabled={!text.trim() || state === "busy"}>
          {state === "busy" ? "Sending…" : "Whisper"}
        </button>
      </div>
      {state === "sent" && <p className="ok">The manor heard you. Look at the big screen.</p>}
      {state === "failed" && <p className="bad">Lost in the corridors. Try again?</p>}
    </form>
  );
}

/* ----------------------------------------------------------- spirit photo */

/**
 * Develop the snap as a Victorian spirit photograph on the phone: sepia,
 * a vignette and a faint second exposure, then shrink it for the venue's
 * uplink. The wall only needs ~1280px.
 */
async function develop(file: File): Promise<Blob> {
  const img = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const g = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;
  g.filter = "grayscale(0.85) sepia(0.65) contrast(1.12) brightness(0.96)";
  g.drawImage(img, 0, 0, W, H);
  // the spirit: the same picture again, faint, soft and slightly off
  g.globalAlpha = 0.2;
  g.filter = "grayscale(1) blur(6px) brightness(1.4)";
  g.drawImage(img, W * 0.03, -H * 0.02, W * 1.02, H * 1.02);
  g.globalAlpha = 1;
  g.filter = "none";
  const vignette = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
  vignette.addColorStop(0, "rgba(20,10,5,0)");
  vignette.addColorStop(1, "rgba(20,10,5,0.75)");
  g.fillStyle = vignette;
  g.fillRect(0, 0, W, H);
  img.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.82),
  );
}

function SpiritPhoto({ name }: { name: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed">("idle");
  const input = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setState("busy");
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("photo", await develop(file), "spirit.jpg");
      const res = await fetch("/api/photo", { method: "POST", body: form });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  return (
    <section className="j-card">
      <h2>Spirit photograph</h2>
      <p>Strike a pose. The manor develops it as a spirit photograph and pins it up on the big screen.</p>
      <input ref={input} type="file" accept="image/*" capture="user" hidden onChange={onPick} />
      <button type="button" className="j-btn" disabled={state === "busy"} onClick={() => input.current?.click()}>
        {state === "busy" ? "Developing…" : state === "sent" ? "Take another" : "Take a photograph"}
      </button>
      {state === "sent" && <p className="ok">Developed. Look up, there&apos;s something behind you on the wall.</p>}
      {state === "failed" && <p className="bad">That one didn&apos;t develop. Try again?</p>}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Whisper } from "@/lib/show";

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️\s]+$/u;
export const isEmojiOnly = (s: string) => EMOJI_ONLY.test(s);
const TOAST_MS = 7000;
const FLOAT_MS = 4600;
/** whispers older than this on arrival (a laggy poll, a refresh) go to the guest book only */
const STALE_MS = 30_000;

type Live = Whisper & { kind: "emoji" | "text"; x: number };

/**
 * Guest whispers as they land, on top of whatever phase is playing: an emoji
 * drifts up like a spirit leaving, a line of text appears as a whisper card
 * bottom-left. History is never replayed after a refresh; it is all in the
 * guest book anyway.
 */
export function Reactions({ whispers }: { whispers: Whisper[] }) {
  const seen = useRef<Set<string> | null>(null);
  const [live, setLive] = useState<Live[]>([]);

  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(whispers.map((w) => w.id));
      return;
    }
    const fresh = whispers.filter((w) => !seen.current!.has(w.id));
    if (!fresh.length) return;
    fresh.forEach((w) => seen.current!.add(w.id));
    const now = Date.now();
    const add: Live[] = fresh
      .filter((w) => now - w.at < STALE_MS)
      .map((w) => ({ ...w, kind: isEmojiOnly(w.text) ? "emoji" : "text", x: 6 + Math.random() * 88 }));
    if (!add.length) return;
    setLive((l) => [...l, ...add].slice(-16));
    add.forEach((w) =>
      setTimeout(
        () => setLive((l) => l.filter((x) => x.id !== w.id)),
        w.kind === "emoji" ? FLOAT_MS : TOAST_MS,
      ),
    );
  }, [whispers]);

  const toasts = live.filter((w) => w.kind === "text").slice(-3);
  return (
    <div className="live" aria-live="polite">
      {live
        .filter((w) => w.kind === "emoji")
        .map((w) => (
          <div className="float" key={w.id} style={{ left: `${w.x}%` }}>
            {w.text}
            <small>{w.name.split(" ")[0]}</small>
          </div>
        ))}
      <div className="live-toasts">
        {toasts.map((w) => (
          <div className="whisper-card" key={w.id}>
            <q>{w.text}</q>
            <b>{w.name} whispers</b>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { residents } from "@/data/residents";
import { showCues } from "@/data/vo";
import { say } from "@/lib/vo";
import type { Whisper } from "@/lib/show";
import { Bats, Candle, Fog } from "./atmosphere";
import { useCue } from "./hooks";
import { isEmojiOnly } from "./Reactions";

/** the people who did this, in their own words */
const MAKERS: { name: string; line: string }[] = [
  { name: "Kavya", line: "Summoned with passion and absolutely no supervision" },
  { name: "Jaws", line: "Conjured with care and questionable priorities" },
  { name: "Mohana", line: "Raised from the dead with patience, party planning, and a very sharp cake knife" },
];

export function GuestBook({ whispers }: { whispers: Whisper[] }) {
  useCue(() => say(showCues.guestbook), 1500);
  return (
    <div className="guestbook">
      <Fog density={0.7} />
      <Bats every={16} />
      <div className="gb-candles l">
        <Candle h={120} />
      </div>
      <div className="gb-candles r">
        <Candle h={120} />
      </div>
      <div className="roll">
        <h2>Manor 09</h2>
        <p className="sub">The Guest Book</p>
        {MAKERS.map((m) => (
          <div className="maker" key={m.name}>
            <q>{m.line}</q>
            <b>{m.name}</b>
          </div>
        ))}
        <h3>The residents</h3>
        {residents.map((r) => (
          <div className="credit" key={r.no}>
            <span>{r.title}</span>
            <b>{r.name}</b>
          </div>
        ))}
        <h3>Last words from the guests</h3>
        {whispers.length ? (
          whispers
            .filter((w) => !isEmojiOnly(w.text))
            .map((w) => (
              <div className="wish" key={w.id}>
                <q>{w.text}</q>
                <b>{w.name}</b>
              </div>
            ))
        ) : (
          <p className="sub">The guests were too frightened to speak.</p>
        )}
        <p className="fin">No residents were harmed in the making of this night. Several were mildly reanimated.</p>
        <p className="cake">Cake in the crypt.</p>
        {/* the post-credits tag */}
        <p className="returns">
          Party People will return in November.<small>They always do.</small>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { showCues } from "@/data/vo";
import * as sfx from "@/lib/sfx";
import { say } from "@/lib/vo";
import { Cobweb } from "./atmosphere";
import { useCue } from "./hooks";

/** wrapped candies falling: start x (%), drift, delay, size, hue — all fixed so the rain doesn't reshuffle on re-render */
const CANDIES = [
  [4, -40, 0.0, 30, 20],
  [12, 30, 0.9, 24, 290],
  [21, -20, 1.7, 34, 110],
  [29, 50, 0.4, 26, 20],
  [37, -60, 2.2, 30, 340],
  [45, 20, 1.2, 36, 200],
  [53, -30, 2.8, 26, 40],
  [61, 40, 0.2, 32, 290],
  [69, -50, 1.5, 28, 110],
  [77, 10, 2.5, 34, 20],
  [85, -20, 0.7, 24, 200],
  [93, 40, 1.9, 30, 340],
] as const;

/** one at a time under the parade, a new one every few seconds */
const GOOFY = [
  "Candy is being served. It is not a prop. Eat it.",
  "Don't wander off. The manor knows which room you're in.",
  "Bathroom break? Take the corridor on the left. Not the one that wasn't there a minute ago.",
  "Please do not feed the bats. They are on a diet.",
  "If you leave now, the ghost gets your candy.",
  "This break is sponsored by nobody. Nobody has lived here since 1893.",
  "Your room will be given to someone with a better scream.",
  "The pumpkin has feelings. Wave back.",
];

/**
 * The candy break: a "trick or treat is being served" snipe on top of
 * whatever is playing. A pumpkin, a ghost and a black cat on parade, candy
 * raining the whole time, and a fresh bit of nonsense under them every few seconds.
 */
export function Candy() {
  useCue(() => say(showCues.candy), 700);
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((n) => (n + 1) % GOOFY.length), 4200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let loop: ReturnType<typeof sfx.candyBreak> | null = null;
    // the waltz is in E minor: whatever music was playing underneath steps out rather than clash with it
    sfx.duck("candy", true);
    const t = setTimeout(() => (loop = sfx.candyBreak()), 250);
    return () => {
      clearTimeout(t);
      loop?.stop();
      sfx.duck("candy", false);
    };
  }, []);

  return (
    <div className="candy">
      <div className="candies" aria-hidden="true">
        {CANDIES.map(([x, dx, d, s, hue], i) => (
          <i
            key={i}
            style={{ "--x": `${x}%`, "--dx": `${dx}px`, "--d": `${d}s`, "--s": `${s}px`, "--hue": hue } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="gframe candy-frame">
        <Cobweb corner="tr" size={110} />
        <h1>
          Candy break<span>Trick or treat is being served</span>
        </h1>
      </div>

      <Parade />

      <p className="candy-sub" key={line}>
        {GOOFY[line]}
      </p>
    </div>
  );
}

/** the trick-or-treaters: a pumpkin, a ghost and a black cat, on the march */
export function Parade() {
  return (
    <div className="parade" aria-hidden="true">
      <div className="walker pumpkin-wrap">
        <svg className="walker-svg pumpkin" viewBox="0 0 260 300">
          <g className="leg l">
            <rect x="92" y="236" width="20" height="44" rx="10" />
            <ellipse cx="94" cy="286" rx="30" ry="12" />
          </g>
          <g className="leg r">
            <rect x="148" y="236" width="20" height="44" rx="10" />
            <ellipse cx="166" cy="286" rx="30" ry="12" />
          </g>
          <path className="stem" d="M124 48 C118 30, 128 14, 146 8 C138 22, 140 36, 144 50Z" />
          <ellipse className="body" cx="130" cy="150" rx="118" ry="100" />
          <path className="ridge" d="M70 62 C40 100, 40 200, 70 238 M130 52 C112 100, 112 200, 130 248 M190 62 C220 100, 220 200, 190 238" />
          <g className="face">
            <path d="M72 120 l40 22 l-40 10z" />
            <path d="M188 120 l-40 22 l40 10z" />
            <path d="M60 178 h140 l-18 26 l-16 -12 l-16 12 l-16 -12 l-16 12 l-16 -12 l-16 12 l-16 -12z" />
          </g>
        </svg>
      </div>

      <div className="walker ghost-wrap">
        <svg className="walker-svg ghost" viewBox="0 0 220 300">
          <path
            className="sheet"
            d="M110 14 C50 14, 22 70, 22 130 L22 262 C40 244, 58 244, 74 264 C90 244, 108 244, 124 264 C140 244, 158 244, 174 264 C186 250, 196 250, 198 258 L198 130 C198 70, 170 14, 110 14Z"
          />
          <g className="face">
            <ellipse cx="80" cy="120" rx="12" ry="18" />
            <ellipse cx="140" cy="120" rx="12" ry="18" />
            <ellipse cx="110" cy="170" rx="14" ry="20" />
          </g>
          <path className="arm l" d="M28 160 Q-6 176 6 206" />
          <path className="arm r" d="M192 160 Q226 176 214 206" />
        </svg>
      </div>

      <div className="walker cat-wrap">
        {/* a black cat in profile, back arched, head turned to the room; one silhouette so the parts don't show */}
        <svg className="walker-svg cat" viewBox="0 0 340 260">
          {/* drawn head-left; mirrored so it walks the way the parade goes */}
          <g transform="matrix(-1 0 0 1 340 0)">
          <g className="silhouette">
            <g className="leg l">
              <path d="M98 168 q-12 40 -5 72 h22 q-2 -36 7 -72z" />
            </g>
            <g className="leg r">
              <path d="M128 172 q-12 38 -5 68 h22 q-2 -34 7 -68z" />
            </g>
            <g className="leg l back">
              <path d="M228 166 q-14 40 -6 74 h24 q-2 -38 8 -74z" />
            </g>
            <g className="leg r back">
              <path d="M258 168 q-14 38 -6 72 h24 q-2 -36 8 -72z" />
            </g>
            <path className="tail" d="M282 128 C332 122, 346 66, 302 40" />
            <path className="body" d="M84 130 C108 86, 190 68, 242 92 C286 112, 294 152, 272 180 C244 202, 132 204, 102 184 C80 170, 76 148, 84 130Z" />
            <path className="head" d="M54 98 L44 44 L84 78 C98 72, 114 72, 126 80 L152 48 L146 102 C156 120, 152 142, 136 156 C112 172, 70 170, 54 150 C40 136, 40 114, 54 98Z" />
          </g>
          <g className="eyes">
            <ellipse cx="82" cy="116" rx="8" ry="11" />
            <ellipse cx="118" cy="116" rx="8" ry="11" />
          </g>
          <path className="nose" d="M94 134 h12 l-6 8z" />
          <path className="whisker" d="M40 130 l-30 -6 M40 138 l-30 4 M160 130 l30 -6 M160 138 l30 4" />
          </g>
        </svg>
      </div>
    </div>
  );
}

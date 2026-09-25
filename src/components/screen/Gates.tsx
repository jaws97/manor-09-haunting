"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gatesAmbience } from "@/lib/music";
import * as sfx from "@/lib/sfx";
import { ROOMS, roomLabel, wingOf, type Arrived } from "@/lib/show";
import { Bats, Bolts, Cobweb, Fog, Lightning, lightning, Moon } from "./atmosphere";
import { Parade } from "./Candy";
import { reduced } from "./hooks";
import { Manor } from "./Manor";

/** how long the gates take to open, from the strike to the last of the QR's glow; matches .qr-gate.opening in screen.css */
const OPENING_MS = 3400;

/**
 * The gates: a QR for the invitation, the manor lighting up window by window
 * as seals are broken at the gate, and the latest arrival announced. It is on
 * screen for the whole arrival, so it has a soundscape of its own (see
 * gatesAmbience in lib/music.ts), which starts once the operator wakes the manor.
 *
 * While the house fills the gates are locked: the QR is shut behind them, so
 * nobody gets to what lives in the envelope before everyone else. The keeper
 * opens them once the room is full.
 */
export function Gates({
  arrived,
  photos,
  armed,
  open,
}: {
  arrived: Arrived[];
  photos: string[];
  armed: boolean;
  open: boolean;
}) {
  const latest = arrived[arrived.length - 1];

  useEffect(() => {
    if (!armed) return;
    const ambience = gatesAmbience();
    return () => ambience.stop();
  }, [armed]);

  // The keeper opens the gates: lightning, the padlock springs and drops, the chain runs off and the
  // gates swing in on the QR. Only when it happens on screen: a screen that loads with them open
  // simply shows the QR. A layout effect, so the render where they are open but not yet swinging is
  // never painted: it would flash the bare QR for a frame.
  const [opening, setOpening] = useState(0);
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = open;
    if (!open || was || reduced()) return;
    setOpening((n) => n + 1);
    lightning.strike(true);
    const t = [
      setTimeout(sfx.unchain, 250),
      setTimeout(() => sfx.creak(true), 900),
      setTimeout(() => setOpening(0), OPENING_MS),
    ];
    return () => t.forEach(clearTimeout);
  }, [open]);

  return (
    <div className="gates">
      <Sky />
      <Moon x={76} y={9} size={230} />
      <Bolts left={52} right={96} depth={42} />
      <Grounds />
      <Manor arrived={arrived} />
      <div className="gates-fog">
        <Fog density={1.1} />
      </div>
      <Bats every={18} />
      <Lightning every={45} />
      <div className="gates-left">
        <div className="gframe gates-frame">
          <Cobweb corner="tl" size={150} />
          <Cobweb corner="br" size={120} />
          <h1>
            Manor 09<span key={String(open)}>{open ? "The gates are open" : "The gates are locked"}</span>
          </h1>
        </div>
        <div className="gates-qr">
          <div className={`qr-gate${!open ? " locked" : opening ? " opening" : ""}`}>
            <InviteQr />
            {(!open || opening > 0) && <IronGates key={opening} />}
          </div>
          {/* the chained gates say "not yet" by themselves; the words come with the QR */}
          {open && (
            <div className="qr-say">
              <b>Scan for your invitation</b>
              <p>Show it at the gate. The gatekeeper breaks the seal. No seal, no candy.</p>
            </div>
          )}
        </div>
        <SpiritPhotos photos={photos} />
      </div>
      <div className="gates-arrival">
        <div className="just-arrived" key={latest?.room ?? 0}>
          {latest ? (
            <>
              <span>
                Just arrived · {roomLabel(latest.room)}
                {latest.room <= ROOMS && ` · ${wingOf(latest.room)}`}
              </span>
              <b>{latest.name}</b>
              {latest.cast && <em>☾ a resident of the manor</em>}
            </>
          ) : (
            <>
              <span>The gatekeeper is waiting</span>
              <b>Nobody has dared enter yet…</b>
            </>
          )}
        </div>
        <div className="house-count">
          <b>
            {Math.min(arrived.length, ROOMS)}
            <small> / {ROOMS}</small>
          </b>
          <span>
            rooms taken{arrived.length > ROOMS && ` · +${arrived.length - ROOMS} in the crypt`}
          </span>
        </div>
      </div>
      <div className="gates-stroll" aria-hidden="true">
        <Parade />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the scene */

/** mulberry32: a small seeded random, so the stars and the trees grow the same way every time */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a field of stars as one element's box-shadows: cheap to draw, and it never moves */
function starfield(seed: number, n: number) {
  const r = seeded(seed);
  return Array.from({ length: n }, () => {
    const x = Math.round(r() * 1920);
    // thinner toward the horizon, where the glow of the grounds washes them out
    const y = Math.round(Math.pow(r(), 1.7) * 700);
    const a = (0.35 + r() * 0.65).toFixed(2);
    return `${x}px ${y}px 0 ${r() < 0.12 ? 1 : 0}px rgba(240, 235, 255, ${a})`;
  }).join(",");
}
const STARS = [starfield(9, 90), starfield(27, 70)];

/** The night over the manor: two fields of stars twinkling out of step, and clouds dragging past. */
const Sky = memo(function Sky() {
  return (
    <div className="sky-night" aria-hidden="true">
      <i className="stars s1" style={{ boxShadow: STARS[0] }} />
      <i className="stars s2" style={{ boxShadow: STARS[1] }} />
      <i className="sky-cloud c1" />
      <i className="sky-cloud c2" />
      <i className="sky-cloud c3" />
    </div>
  );
});

/**
 * A dead tree as one SVG path: the trunk splits, and splits again, each limb a tapered, slightly
 * bent quad that forks into two or three thinner ones.
 */
function deadTree(seed: number, x: number, y: number, height: number, lean: number) {
  const r = seeded(seed);
  const parts: string[] = [];
  const f = (n: number) => n.toFixed(1);
  const limb = (x0: number, y0: number, len: number, ang: number, w: number, depth: number) => {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    const nx = Math.cos(ang + Math.PI / 2);
    const ny = Math.sin(ang + Math.PI / 2);
    const bend = (r() - 0.5) * len * 0.35;
    const mx = (x0 + x1) / 2 + nx * bend;
    const my = (y0 + y1) / 2 + ny * bend;
    const w1 = w * 0.64;
    const wm = (w + w1) / 4;
    parts.push(
      `M${f(x0 + (nx * w) / 2)} ${f(y0 + (ny * w) / 2)} Q${f(mx + nx * wm)} ${f(my + ny * wm)} ${f(x1 + (nx * w1) / 2)} ${f(y1 + (ny * w1) / 2)} ` +
        `L${f(x1 - (nx * w1) / 2)} ${f(y1 - (ny * w1) / 2)} Q${f(mx - nx * wm)} ${f(my - ny * wm)} ${f(x0 - (nx * w) / 2)} ${f(y0 - (ny * w) / 2)}Z`,
    );
    if (depth === 0 || w1 < 1.1) return;
    const kids = depth > 4 ? 2 : r() < 0.45 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const spread = (k - (kids - 1) / 2) * 0.62 + (r() - 0.5) * 0.7;
      limb(x1, y1, len * (0.6 + r() * 0.24), ang + spread, w1, depth - 1);
    }
  };
  limb(x, y, height * 0.34, -Math.PI / 2 + lean, height * 0.07, 7);
  return parts.join("");
}

function tombstone(x: number, y: number, kind: number, tilt: number) {
  const shapes = [
    "M-14 0 V-30 A14 14 0 0 1 14 -30 V0 Z",
    "M-4 0 V-26 H-15 V-34 H-4 V-46 H4 V-34 H15 V-26 H4 V0 Z",
    "M-12 0 V-20 L-9 -36 L0 -44 L9 -36 L12 -20 V0 Z",
    "M-18 0 V-22 Q-18 -30 -10 -30 H10 Q18 -30 18 -22 V0 Z",
  ];
  return { d: shapes[kind % shapes.length], transform: `translate(${x} ${y}) rotate(${tilt})` };
}

// one behind the west tower, leaning toward the house and clear of the QR's caption; one off the east edge
const TREES = [deadTree(3, 1035, 960, 400, 0.1), deadTree(11, 1905, 960, 560, 0.2)];
const STONES = [
  tombstone(930, 1004, 0, -6),
  tombstone(986, 1012, 1, 4),
  tombstone(1042, 1006, 3, -3),
  tombstone(1800, 1000, 2, 5),
  tombstone(1858, 1010, 0, -8),
];

/** The hill the manor stands on, the graveyard at its foot, and two dead trees behind it all. */
const Grounds = memo(function Grounds() {
  return (
    <svg className="grounds" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="g-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1328" />
          <stop offset="1" stopColor="#07050c" />
        </linearGradient>
      </defs>
      <g className="trees">
        {TREES.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <path d="M880 1080 C920 950 990 872 1052 862 L1830 858 C1880 866 1910 894 1920 915 V1080 Z" fill="url(#g-hill)" />
      <path d="M0 1080 V1040 C360 1010 700 1022 980 1000 C1300 976 1620 990 1920 972 V1080 Z" fill="#08060e" />
      <g className="stones">
        {STONES.map((s, i) => (
          <path key={i} d={s.d} transform={s.transform} />
        ))}
      </g>
    </svg>
  );
});

/* ------------------------------------------------------------- the rest */

/** Latest spirit photographs, pinned up like the evidence they are. */
function SpiritPhotos({ photos }: { photos: string[] }) {
  const latest = photos.slice(-3);
  if (!latest.length) return null;
  return (
    <div className="spirits">
      {latest.map((id, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own photo route
        <img key={id} src={`/api/photo/${id}`} alt="" style={{ rotate: `${((i * 37) % 13) - 6}deg` }} />
      ))}
    </div>
  );
}

/** the left leaf's top rail sweeps up toward the middle, where the two leaves meet (a 144×288 leaf) */
const railY = (x: number) => {
  const t = x / 144;
  return (1 - t) ** 2 * 60 + 2 * t * (1 - t) * 56 + t ** 2 * 36;
};
const spear = (x: number, top: number) =>
  `M${x} ${(top - 15).toFixed(1)} L${x - 6} ${top.toFixed(1)} L${x} ${(top + 4).toFixed(1)} L${x + 6} ${top.toFixed(1)}Z`;
const PICKETS = [29, 53, 77, 101, 125];
const LEAF = {
  bars: [
    "M0 60 Q72 56 144 36 M0 100 H144 M0 200 H144 M0 278 H144",
    ...PICKETS.map((x) => `M${x} 288 V${(railY(x) - 16).toFixed(1)}`),
  ].join(" "),
  // the hinge stile ends in a ball; the meeting stile stands tallest, so the pair peaks in the middle
  posts: `M5 288 V${(railY(5) - 2).toFixed(1)} M139 288 V${(railY(139) - 22).toFixed(1)}`,
  tips: [...PICKETS.map((x) => spear(x, railY(x) - 16)), spear(139, railY(139) - 22)].join(" "),
  ball: { cx: 5, cy: railY(5) - 7 },
  rings: [41, 65, 89, 113].flatMap((x) => [
    [x, 80],
    [x, 239],
  ]),
};

/** a chain between two points, its links alternately face-on and edge-on (in the 288×288 overlay) */
function chainLinks(x1: number, y1: number, x2: number, y2: number) {
  const n = Math.round(Math.hypot(x2 - x1, y2 - y1) / 11);
  const ang = ((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI).toFixed(1);
  return Array.from({ length: n }, (_, i) => {
    const x = x1 + ((x2 - x1) * (i + 0.5)) / n;
    const y = y1 + ((y2 - y1) * (i + 0.5)) / n;
    return { x, y, turn: `rotate(${ang} ${x.toFixed(1)} ${y.toFixed(1)})`, face: i % 2 === 0 };
  });
}
// wound across both leaves, crossing where they meet, and the padlock through the crossing
const CHAIN = [...chainLinks(52, 132, 236, 194), ...chainLinks(52, 194, 236, 132)];

/**
 * While the house fills, the QR waits behind a pair of iron gates, chained and padlocked, with the
 * drive up to the house beyond them. When the keeper opens them the padlock springs and drops, the
 * chain runs off and the gates swing in (screen.css, under .qr-gate.opening).
 */
function IronGates() {
  return (
    <div className="qr-iron" aria-hidden="true">
      <i className="qr-beyond" />
      <GateLeaf side="l" />
      <GateLeaf side="r" />
      <svg className="qr-chain" viewBox="0 0 288 288">
        <defs>
          <linearGradient id="qr-brass" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#f1d383" />
            <stop offset="0.45" stopColor="#b98a24" />
            <stop offset="1" stopColor="#5e430c" />
          </linearGradient>
        </defs>
        <g className="chain">
          {CHAIN.map(({ x, y, turn, face }, i) =>
            face ? (
              <ellipse key={i} cx={x} cy={y} rx="7.5" ry="4.2" transform={turn} />
            ) : (
              <line key={i} className="edge" x1={x - 6} y1={y} x2={x + 6} y2={y} transform={turn} />
            ),
          )}
        </g>
        <g className="padlock">
          <path className="shackle" d="M133 177 V166 A11 11 0 0 1 155 166 V177" />
          <rect className="body" x="124" y="174" width="40" height="34" rx="6" />
          <circle className="keyhole" cx="144" cy="186" r="4.5" />
          <rect className="keyhole" x="142" y="188" width="4" height="10" rx="1" />
        </g>
      </svg>
    </div>
  );
}

/** one leaf, hinged at the outer edge; the right one is the left one mirrored */
function GateLeaf({ side }: { side: "l" | "r" }) {
  return (
    <svg className={`qr-leaf ${side}`} viewBox="0 0 144 288">
      <g transform={side === "r" ? "matrix(-1 0 0 1 144 0)" : undefined}>
        <path className="iron" d={LEAF.bars} />
        <path className="iron post" d={LEAF.posts} />
        <path className="tips" d={LEAF.tips} />
        <circle className="tips" r="5.5" {...LEAF.ball} />
        {LEAF.rings.map(([x, y]) => (
          <circle key={`${x}-${y}`} className="ring" cx={x} cy={y} r="9" />
        ))}
      </g>
    </svg>
  );
}

function InviteQr() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      const QRCodeStyling = (await import("qr-code-styling")).default;
      if (dead || !ref.current) return;
      const qr = new QRCodeStyling({
        width: 300,
        height: 300,
        data: `${location.origin}/invite`,
        margin: 8,
        // dark-on-light: inverted codes scan badly off a projector
        dotsOptions: { type: "rounded", color: "#0a0710" },
        cornersSquareOptions: { type: "extra-rounded", color: "#8e1116" },
        cornersDotOptions: { color: "#8e1116" },
        backgroundOptions: { color: "#efe6d0" },
        qrOptions: { errorCorrectionLevel: "M" },
      });
      ref.current.innerHTML = "";
      qr.append(ref.current);
    })();
    return () => {
      dead = true;
    };
  }, []);
  return <div className="qr-box" ref={ref} />;
}

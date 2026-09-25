"use client";

import { memo, useEffect, useRef } from "react";
import { gatesAmbience } from "@/lib/music";
import { ROOMS, roomLabel, wingOf, type Arrived } from "@/lib/show";
import { Bats, Bolts, Cobweb, Fog, Lightning, Moon } from "./atmosphere";
import { Parade } from "./Candy";
import { Manor } from "./Manor";

/**
 * The gates: a QR for the invitation, the manor lighting up window by window
 * as seals are broken at the gate, and the latest arrival announced. It is on
 * screen for the whole arrival, so it has a soundscape of its own (see
 * gatesAmbience in lib/music.ts), which starts once the operator wakes the manor.
 */
export function Gates({ arrived, photos, armed }: { arrived: Arrived[]; photos: string[]; armed: boolean }) {
  const latest = arrived[arrived.length - 1];

  useEffect(() => {
    if (!armed) return;
    const ambience = gatesAmbience();
    return () => ambience.stop();
  }, [armed]);

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
            Manor 09<span>The gates are open</span>
          </h1>
        </div>
        <div className="gates-qr">
          <InviteQr />
          <div>
            <b>Scan for your invitation</b>
            <p>Show it at the gate. The gatekeeper breaks the seal. No seal, no candy.</p>
          </div>
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

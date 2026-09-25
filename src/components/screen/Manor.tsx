"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { caw, moan } from "@/lib/music";
import * as sfx from "@/lib/sfx";
import { PER_FLOOR, ROOMS, type Arrived } from "@/lib/show";
import { Bat, lightning } from "./atmosphere";
import { reduced } from "./hooks";

/*
 * The manor is drawn in its own 860×918 space (every number in this file) and scaled onto the
 * stage by .manor in screen.css. Fifteen windows a floor, eight floors, matching the room plan in
 * show-core: the west tower takes columns 1–4, the main house 5–11, the east tower 12–15. Floor 8,
 * the attic, is the main house's row of dormers; the front door stands under floor 1.
 */
export const MANOR_W = 860;
export const MANOR_H = 918;
const COL_X = [54, 102, 150, 198, 268, 322, 376, 430, 484, 538, 592, 662, 710, 758, 806];
const rowY = (row: number) => 280 + row * 66;
function windowAt(room: number) {
  const i = room - 1;
  const col = i % PER_FLOOR;
  const row = Math.floor(i / PER_FLOOR);
  return { x: COL_X[col], y: rowY(row), col, row, tower: col < 4 || col > 10 };
}
/** where a guest's light leaves from: the front door */
const DOOR = { x: 430, y: 862 };
/** how long a light takes to float up to its window */
const FLIGHT_MS = 1300;
/** lights in the air at once; any more arrive already lit */
const MAX_FLIGHTS = 8;

/** a stable scramble of the room number, for choosing shutters and silhouettes */
const hash = (n: number) => ((n * 2654435761) >>> 0) % 997;

type Flight = { id: number; room: number; cast: boolean; path: string };

/**
 * The manor on the gates screen. Every broken seal sends a light up from the
 * front door to that guest's window, which then lights for good (gold for the
 * residents). In between, the house keeps itself busy: people pass the lit
 * windows, something glows green in an empty room, smoke leaves the chimneys,
 * a crow on the roof caws, bats leave the belfry, a ghost drifts across the
 * front, and the tower clock keeps real time and tolls the hour.
 */
export function Manor({ arrived }: { arrived: Arrived[] }) {
  const taken = useMemo(() => new Map(arrived.map((g) => [g.room, g])), [arrived]);
  // a window lights when its guest's light gets there, not when the server says they're in;
  // whoever was in before the screen loaded is simply lit
  const [landed, setLanded] = useState<ReadonlySet<number>>(() => new Set(arrived.map((g) => g.room)));
  const [flights, setFlights] = useState<Flight[]>([]);
  const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set());
  const [wave, setWave] = useState(0);

  const seen = useRef<number | null>(null);
  const flying = useRef(0);
  const lastChime = useRef(0);
  // a light already in the air when the next poll lands keeps flying; only leaving the gates cancels it
  const pending = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pending.current.delete(id);
      fn();
    }, ms);
    pending.current.add(id);
  };
  useEffect(() => {
    const p = pending.current;
    return () => p.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    // first look, or the show was reset: take the house as it stands
    if (seen.current === null || arrived.length < seen.current) {
      seen.current = arrived.length;
      setLanded(new Set(arrived.map((g) => g.room)));
      return;
    }
    const news = arrived.slice(seen.current);
    seen.current = arrived.length;
    news.forEach((g, i) => {
      const land = () => {
        setLanded((s) => new Set(s).add(g.room));
        setFresh((s) => new Set(s).add(g.room));
        later(() => setFresh((s) => new Set([...s].filter((r) => r !== g.room))), 1200);
        if (performance.now() - lastChime.current > 180) {
          lastChime.current = performance.now();
          sfx.chime(g.cast);
        }
        if (g.cast) lightning.strike(false);
      };
      // the crypt has no window, a crowd of arrivals only gets so many lights, and reduced motion gets none
      if (g.room > ROOMS || flying.current >= MAX_FLIGHTS || reduced()) return land();
      flying.current++;
      const id = g.at + g.room;
      const { x, y } = windowAt(g.room);
      // up and out in an arc from the door, swinging toward the window's side of the house
      const cx = (DOOR.x + x) / 2 + (x < DOOR.x ? -70 : 70);
      const cy = Math.min(y, DOOR.y) - 140;
      const path = `M${DOOR.x} ${DOOR.y} Q${cx} ${cy} ${x} ${y + 22}`;
      later(() => {
        setFlights((f) => [...f, { id, room: g.room, cast: g.cast, path }]);
        if (i % 3 === 0) sfx.wisp(g.cast);
      }, i * 160);
      later(() => {
        flying.current--;
        setFlights((f) => f.filter((x) => x.id !== id));
        land();
      }, i * 160 + FLIGHT_MS);
    });
    // every twentieth guest the whole house flares, west to east
    if (news.length && Math.floor(arrived.length / 20) > Math.floor((arrived.length - news.length) / 20)) {
      later(() => setWave((w) => w + 1), FLIGHT_MS + 200);
    }
  }, [arrived]);

  const lit = useMemo(() => [...taken.values()].filter((g) => g.room <= ROOMS && landed.has(g.room)), [taken, landed]);

  return (
    <div className="manor" aria-hidden="true">
      <ManorArt />
      <div className={`manor-lights${wave ? " wave" : ""}`} key={wave}>
        {lit.map((g) => {
          const { x, y, col } = windowAt(g.room);
          const v = hash(g.room);
          return (
            <i
              key={g.room}
              className={`mw s${v % 6}${g.cast ? " cast" : ""}${fresh.has(g.room) ? " fresh" : v % 4 === 0 ? " flicker" : ""}`}
              style={{ left: x - 16, top: y, "--c": col, "--d": `${(v % 23) / 10}s` } as React.CSSProperties}
            />
          );
        })}
      </div>
      <Passers taken={taken} />
      <Haunting taken={taken} />
      <Clock />
      <Door />
      <Chimneys />
      <TowerEyes />
      <Crow />
      <BelfryBats />
      <Flyby />
      {flights.map((f) => (
        <Wisp key={f.id} {...f} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- the house */

/**
 * The architecture: stone, slate, iron and dark glass, drawn once. Nothing in here moves, so the
 * browser paints it a single time; everything alive is laid over it in HTML.
 */
const ManorArt = memo(function ManorArt() {
  const rooms = Array.from({ length: ROOMS }, (_, i) => ({ room: i + 1, ...windowAt(i + 1) }));
  const cone = (m: boolean) => {
    const X = (x: number) => (m ? MANOR_W - x : x);
    // a witch's hat: flared at the brim, the tip bent over outward
    return `M${X(4)} 238 C${X(70)} 214 ${X(108)} 150 ${X(118)} 72 C${X(116)} 56 ${X(106)} 44 ${X(90)} 34 C${X(112)} 38 ${X(128)} 50 ${X(134)} 70 C${X(142)} 150 ${X(180)} 214 ${X(248)} 238 Z`;
  };
  const cresting = Array.from({ length: 21 }, (_, i) => 270 + i * 16);
  return (
    <svg className="manor-art" viewBox={`0 0 ${MANOR_W} ${MANOR_H}`}>
      <defs>
        <linearGradient id="m-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2342" />
          <stop offset="1" stopColor="#161120" />
        </linearGradient>
        <linearGradient id="m-tower" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#100c19" />
          <stop offset="0.32" stopColor="#30274a" />
          <stop offset="0.68" stopColor="#1e172c" />
          <stop offset="1" stopColor="#0c0913" />
        </linearGradient>
        <linearGradient id="m-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#281d39" />
          <stop offset="1" stopColor="#110c1a" />
        </linearGradient>
        <linearGradient id="m-cone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0e0a16" />
          <stop offset="0.38" stopColor="#2c2140" />
          <stop offset="1" stopColor="#0b0812" />
        </linearGradient>
        <linearGradient id="m-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#29304c" />
          <stop offset="0.45" stopColor="#0d0c18" />
          <stop offset="1" stopColor="#06050b" />
        </linearGradient>
        <radialGradient id="m-clock" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="0.6" stopColor="#f1d383" />
          <stop offset="1" stopColor="#b98a24" />
        </radialGradient>
        <pattern id="m-blocks" width="28" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 0.5 H28 M0 7.5 H28 M0.5 0 V7 M14.5 7 V14" stroke="#07050c" strokeWidth="1" opacity="0.55" fill="none" />
        </pattern>
        <pattern id="m-slates" width="14" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 9 Q3.5 2 7 9 Q10.5 2 14 9" stroke="#07050c" strokeWidth="1.1" fill="none" opacity="0.6" />
        </pattern>
      </defs>

      {/* the towers */}
      {[20, 628].map((x) => (
        <g key={x}>
          <rect x={x} y="252" width="212" height="648" fill="url(#m-tower)" />
          <rect x={x} y="252" width="212" height="648" fill="url(#m-blocks)" />
        </g>
      ))}
      {/* the main house and its mansard */}
      <rect x="232" y="330" width="396" height="570" fill="url(#m-stone)" />
      <rect x="232" y="330" width="396" height="570" fill="url(#m-blocks)" />
      <rect x="232" y="330" width="14" height="570" fill="#07050c" opacity="0.45" />
      <rect x="614" y="330" width="14" height="570" fill="#07050c" opacity="0.45" />
      {/* string courses between the floors */}
      {Array.from({ length: 7 }, (_, r) => {
        const y = rowY(r + 1) - 12;
        return (
          <g key={r}>
            <rect x="14" y={y} width="226" height="5" fill="#3b2f50" />
            {r > 0 && <rect x="232" y={y} width="396" height="5" fill="#3b2f50" />}
            <rect x="620" y={y} width="226" height="5" fill="#3b2f50" />
            <rect x="14" y={y + 5} width="832" height="2" fill="#07050c" opacity="0.6" />
          </g>
        );
      })}
      <path d="M222 334 L246 250 L614 250 L638 334 Z" fill="url(#m-roof)" />
      <path d="M222 334 L246 250 L614 250 L638 334 Z" fill="url(#m-slates)" />
      <path d="M246 250 L266 234 L594 234 L614 250 Z" fill="#1b1428" />
      <rect x="218" y="330" width="424" height="6" fill="#3d3052" />
      <line x1="266" y1="224" x2="594" y2="224" stroke="#3d3052" strokeWidth="2" />
      {cresting.map((x) => (
        <path key={x} d={`M${x} 234 V220 M${x - 3} 223 L${x} 216 L${x + 3} 223`} stroke="#3d3052" strokeWidth="2" fill="none" />
      ))}
      {/* chimneys */}
      {[292, 544].map((x) => (
        <g key={x}>
          <rect x={x} y="176" width="24" height="62" fill="#2a2138" />
          <rect x={x} y="176" width="24" height="62" fill="url(#m-blocks)" />
          <rect x={x - 4} y="170" width="32" height="8" fill="#3d3052" />
        </g>
      ))}
      {/* the clock tower: belfry, spire and weathervane */}
      <rect x="394" y="142" width="72" height="112" fill="url(#m-stone)" />
      <rect x="394" y="142" width="72" height="112" fill="url(#m-blocks)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x="394" y={150 + i * 20} width="8" height="10" fill="#3b2f50" />
          <rect x="458" y={160 + i * 20} width="8" height="10" fill="#3b2f50" />
        </g>
      ))}
      <circle cx="430" cy="196" r="31" fill="#07050c" opacity="0.6" />
      <circle cx="430" cy="196" r="25" fill="url(#m-clock)" stroke="#7a5a14" strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="430" y1="174" x2="430" y2={i % 3 === 0 ? 180 : 177} stroke="#2a1a08" strokeWidth={i % 3 === 0 ? 2.4 : 1.4} transform={`rotate(${i * 30} 430 196)`} />
      ))}
      <rect x="388" y="134" width="84" height="8" fill="#3d3052" />
      <rect x="400" y="98" width="60" height="36" fill="url(#m-stone)" />
      <path d="M414 134 V114 A16 16 0 0 1 446 114 V134 Z" fill="#05040a" />
      <path d="M423 131 Q423 118 430 117 Q437 118 437 131 Z" fill="#3a2c18" />
      <path d="M388 100 L430 4 L472 100 Z" fill="url(#m-cone)" />
      <path d="M388 100 L430 4 L472 100 Z" fill="url(#m-slates)" />
      <rect x="384" y="96" width="92" height="6" fill="#3d3052" />
      <line x1="430" y1="6" x2="430" y2="-22" stroke="#3d3052" strokeWidth="3" />
      <circle cx="430" cy="-2" r="3.5" fill="#3d3052" />
      <path
        d="M430 -22 C426 -30 418 -32 410 -28 C414 -26 415 -23 413 -19 C418 -21 423 -20 426 -17 C428 -19 429 -21 430 -22 C431 -21 432 -19 434 -17 C437 -20 442 -21 447 -19 C445 -23 446 -26 450 -28 C442 -32 434 -30 430 -22 Z"
        fill="#3d3052"
      />
      {/* the dormers: the attic floor of the main house */}
      {COL_X.slice(4, 11).map((x) => (
        <g key={x}>
          <rect x={x - 23} y="270" width="46" height="64" fill="url(#m-stone)" />
          <path d={`M${x - 29} 277 L${x} 246 L${x + 29} 277 Z`} fill="url(#m-roof)" stroke="#3d3052" strokeWidth="2" />
          <line x1={x} y1="246" x2={x} y2="234" stroke="#3d3052" strokeWidth="2" />
        </g>
      ))}
      {/* the towers' crowns: corbelled parapets and witch's-hat roofs, each with a round window */}
      {[false, true].map((m) => {
        const X = (x: number) => (m ? MANOR_W - x : x);
        return (
          <g key={String(m)}>
            <rect x={m ? MANOR_W - 240 : 12} y="232" width="228" height="20" fill="#2a2138" />
            {Array.from({ length: 14 }, (_, i) => (
              <rect key={i} x={(m ? MANOR_W - 240 : 12) + 4 + i * 16} y="252" width="8" height="7" fill="#1d1729" />
            ))}
            <path d={cone(m)} fill="url(#m-cone)" stroke="#3d3052" strokeWidth="1.5" />
            <path d={cone(m)} fill="url(#m-slates)" />
            <circle cx={X(126)} cy="186" r="12" fill="#07060c" stroke="#3d3052" strokeWidth="3" />
          </g>
        );
      })}
      {/* the windows, dark until someone moves in */}
      {rooms.map(({ room, x, y, tower }) => {
        const v = hash(room);
        return (
          <g key={room}>
            {tower && (
              <path
                d={`M${x - 21} ${y + 16} Q${x - 21} ${y - 6} ${x} ${y - 13} Q${x + 21} ${y - 6} ${x + 21} ${y + 16}`}
                fill="none"
                stroke="#4a3d62"
                strokeWidth="3"
              />
            )}
            <path d={`M${x - 19} ${y + 47} V${y + 16} A19 19 0 0 1 ${x + 19} ${y + 16} V${y + 47} Z`} fill="#392d4e" />
            <path d={`M${x - 16} ${y + 44} V${y + 16} A16 16 0 0 1 ${x + 16} ${y + 16} V${y + 44} Z`} fill="url(#m-glass)" />
            <path d={`M${x} ${y + 3} V${y + 44} M${x - 16} ${y + 20} H${x + 16}`} stroke="#07050c" strokeWidth="2" />
            <rect x={x - 21} y={y + 44} width="42" height="5" fill="#473a5e" />
            {v % 9 === 0 && (
              // a shutter; every other one has lost a hinge
              <rect
                x={x - 31}
                y={y + 2}
                width="11"
                height="42"
                fill="#1a1320"
                stroke="#07050c"
                transform={v % 2 ? `rotate(-9 ${x - 20} ${y + 2})` : undefined}
              />
            )}
          </g>
        );
      })}
      {/* barred windows low in the towers: the cellars */}
      {[66, 186, 674, 794].map((x) => (
        <g key={x}>
          <rect x={x - 16} y="824" width="32" height="26" rx="3" fill="#07060c" stroke="#3d3052" strokeWidth="2" />
          <path d={`M${x - 8} 826 V848 M${x} 826 V848 M${x + 8} 826 V848`} stroke="#3d3052" strokeWidth="2" />
        </g>
      ))}
      {/* the plinth, the portal round the front door, and the steps */}
      <rect x="12" y="880" width="836" height="20" fill="#231b30" />
      <path d="M384 900 V856 A46 46 0 0 1 476 856 V900 Z" fill="#3a2e4f" />
      <path d="M424 804 L436 804 L440 814 L420 814 Z" fill="#4a3d62" />
      <rect x="402" y="900" width="56" height="6" fill="#2f2640" />
      <rect x="392" y="906" width="76" height="6" fill="#281f36" />
      <rect x="382" y="912" width="96" height="6" fill="#221a30" />
    </svg>
  );
});

/* ------------------------------------------------------------ the living */

/** a guest's light, floating up from the front door to their window */
function Wisp({ path, cast }: Flight) {
  return (
    <div className={`wisp${cast ? " cast" : ""}`} style={{ offsetPath: `path("${path}")` } as React.CSSProperties}>
      <i />
    </div>
  );
}

/** now and then somebody walks past a lit window */
function Passers({ taken }: { taken: Map<number, Arrived> }) {
  const [pass, setPass] = useState<{ room: number; k: number } | null>(null);
  const rooms = useRef<number[]>([]);
  useEffect(() => {
    rooms.current = [...taken.keys()].filter((r) => r <= ROOMS);
  }, [taken]);
  useEffect(() => {
    if (reduced()) return;
    let t: ReturnType<typeof setTimeout>;
    let k = 0;
    const next = () => {
      const r = rooms.current;
      setPass(r.length ? { room: r[Math.floor(Math.random() * r.length)], k: ++k } : null);
      t = setTimeout(next, 3500 + Math.random() * 4000);
    };
    t = setTimeout(next, 2500);
    return () => clearTimeout(t);
  }, []);
  if (!pass) return null;
  const { x, y } = windowAt(pass.room);
  return <i key={pass.k} className={`passer${hash(pass.room) % 2 ? " rev" : ""}`} style={{ left: x - 16, top: y }} />;
}

/** a green glow in a room nobody has taken, as if something else lives there */
function Haunting({ taken }: { taken: Map<number, Arrived> }) {
  const [room, setRoom] = useState<number | null>(null);
  const empty = useRef<number[]>([]);
  useEffect(() => {
    empty.current = Array.from({ length: ROOMS }, (_, i) => i + 1).filter((r) => !taken.has(r));
  }, [taken]);
  useEffect(() => {
    if (reduced()) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      const e = empty.current;
      setRoom(e.length ? e[Math.floor(Math.random() * e.length)] : null);
      t = setTimeout(next, 9000 + Math.random() * 12000);
    };
    t = setTimeout(next, 6000);
    return () => clearTimeout(t);
  }, []);
  if (room === null) return null;
  const { x, y } = windowAt(room);
  return <i key={room} className="haunt" style={{ left: x - 16, top: y }} />;
}

/**
 * The tower clock keeps real time, and tolls the hour: seven strokes at seven. The face glows on
 * each stroke.
 */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  const [tolling, setTolling] = useState(0);
  const tolled = useRef(-1);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      if (d.getMinutes() === 0 && d.getSeconds() < 30 && tolled.current !== d.getHours()) {
        tolled.current = d.getHours();
        const n = d.getHours() % 12 || 12;
        for (let i = 0; i < n; i++)
          setTimeout(() => {
            sfx.toll(true, 0.55);
            setTolling((k) => k + 1);
          }, i * 2400);
      }
    };
    const t = setInterval(tick, 10_000);
    tick();
    return () => clearInterval(t);
  }, []);
  const m = now.getMinutes();
  const h = (now.getHours() % 12) + m / 60;
  return (
    <>
      {tolling > 0 && <i key={tolling} className="clock-halo" />}
      <svg className="manor-clock" viewBox="-26 -26 52 52">
        <line x1="0" y1="3" x2="0" y2="-12" transform={`rotate(${h * 30})`} className="hh" />
        <line x1="0" y1="4" x2="0" y2="-19" transform={`rotate(${m * 6})`} className="mh" />
        <circle r="2.4" />
      </svg>
    </>
  );
}

/** the front door: two plank leaves standing ajar on a hall lit sickly green, and something crossing it now and then */
function Door() {
  return (
    <>
      <i className="manor-lamp l" />
      <div className="manor-door">
        <i className="hall" />
        <i className="leaf l">
          <i className="knocker" />
        </i>
        <i className="leaf r" />
        <i className="fanlight" />
      </div>
      <i className="manor-lamp r" />
      {[344, 516, 300, 560].map((x, i) => (
        <i key={x} className="jol" style={{ left: x, "--d": `${i * -0.37}s` } as React.CSSProperties} />
      ))}
    </>
  );
}

function Chimneys() {
  return (
    <>
      {[304, 556].map((x, c) => (
        <div key={x} className="smoke" style={{ left: x }}>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} style={{ animationDelay: `${-(i * 2.4 + c * 1.1)}s` }} />
          ))}
        </div>
      ))}
    </>
  );
}

/** something up in the towers' round windows, blinking, now and then */
function TowerEyes() {
  return (
    <>
      <i className="eyes w" />
      <i className="eyes e" />
    </>
  );
}

/** a crow on the roof that caws every so often, beak and all, in step with the sound */
function Crow() {
  const [cawing, setCawing] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      const n = 2 + Math.floor(Math.random() * 2);
      caw(0.3, n);
      setCawing((k) => k + 1);
      t = setTimeout(next, 22_000 + Math.random() * 20_000);
    };
    t = setTimeout(next, 9000);
    return () => clearTimeout(t);
  }, []);
  return (
    <svg className={`crow${cawing ? " caw" : ""}`} key={cawing} viewBox="0 0 60 44">
      <path className="tail" d="M8 30 L0 40 L6 40 L14 33 Z" />
      <path className="body" d="M10 30 C12 20 24 15 34 17 C42 18 46 24 44 30 C40 36 22 38 10 30 Z" />
      <path className="wing" d="M16 26 C22 19 32 19 38 23 C32 27 24 30 16 26 Z" />
      <g className="head">
        <circle cx="44" cy="15" r="7" />
        <circle className="eye" cx="46" cy="13" r="1.3" />
        <path className="beak-top" d="M49 13 L60 15.5 L49 16.5 Z" />
        <path className="beak-low" d="M49 16.5 L58 17 L49 18.5 Z" />
      </g>
      <path className="legs" d="M26 35 V44 M32 35 V44" />
    </svg>
  );
}

/** a handful of bats leaving the belfry, every so often */
function BelfryBats() {
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      setBurst((k) => k + 1);
      sfx.bats();
      t = setTimeout(next, 28_000 + Math.random() * 30_000);
    };
    t = setTimeout(next, 14_000);
    return () => clearTimeout(t);
  }, []);
  if (!burst) return null;
  return (
    <div className="belfry" key={burst}>
      {[
        [-260, -170, 0, 30],
        [190, -210, 0.15, 24],
        [-120, -260, 0.3, 20],
        [300, -120, 0.42, 26],
      ].map(([dx, dy, d, s], i) => (
        <div key={i} className="belfry-bat" style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, animationDelay: `${d}s` } as React.CSSProperties}>
          <Bat size={s} />
        </div>
      ))}
    </div>
  );
}

/** a ghost drifting across the front of the house, moaning, left to right or right to left */
function Flyby() {
  const [pass, setPass] = useState<{ k: number; rev: boolean } | null>(null);
  useEffect(() => {
    if (reduced()) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      const rev = Math.random() < 0.5;
      setPass({ k: Date.now(), rev });
      setTimeout(() => (rev ? moan(0.7, -0.7, 4.2) : moan(-0.7, 0.7, 4.2)), 1200);
      t = setTimeout(next, 50_000 + Math.random() * 40_000);
    };
    t = setTimeout(next, 30_000);
    return () => clearTimeout(t);
  }, []);
  if (!pass) return null;
  return (
    <div key={pass.k} className={`flyby${pass.rev ? " rev" : ""}`}>
      <svg viewBox="0 0 120 150">
        <path d="M60 6 C30 6 16 34 16 64 L16 132 C26 122 34 124 42 138 C50 124 58 124 66 138 C74 124 82 124 90 138 C96 128 102 126 104 132 L104 64 C104 34 90 6 60 6 Z" />
        <ellipse className="face" cx="46" cy="56" rx="6" ry="9" />
        <ellipse className="face" cx="74" cy="56" rx="6" ry="9" />
        <ellipse className="face" cx="60" cy="84" rx="7" ry="11" />
      </svg>
    </div>
  );
}

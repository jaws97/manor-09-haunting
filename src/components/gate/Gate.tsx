"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bats, Fog, Moon } from "@/components/screen/atmosphere";
import { createStore } from "@/lib/store";

/**
 * What the gate page is allowed to know about a resident. The server strips
 * title / name / lore until reveal time, so the secret never ships in the
 * client bundle — do not import `@/data/residents` from here.
 */
export type GateResident = {
  no: number;
  day: number;
  art: string;
  title?: string;
  name?: string;
  lore?: string;
  portrait?: string;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function Gate({
  residents,
  revealed,
  startsAt,
  venue,
  tagline,
  tickerExtras,
}: {
  residents: GateResident[];
  revealed: boolean;
  startsAt: string;
  venue: string;
  tagline: string;
  tickerExtras: string[];
}) {
  const [open, setOpen] = useState<GateResident | null>(null);
  const tickerItems = useMemo(
    () => [
      ...residents.map((r) =>
        r.title ? `${r.title} · born Sep ${pad2(r.day)}` : `Portrait ${pad2(r.no)} · born Sep ${pad2(r.day)}`,
      ),
      ...tickerExtras,
    ],
    [residents, tickerExtras],
  );

  return (
    <div className="gate-page">
      <header className="sky">
        <div className="sky-manor" aria-hidden="true" />
        <Moon x={70} y={6} size={150} />
        <Fog density={1.2} />
        <Bats every={12} max={4} />
        <div className="marquee">
          <div className="gframe">
            <h1>
              Manor 09<span>You are cordially summoned · 7 October</span>
            </h1>
            <p>{tagline}</p>
            <div className="ticker">
              <div className="track">
                {[0, 1].flatMap((k) => tickerItems.map((s, i) => <span key={`${k}-${i}`}>{s}</span>))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="lobby">
          <div className="panel">
            <h2>The gates open in</h2>
            <p className="lead">One night, 7 October, {venue}. Candles lit ten minutes before.</p>
            <Countdown to={startsAt} />
          </div>
          <div className="panel">
            <h2>Your invitation</h2>
            <div className="mock-env" aria-hidden="true">
              <i className="flap" />
              <i className="seal" />
              <span>By candlelight, to</span>
              <b>a guest</b>
            </div>
            <p className="note">Written at the gate on the night. The gatekeeper breaks the seal.</p>
          </div>
          <div className="panel">
            <h2>The scream</h2>
            <Scream />
          </div>
        </section>

        <section className="today">
          <SeanceRoom />
          <div className="panel showing">
            <h2>Tonight in the manor</h2>
            <Tonight residents={residents} />
          </div>
        </section>

        <div className="wall-head">
          <h2>
            The portrait gallery<span>{residents.length} portraits, one per resident</span>
          </h2>
          <p>
            {revealed
              ? "Every portrait is hung and unveiled. Tap one to read its plaque."
              : "The portraits stay under their dust sheets until the night. No peeking from the gallery."}
          </p>
        </div>
        <section className="wall" aria-label="Portrait gallery">
          {residents.map((r) => (
            <Frame key={r.no} r={r} onOpen={setOpen} />
          ))}
        </section>
      </main>

      <div className="drive" aria-hidden="true">
        <div className="lamp l1" />
        <div className="lamp l2" />
        <p>
          <b>Manor 09</b>Twenty-seven residents. Not one of them at rest.
        </p>
      </div>
      <footer>Manor 09 · one night only.</footer>

      {open && <PlaqueModal r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const clock = createStore<Date | null>(null, (set) => {
  set(new Date());
  const t = setInterval(() => set(new Date()), 1000);
  return () => clearInterval(t);
});

const SCREAMS_KEY = "manor09-screams";
const screamStore = createStore(0, (set) => {
  try {
    set(parseInt(localStorage.getItem(SCREAMS_KEY) || "0", 10) || 0);
  } catch {}
});

function Countdown({ to }: { to: string }) {
  const now = clock.use();
  const s = now ? Math.max(0, Math.floor((new Date(to).getTime() - now.getTime()) / 1000)) : 0;
  const cells: [number, string][] = [
    [Math.floor(s / 86400), "days"],
    [Math.floor((s % 86400) / 3600), "hours"],
    [Math.floor((s % 3600) / 60), "minutes"],
    [s % 60, "seconds"],
  ];
  return (
    <div className="count">
      {cells.map(([v, label]) => (
        <div key={label}>
          <b>{now ? pad2(v) : "--"}</b>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

function Scream() {
  const screams = screamStore.use();

  const onScream = async (ev: React.MouseEvent<HTMLButtonElement>) => {
    const next = screams + 1;
    screamStore.set(next);
    try {
      localStorage.setItem(SCREAMS_KEY, String(next));
    } catch {}
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 18,
      spread: 70,
      startVelocity: 28,
      ticks: 90,
      scalar: 0.8,
      colors: ["#ff7a1a", "#f5c76a", "#8dff6a", "#8a5cd6"],
      origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight },
      disableForReducedMotion: true,
    });
  };

  return (
    <div className="applaud">
      <button type="button" onClick={onScream}>
        Scream
      </button>
      <div>
        <b>{screams.toLocaleString("en-IN")}</b>
        <small>screams from the house so far</small>
      </div>
    </div>
  );
}

const captions: [string, string][] = [
  ["Candle 1", "Table laid. Planchette restless."],
  ["Candle 2", "Something in the east wing keeps switching the lights on."],
  ["Candle 3", "Top floors reserved for the residents. They know who they are."],
  ["Candle 4", "The guest book runs long tonight. The cake runs longer."],
  ["Candle 5", "A scream was already requested from the back of the hall."],
];

function SeanceRoom() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % captions.length), 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="cam" aria-label="The séance room">
      <div className="cam-glow" />
      <div className="tag">Séance room · live</div>
      <div className="cap">
        <b>{captions[i][0]}</b>
        <span>{captions[i][1]}</span>
      </div>
    </div>
  );
}

function Tonight({ residents }: { residents: GateResident[] }) {
  const now = clock.use();
  if (!now) return <p className="lead">Consulting the spirits…</p>;
  const isSep = now.getMonth() === 8;
  const td = now.getDate();
  const today = isSep ? residents.filter((r) => r.day === td) : [];
  if (!today.length) {
    const next = isSep ? residents.find((r) => r.day > td) : undefined;
    return (
      <p className="lead">
        {next
          ? `Quiet in the corridors tonight. The next resident stirs on Sep ${pad2(next.day)}.`
          : "Every resident has stirred. The manor wakes on 7 October."}
      </p>
    );
  }
  return (
    <>
      <p className="lead">{today.length === 1 ? "One resident stirs tonight." : `${today.length} residents stir tonight.`}</p>
      {today.map((r) => (
        <div className="resident" key={r.no}>
          <div className={`mini ${r.art}`} />
          <div>
            <b>{r.title ?? `Portrait ${pad2(r.no)}`}</b>
            <i>{r.name ? `Known by day as ${r.name}` : "Name under the dust sheet"}</i>
            <span className="pulse">Stirring tonight</span>
          </div>
        </div>
      ))}
    </>
  );
}

function Frame({ r, onOpen }: { r: GateResident; onOpen: (r: GateResident) => void }) {
  if (!r.title) {
    return (
      <div className="frame sheeted">
        <div className="sheet">
          <span>Portrait</span>
          <b>{pad2(r.no)}</b>
          <em>Under the sheet</em>
          <span>Born Sep {pad2(r.day)}</span>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className="frame" onClick={() => onOpen(r)}>
      {r.portrait ? (
        // eslint-disable-next-line @next/next/no-img-element -- static portrait thumbnails
        <img src={r.portrait} alt="" loading="lazy" />
      ) : (
        <div className={r.art} />
      )}
      <div className="num">{pad2(r.no)}</div>
      <div className="lore">after {r.lore}</div>
      <div className="title">{r.title}</div>
      <div className="who">
        <b>{r.name}</b>Born Sep {pad2(r.day)}
      </div>
    </button>
  );
}

function PlaqueModal({ r, onClose }: { r: GateResident; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const n = pad2(r.no);
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pTitle"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="plaque-card">
        <button className="close" ref={closeRef} onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="photo">
          {r.portrait ? (
            // eslint-disable-next-line @next/next/no-img-element -- static portrait art
            <img src={r.portrait.replace("-sm.webp", ".webp")} alt="" />
          ) : (
            <div className="ph">{r.name?.split(" ")[0]}</div>
          )}
        </div>
        <div className="main">
          <div className="src">A resident of Manor 09 · after {r.lore}</div>
          <h3 id="pTitle">{r.title}</h3>
          <p className="who">Known by day as {r.name}</p>
          <div className="meta">
            <div>
              <b>Sep {pad2(r.day)}</b>
              <small>born</small>
            </div>
            <div>
              <b>{n}</b>
              <small>portrait</small>
            </div>
            <div>
              <b>{n}</b>
              <small>room</small>
            </div>
          </div>
          <p className="note">Hung in the gallery for one night only. The keeper reads the plaque. Cake in the crypt.</p>
        </div>
        <div className="side">
          Admits one<b>{n}</b>Manor 09
        </div>
      </div>
    </div>
  );
}

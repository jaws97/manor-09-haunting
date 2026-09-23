"use client";

import { artClass, firstName, pad2, portraitBg, residents, type Resident } from "@/data/residents";
import portraitColors from "@/data/portrait-colors.json";
import { residentLine } from "@/data/vo";
import * as sfx from "@/lib/sfx";
import { say } from "@/lib/vo";
import { Candle, Cobweb, Embers, Fog, Lightning, lightning } from "./atmosphere";
import { useCue } from "./hooks";

/**
 * One resident's moment in the gallery: three knocks on the door of their
 * room, the door creaks open on a dust-sheeted frame, lightning strikes and
 * the sheet comes off, and the keeper reads the plaque.
 */
export function Portrait({ r }: { r: Resident }) {
  useCue(() => sfx.knock(3), 250);
  useCue(() => sfx.creak(), 1500);
  useCue(() => {
    lightning.strike(true);
    sfx.sting();
  }, 2700);
  useCue(() => say(residentLine(r)), 4000);
  const accent = (portraitColors as Record<string, string>)[pad2(r.no)] ?? "hsl(30 90% 72%)";
  const bg = portraitBg(r);

  return (
    <div className="gallery" style={{ "--accent": accent } as React.CSSProperties}>
      {/* each resident brings their own room: a soft wash of their portrait's colours (pre-blurred by scripts/portrait-assets.mjs) */}
      {bg && <div className="ambient" style={{ backgroundImage: `url(${bg})` }} />}
      <Fog density={0.8} tint="150,130,190" />
      <Embers count={30} />
      <Lightning />
      <Cobweb corner="tl" size={220} />
      <Cobweb corner="tr" size={170} />
      <div className="sconce l">
        <Candle h={130} />
      </div>
      <div className="sconce r">
        <Candle h={130} />
      </div>

      {/* the door of their room, knocked on and opened */}
      <div className="door-intro" aria-hidden="true">
        <div className="door">
          <div className="door-panel p1" />
          <div className="door-panel p2" />
          <div className="plaque">
            <small>Resident</small>
            <b>No. {pad2(r.no)}</b>
            <span>
              Sep {pad2(r.day)} · {firstName(r)}
            </span>
          </div>
          <i className="knob" />
        </div>
      </div>

      <div className="gallery-body">
        <div className="gilt">
          <div className="canvas">
            {r.clip ? (
              <video src={r.clip} poster={r.portrait} autoPlay muted loop playsInline />
            ) : r.portrait ? (
              // eslint-disable-next-line @next/next/no-img-element -- static portrait art
              <img src={r.portrait} alt="" />
            ) : (
              <div className={artClass(r)} />
            )}
            {r.portrait && (
              <div className="portrait-title">
                <b>{r.title}</b>
                <span>Known by day as {r.name}</span>
              </div>
            )}
            <div className="varnish" />
            <div className="sheen" />
          </div>
          <div className="dust-sheet" aria-hidden="true" />
          <div className="brass">
            <b>No. {pad2(r.no)}</b>
            <span>Born September {r.day}</span>
          </div>
        </div>
        <div className="billing">
          <span className="after">A resident of Manor 09 · after {r.lore}</span>
          <h2 aria-label={r.title}>
            {r.title.split(" ").map((word, i) => (
              <span key={i} aria-hidden="true" style={{ animationDelay: `${3.2 + i * 0.14}s` }}>
                {word}
              </span>
            ))}
          </h2>
          <p className="tagline">{r.tagline}</p>
          <p className="starring">
            Known by day as <b>{r.name}</b>
          </p>
          <p className="release">
            Born <b>Sep {pad2(r.day)}</b> · Portrait {pad2(r.no)} of {residents.length}
          </p>
        </div>
      </div>
    </div>
  );
}

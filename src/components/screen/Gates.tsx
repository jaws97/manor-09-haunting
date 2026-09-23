"use client";

import { useEffect, useMemo, useRef } from "react";
import * as sfx from "@/lib/sfx";
import { ROOMS, roomLabel, wingOf, type Arrived } from "@/lib/show";
import { Bats, Cobweb, Fog, Lightning, Moon } from "./atmosphere";
import { Parade } from "./Candy";

/**
 * The gates: a QR for the invitation, the manor lighting up window by window
 * as seals are broken at the gate, and the latest arrival announced.
 */
export function Gates({ arrived, photos }: { arrived: Arrived[]; photos: string[] }) {
  const latest = arrived[arrived.length - 1];
  const taken = useMemo(() => new Map(arrived.map((g) => [g.room, g])), [arrived]);

  // a note for each arrival, but not for whoever was already in when the screen loaded
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (seen.current !== null && arrived.length > seen.current && latest) sfx.chime(latest.cast);
    seen.current = arrived.length;
  }, [arrived.length, latest]);

  return (
    <div className="gates">
      <Moon x={55} y={3} size={190} />
      <Fog density={1.1} />
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
      <div className="gates-right">
        <div className="house-head">
          <span>The house</span>
          <b>
            {Math.min(arrived.length, ROOMS)}
            <small>
              {" "}
              / {ROOMS} rooms{arrived.length > ROOMS && ` · +${arrived.length - ROOMS} in the crypt`}
            </small>
          </b>
        </div>
        <Manor taken={taken} latest={latest} />
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
      </div>
      <div className="gates-stroll" aria-hidden="true">
        <Parade />
      </div>
    </div>
  );
}

/**
 * The manor's façade: 8 floors of 15 windows. Each broken seal lights one;
 * the residents' rooms (the top floors) glow gold.
 */
export function Manor({ taken, latest }: { taken: Map<number, Arrived>; latest?: Arrived }) {
  return (
    <div className="manor">
      <svg className="roofline" viewBox="0 0 900 200" preserveAspectRatio="none" aria-hidden="true">
        {/* west wing, mansard */}
        <path className="roof" d="M0 200 L0 130 L28 96 L212 96 L240 130 L240 200Z" />
        {/* east wing */}
        <path className="roof" d="M660 200 L660 130 L688 96 L872 96 L900 130 L900 200Z" />
        {/* main house: two gables and the clock tower between them */}
        <path className="roof" d="M240 200 L240 120 L330 46 L420 120 L420 200Z" />
        <path className="roof" d="M480 200 L480 120 L570 46 L660 120 L660 200Z" />
        <path className="roof tower" d="M418 200 L418 70 L450 4 L482 70 L482 200Z" />
        <rect className="chimney" x="284" y="40" width="14" height="46" />
        <rect className="chimney" x="606" y="40" width="14" height="46" />
        <circle className="clockface" cx="450" cy="120" r="20" />
        <path className="clockhands" d="M450 120 L450 106 M450 120 L459 120" />
        <path className="weather" d="M450 4 L450 -14 M442 -8 L458 -8" />
      </svg>
      <div className="facade">
        {Array.from({ length: ROOMS }, (_, i) => {
          const g = taken.get(i + 1);
          const fresh = g && g === latest;
          return <i key={i} className={`win${g ? " lit" : ""}${g?.cast ? " cast" : ""}${fresh ? " fresh" : ""}`} />;
        })}
      </div>
      <div className="manor-door" />
      <div className="manor-steps" />
    </div>
  );
}

/** Latest spirit photographs, pinned up like the evidence they are. */
function SpiritPhotos({ photos }: { photos: string[] }) {
  const latest = photos.slice(-4);
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

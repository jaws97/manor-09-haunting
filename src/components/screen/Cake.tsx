"use client";

import { useEffect, useRef, useState } from "react";
import { ResidentCountInWords } from "@/data/residents";
import { happyBirthday, partyMusic } from "@/lib/music";

/**
 * The cake, after the credits, in the manor's dining hall. Its candles light themselves, the middle
 * row catching from the centre outward and then the top (public/media/cake/light.mp4, 8s, with the
 * crackle of the wicks), and burn on a seamless loop (lit.mp4, 5s) for as long as the singing takes,
 * while the music box plays Happy Birthday for the room. The loop's first frame is the lighting
 * film's last, so the hand-over can't be seen. If the film can't play, the lit cake stands there.
 */
export function Cake({ muted }: { muted: boolean }) {
  const [lit, setLit] = useState(false);
  const light = useRef<HTMLVideoElement>(null);
  const loop = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = light.current;
    if (!v) return;
    v.muted = muted;
    // autoplay with sound is allowed because the operator armed the room with a click
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => setLit(true));
    });
  }, [muted]);

  useEffect(() => {
    if (!lit) return;
    loop.current?.play().catch(() => {});
    // the box winds up as the last candle settles, and plays for the room
    let tune: ReturnType<typeof happyBirthday> | null = null;
    const t = setTimeout(() => (tune = happyBirthday()), 600);
    return () => {
      clearTimeout(t);
      tune?.stop();
    };
  }, [lit]);

  return (
    <div className={`cake-scene${lit ? " lit" : ""}`}>
      <video ref={loop} className="cake-film" src="/media/cake/lit.mp4" poster="/media/cake/lit.webp" muted loop playsInline preload="auto" />
      {!lit && (
        <video
          ref={light}
          className="cake-film"
          src="/media/cake/light.mp4"
          poster="/media/cake/unlit.webp"
          playsInline
          preload="auto"
          onEnded={() => setLit(true)}
          onError={() => setLit(true)}
        />
      )}
      {lit && (
        <>
          <h2 className="cake-title">Happy birthday</h2>
          <p className="cake-sub">to all {ResidentCountInWords.toLowerCase()} residents of Manor 09</p>
        </>
      )}
    </div>
  );
}

/**
 * After the cut, for the rest of the night: the same cake, candles out and smoking, a slice gone, and
 * the manor's black cat (the one that brings the invitations) sitting beside it with frosting on its
 * nose (public/media/cake/after.mp4, a seamless loop). The film is silent; the music is the manor's
 * own, which the mute on /host silences with everything else.
 */
export function AfterCut() {
  useEffect(() => {
    // the timer keeps dev StrictMode's double mount from starting the music twice
    let music: ReturnType<typeof partyMusic> | null = null;
    const t = setTimeout(() => (music = partyMusic()), 300);
    return () => {
      clearTimeout(t);
      music?.stop();
    };
  }, []);
  return (
    <div className="after-cut">
      <video className="cut-film" src="/media/cake/after.mp4" poster="/media/cake/after.webp" autoPlay muted loop playsInline preload="auto" />
    </div>
  );
}

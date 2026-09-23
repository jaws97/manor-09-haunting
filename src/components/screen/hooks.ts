"use client";

import { useEffect, useEffectEvent, useState } from "react";

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/** Fixed 1920×1080 stage scaled to fit whatever the projector gives us. */
export function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H));
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);
  return scale;
}

/** Fire a cue `delay` ms after mount. The timeout keeps dev StrictMode's double mount from doubling the sound. */
export function useCue(cue: () => void, delay = 40) {
  const fire = useEffectEvent(cue);
  useEffect(() => {
    const t = setTimeout(fire, delay);
    return () => clearTimeout(t);
  }, [delay]);
}

export const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

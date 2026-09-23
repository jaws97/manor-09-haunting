export const event = {
  manor: "Manor 09",
  show: "The Haunting",
  tagline: "Twenty-seven residents. One night. Not one of them at rest.",
  /** The night, local time (IST) */
  startsAt: "2026-10-07T18:30:00+05:30",
  venue: "[venue]",
  /**
   * The residents' titles and portraits are the surprise. Before this moment
   * the public pages show dust-sheeted frames only. Set NEXT_PUBLIC_REVEAL=1
   * to preview the revealed state in development.
   */
  revealAt: "2026-10-07T18:30:00+05:30",
} as const;

export function isRevealed(now: Date = new Date()) {
  if (process.env.NEXT_PUBLIC_REVEAL === "1") return true;
  return now >= new Date(event.revealAt);
}

export const tickerExtras = [
  "The gates close at midnight",
  "Top floors reserved for the residents",
  "The guest book runs long, the cake runs longer",
  "Bring a candle. A phone will do.",
  "Screaming is encouraged",
];

/** Show state shared by server and client. No secrets in here: it is served publicly. */

/**
 * Run of show. Once the host leaves the gates the opening plays as one piece,
 * cinema-style: the team ident first, like a production company card, then the
 * storm breaks over the manor and the title card waits for the host. From there
 * Next goes straight to the séance. After the credits, the cake: its candles
 * light themselves for the room to sing to, and once the knife goes in the
 * cut cake, with the manor's cat in the frosting, loops for the rest of the night.
 */
export const PHASES = [
  "gates",
  "ident",
  "storm",
  "title",
  "seance",
  "gallery",
  "scream",
  "guestbook",
  "cake",
  "cut",
] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  gates: "The gates",
  storm: "The storm breaks",
  ident: "Party People ident",
  title: "Title card",
  seance: "The séance",
  gallery: "The portrait gallery",
  scream: "The scream",
  guestbook: "The guest book",
  cake: "The cake",
  cut: "After the cut",
};

/** Where the show is, in words: at the gates, whether they are locked. */
export const phaseLabel = (s: Pick<ShowState, "phase" | "gatesOpen">) =>
  s.phase !== "gates" ? PHASE_LABEL[s.phase] : s.gatesOpen ? "The gates are open" : "The gates are locked";

/** What the keeper should know before pressing a phase; shown under it on the remote. */
export const PHASE_NOTE: Partial<Record<Phase, string>> = {
  gates: "Locked while the house fills: no QR, and the invitation page turns people away. Next opens them; Next again starts the show",
  ident: "Opens the show, then runs on by itself: the storm, then the title card",
  title: "About 12s of organ while the title carves itself in, then the keeper reads it. Next after that",
  cake: "The candles light themselves, then the music box plays Happy Birthday for the room to sing to. Next when the knife goes in",
  cut: "The cut cake, and the manor's cat in the frosting, on a loop for the rest of the night. Mute from here if the venue plays its own music",
};

/** Rooms in the manor: 8 floors of 15 windows. The residents keep rooms 1..27, the top floors. */
export const ROOMS = 120;
export const PER_FLOOR = 15;
/** 8 is the attic, 1 the ground floor */
export const floorOf = (room: number) => 9 - Math.ceil(Math.min(room, ROOMS) / PER_FLOOR);
export const colOf = (room: number) => ((room - 1) % PER_FLOOR) + 1;
export const wingOf = (room: number) => {
  const c = colOf(room);
  return c <= 4 ? "West Wing" : c >= 12 ? "East Wing" : "Main House";
};
/** overflow past the last window goes to the crypt rather than turning anyone away */
export const roomLabel = (room: number) =>
  room > ROOMS ? `Crypt ${room - ROOMS}` : `Room ${String(room).padStart(3, "0")}`;

export type Arrived = { room: number; name: string; cast: boolean; at: number };
/** a guest message; `at` lets the screen show only the ones that just arrived */
export type Whisper = { id: string; name: string; text: string; at: number };

export type ShowState = {
  phase: Phase;
  /**
   * The QR waits behind locked gates while the house fills, and the invitation page turns people
   * away, so nobody meets what lives in the envelope before the room is full: the keeper opens the
   * gates and the whole house tears its invitation at once.
   */
  gatesOpen: boolean;
  /** index into residents while phase === "gallery" */
  portrait: number;
  arrived: Arrived[];
  /** running total of screams; the screen derives the meter from its rate of change */
  screams: number;
  muted: boolean;
  /** guest whispers: shown live as they arrive, then written into the guest book */
  whispers: Whisper[];
  /** spirit photograph ids, newest last */
  photos: string[];
  /** last announcer cue the host fired; `n` changes every time so repeats still play */
  cue: { id: AnnounceCue; n: number } | null;
  /** candy break: an overlay on top of whatever phase is playing; any step of the show ends it */
  candy: boolean;
  rev: number;
};

export const ANNOUNCE_CUES = ["gates", "rooms", "gallery"] as const;
export type AnnounceCue = (typeof ANNOUNCE_CUES)[number];

export const initialShow: ShowState = {
  phase: "gates",
  gatesOpen: false,
  portrait: 0,
  arrived: [],
  screams: 0,
  muted: false,
  whispers: [],
  photos: [],
  cue: null,
  candy: false,
  rev: 0,
};

/** Actions only the host (PIN) may send. */
export type HostAction =
  | { type: "next"; ifPhase?: Phase }
  | { type: "prev" }
  | { type: "goto"; phase: Phase }
  | { type: "portrait"; index: number }
  | { type: "mute"; muted: boolean }
  | { type: "announce"; cue: AnnounceCue }
  | { type: "candy"; on: boolean }
  | { type: "simulate" }
  | { type: "scream"; n: number }
  | { type: "reset" };

export function stepShow(s: ShowState, a: HostAction, residents: number): ShowState {
  const i = PHASES.indexOf(s.phase);
  // Moving the show along always ends a candy break. Leaving the gates opens them for good, even when
  // the keeper jumps past them: latecomers need an invitation to get into the parlour and scream.
  const go = (next: Partial<ShowState>): ShowState => {
    const to = { ...s, ...next, candy: false };
    return to.phase === "gates" ? to : { ...to, gatesOpen: true };
  };
  switch (a.type) {
    case "next":
      if (a.ifPhase && a.ifPhase !== s.phase) return s;
      // the first Next at the gates opens them; the one after starts the show
      if (s.phase === "gates" && !s.gatesOpen) return go({ gatesOpen: true });
      if (s.phase === "gallery" && s.portrait < residents - 1) return go({ portrait: s.portrait + 1 });
      return i < PHASES.length - 1 ? go({ phase: PHASES[i + 1] }) : s;
    case "prev":
      if (s.phase === "gallery" && s.portrait > 0) return go({ portrait: s.portrait - 1 });
      if (s.phase === "gates" && s.gatesOpen) return go({ gatesOpen: false });
      return i > 0 ? go({ phase: PHASES[i - 1] }) : s;
    case "goto":
      return PHASES.includes(a.phase) ? go({ phase: a.phase }) : s;
    case "portrait":
      return a.index >= 0 && a.index < residents ? go({ phase: "gallery", portrait: a.index }) : s;
    case "candy":
      return { ...s, candy: !!a.on };
    case "announce":
      return ANNOUNCE_CUES.includes(a.cue) ? { ...s, cue: { id: a.cue, n: (s.cue?.n ?? 0) + 1 } } : s;
    case "mute":
      return { ...s, muted: !!a.muted };
    case "scream":
      return { ...s, screams: s.screams + Math.max(0, Math.min(50, a.n | 0)) };
    default:
      return s;
  }
}

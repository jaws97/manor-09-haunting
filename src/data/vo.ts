import { event } from "./event";
import { residents, ResidentCountInWords, type Resident } from "./residents";

/**
 * The keeper's script. Each line has an id; if `public/media/vo/<id>.mp3`
 * exists it is played, otherwise the browser's speech voice reads the text so
 * rehearsals have an announcer before the real voice is generated.
 * `/host/script` prints this as a sheet for the recording session.
 */
export type VoLine = { id: string; text: string };

export const showCues = {
  gates: {
    id: "cue-gates",
    text: "Welcome to Manor Oh Nine. Please present your invitation at the gate. The gatekeeper will break the seal. The manor has been expecting you.",
  },
  rooms: {
    id: "cue-rooms",
    text: "Ladies and gentlemen, please find your rooms. The manor is about to wake.",
  },
  title: {
    id: "cue-title",
    text: `A Manor Oh Nine production... ${event.show}. ${ResidentCountInWords} residents. Not one of them at rest.`,
  },
  seance: {
    id: "cue-seance",
    text: "Spirits of September... if you are with us tonight... give us a sign.",
  },
  seanceAfter: {
    id: "cue-seance-after",
    text: `${ResidentCountInWords} spirits. All born in September. All of them... restless. Let us meet them.`,
  },
  gallery: { id: "cue-gallery", text: "Tonight's residents. Hold your screams. Actually... don't." },
  scream: {
    id: "cue-scream",
    text: "Phones out, everyone. On the count of three, the whole house screams. Let the manor hear you. Make it tremble!",
  },
  tremble: { id: "cue-tremble", text: "The manor trembles! The house has spoken." },
  candy: {
    id: "cue-candy",
    text: "Ladies and gentlemen, a short candy break. Trick or treat is being served in the lobby. Don't wander off. The manor knows which room you are in.",
  },
  guestbook: {
    id: "cue-guestbook",
    text: "Thank you for coming. Please sign the guest book on your way out. Cake is in the crypt.",
  },
} satisfies Record<string, VoLine>;

export const residentLine = (r: Resident): VoLine => ({
  id: `resident-${String(r.no).padStart(2, "0")}-${r.slug}`,
  text: `Resident number ${r.no}. ${r.title}. Known by day as ${r.name}. ${r.tagline}`,
});

export const allLines = (): VoLine[] => [...Object.values(showCues), ...residents.map(residentLine)];

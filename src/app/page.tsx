import { connection } from "next/server";
import { Gate, type GateResident } from "@/components/gate/Gate";
import { event, isRevealed, tickerExtras } from "@/data/event";
import { artClass, portraitThumb, residents } from "@/data/residents";
import "./gate.css";

export default async function Home() {
  // Render per request so the dust sheets come off on time without a redeploy.
  await connection();
  const revealed = isRevealed();

  const list: GateResident[] = residents.map((r) =>
    revealed
      ? { no: r.no, day: r.day, art: artClass(r), title: r.title, name: r.name, lore: r.lore, portrait: portraitThumb(r) }
      : { no: r.no, day: r.day, art: artClass(r) },
  );

  return (
    <Gate
      residents={list}
      revealed={revealed}
      startsAt={event.startsAt}
      venue={event.venue}
      tagline={event.tagline}
      tickerExtras={[...tickerExtras]}
    />
  );
}

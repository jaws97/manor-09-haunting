import type { Metadata } from "next";
import { PinGate } from "@/components/PinGate";
import { pad2, portraitThumb, residents } from "@/data/residents";
import { isHost } from "@/server/auth";
import "../host.css";

export const metadata: Metadata = { title: "Manor 09 · Portrait review" };

/** Every portrait with its number, title and plaque line, for collecting feedback. PIN-gated: it shows the surprise. */
export default async function PortraitsPage() {
  if (!(await isHost())) return <PinGate title="Portrait review" />;
  const missing = residents.filter((r) => !r.portrait);
  return (
    <main className="host review">
      <header>
        <span>Manor 09 · portrait review</span>
        <b>
          {residents.length - missing.length} of {residents.length} portraits
        </b>
        <em>
          Note the number of any portrait to redo and what to change.
          {missing.length > 0 && ` Still missing: ${missing.map((r) => `#${pad2(r.no)}`).join(", ")}.`}
        </em>
      </header>
      <div className="review-grid">
        {residents.map((r) => (
          <figure key={r.no}>
            <a href={r.portrait ?? undefined} target="_blank" rel="noreferrer">
              {r.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element -- static portrait thumbnails
                <img src={portraitThumb(r)} alt={`Portrait for ${r.title}`} loading="lazy" />
              ) : (
                <div className="review-missing">No portrait yet</div>
              )}
              <div className="review-title">
                <b>{r.title}</b>
                <span>Known by day as {r.name}</span>
              </div>
            </a>
            <figcaption>
              <code>#{pad2(r.no)}</code> after {r.lore}
              <i>{r.tagline}</i>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}

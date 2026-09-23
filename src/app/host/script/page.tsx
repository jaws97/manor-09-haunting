import type { Metadata } from "next";
import { PinGate } from "@/components/PinGate";
import { allLines } from "@/data/vo";
import { isHost } from "@/server/auth";
import "../host.css";

export const metadata: Metadata = { title: "Manor 09 · Keeper's script" };

/** Recording sheet for the keeper's voice: save each take as public/media/vo/<file>. */
export default async function ScriptPage() {
  if (!(await isHost())) return <PinGate title="Keeper's script" />;
  return (
    <main className="host script">
      <header>
        <span>Manor 09 · keeper&apos;s script</span>
        <b>{allLines().length} lines</b>
        <em>Save each take as public/media/vo/&lt;file&gt;. Until a file exists, the browser voice reads the line.</em>
      </header>
      <ol>
        {allLines().map((l) => (
          <li key={l.id}>
            <code>{l.id}.mp3</code>
            <p>{l.text}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}

import { store } from "@/server/store";

/** Phones batch their screams and post about once a second. */
export async function POST(req: Request) {
  const { n } = (await req.json().catch(() => ({}))) as { n?: unknown };
  const screams = Math.max(0, Math.min(15, Number(n) | 0)); // nobody screams more than 15 times a second
  if (screams) await store.scream(screams);
  return Response.json({ ok: true });
}

import { store } from "@/server/store";

/** The seal is broken: the guest enters the manor and their window lights up on /screen. */
export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
  const invite = typeof id === "string" ? await store.enter(id) : null;
  return invite ? Response.json(invite) : Response.json({ error: "unknown invitation" }, { status: 404 });
}

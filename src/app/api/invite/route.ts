import { store } from "@/server/store";

export async function POST(req: Request) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: unknown };
  if (typeof name !== "string" || name.trim().length < 2) return Response.json({ error: "name required" }, { status: 400 });
  // nobody gets an envelope before the keeper opens the gates, not even with a forwarded link
  if (!(await store.getShow()).gatesOpen) return Response.json({ error: "the gates are locked" }, { status: 423 });
  return Response.json(await store.issueInvite(name));
}

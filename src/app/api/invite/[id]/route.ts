import { store } from "@/server/store";

/** A phone asks once, when its page opens, whether its invitation still exists (a show reset voids them all). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const invite = await store.getInvite(id);
  return invite
    ? Response.json(invite, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: "unknown invitation" }, { status: 404 });
}

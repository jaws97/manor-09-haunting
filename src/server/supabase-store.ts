import "server-only";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { residents } from "@/data/residents";
import { initialShow, ROOMS, stepShow, type HostAction, type ShowState } from "@/lib/show-core";
import type { Invite, ShowStore } from "./store";

/**
 * ShowStore for serverless hosts (Vercel), where there is no shared memory or
 * disk between requests. Schema and SQL functions: supabase/schema.sql.
 * Every write that can race is a single SQL statement or a compare-and-swap.
 */
const BUCKET = "m09-photos";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const newId = (n = 9) => randomBytes(n).toString("base64url");
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** the column is `resident`: "cast" is a reserved word in Postgres */
type InviteRow = { id: string; name: string; room: number; resident: boolean; entered_at: string | null };
const toInvite = (r: InviteRow): Invite => ({
  id: r.id,
  name: r.name,
  room: r.room,
  cast: r.resident,
  enteredAt: r.entered_at ? Date.parse(r.entered_at) : undefined,
});

export class SupabaseStore implements ShowStore {
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private fail(where: string, error: { message: string } | null): never {
    throw new Error(`[supabase] ${where}: ${error?.message ?? "no row — has supabase/schema.sql been run?"}`);
  }

  async getShow(): Promise<ShowState> {
    const { data, error } = await this.db.from("m09_show").select("state, rev").eq("id", "main").maybeSingle();
    if (error || !data) this.fail("getShow", error);
    return { ...initialShow, ...(data.state as Partial<ShowState>), rev: data.rev as number };
  }

  /** compare-and-swap with a few retries; screams bump rev constantly, so a host action can lose a race or two */
  private async mutate(fn: (s: ShowState) => ShowState): Promise<ShowState> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await this.getShow();
      const next = fn(current);
      if (next === current) return current;
      const state: Partial<ShowState> = { ...next };
      delete state.rev; // the row keeps its own rev; only the state column is replaced
      const { data, error } = await this.db.rpc("m09_cas", { expected: current.rev, next_state: state });
      if (error) this.fail("mutate", error);
      if (typeof data === "number") return { ...next, rev: data };
    }
    throw new Error("[supabase] mutate: too much contention");
  }

  async host(action: HostAction) {
    if (action.type === "reset") {
      const { data: photos } = await this.db.from("m09_photos").select("id, type");
      const paths = (photos ?? []).map((p) => `${p.id}.${EXT[p.type as string]}`);
      if (paths.length) await this.db.storage.from(BUCKET).remove(paths);
      await Promise.all(
        ["m09_invites", "m09_whispers", "m09_photos"].map((t) => this.db.from(t).delete().neq("id", "")),
      );
      return this.mutate(() => ({ ...initialShow }));
    }
    if (action.type === "simulate") {
      const room = await this.freeRoom(false);
      if (room) {
        const cast = room <= residents.length;
        const name = cast ? residents[room - 1].name : `Guest ${String(room).padStart(3, "0")}`;
        const t = await this.insertInvite(name, room, cast);
        if (t) await this.enter(t.id);
      }
      return this.getShow();
    }
    return this.mutate((s) => stepShow(s, action, residents.length));
  }

  private async takenRooms() {
    const { data, error } = await this.db.from("m09_invites").select("room");
    if (error) this.fail("takenRooms", error);
    return new Set((data ?? []).map((r) => r.room as number));
  }

  /** residents keep rooms 1..27; everyone else gets a random free room below them, then the crypt */
  private async freeRoom(reserveCast = true): Promise<number | null> {
    const taken = await this.takenRooms();
    const free: number[] = [];
    for (let r = reserveCast ? residents.length + 1 : 1; r <= ROOMS; r++) if (!taken.has(r)) free.push(r);
    if (!free.length) return reserveCast ? Math.max(ROOMS, ...taken) + 1 : null;
    return free[Math.floor(Math.random() * free.length)];
  }

  /** null when the room was taken by a concurrent request (unique constraint) */
  private async insertInvite(name: string, room: number, cast: boolean): Promise<Invite | null> {
    const { data, error } = await this.db
      .from("m09_invites")
      .insert({ id: newId(), name, room, resident: cast })
      .select()
      .maybeSingle();
    if (error?.code === "23505") return null;
    if (error || !data) this.fail("insertInvite", error);
    return toInvite(data as InviteRow);
  }

  async issueInvite(rawName: string) {
    const name = rawName.trim().replace(/\s+/g, " ").slice(0, 48);
    const i = residents.findIndex((r) => norm(r.name) === norm(name));
    if (i >= 0) {
      const cast = await this.insertInvite(residents[i].name, i + 1, true);
      if (cast) return cast; // otherwise someone already claimed the resident's room: fall through to a guest room
    }
    for (let attempt = 0; attempt < 12; attempt++) {
      const t = await this.insertInvite(name, (await this.freeRoom())!, false);
      if (t) return t;
    }
    throw new Error("[supabase] issueInvite: could not find a free room");
  }

  async getInvite(inviteId: string) {
    const { data, error } = await this.db.from("m09_invites").select().eq("id", inviteId).maybeSingle();
    if (error) this.fail("getInvite", error);
    return data ? toInvite(data as InviteRow) : null;
  }

  async enter(inviteId: string) {
    // only the request that flips entered_at from null announces the guest, so double taps light nobody twice
    const at = new Date();
    const { data: fresh, error } = await this.db
      .from("m09_invites")
      .update({ entered_at: at.toISOString() })
      .eq("id", inviteId)
      .is("entered_at", null)
      .select()
      .maybeSingle();
    if (error) this.fail("enter", error);
    if (fresh) {
      const t = toInvite(fresh as InviteRow);
      const { error: e2 } = await this.db.rpc("m09_push", {
        key: "arrived",
        item: { room: t.room, name: t.name, cast: t.cast, at: at.getTime() },
      });
      if (e2) this.fail("enter/push", e2);
      return t;
    }
    const { data: existing } = await this.db.from("m09_invites").select().eq("id", inviteId).maybeSingle();
    return existing ? toInvite(existing as InviteRow) : null;
  }

  async scream(n: number) {
    const { error } = await this.db.rpc("m09_scream", { n });
    if (error) this.fail("scream", error);
  }

  async addWhisper(name: string, text: string) {
    const id = newId();
    const { error } = await this.db.from("m09_whispers").insert({ id, name, text });
    if (error) this.fail("addWhisper", error);
    const { error: e2 } = await this.db.rpc("m09_push", { key: "whispers", item: { id, name, text, at: Date.now() } });
    if (e2) this.fail("addWhisper/push", e2);
  }

  async addPhoto(name: string, type: string, bytes: Uint8Array) {
    const id = newId();
    const up = await this.db.storage.from(BUCKET).upload(`${id}.${EXT[type]}`, bytes, { contentType: type });
    if (up.error) this.fail(`addPhoto/upload (is there a private "${BUCKET}" bucket?)`, up.error);
    const { error } = await this.db.from("m09_photos").insert({ id, name, type });
    if (error) this.fail("addPhoto", error);
    const { error: e2 } = await this.db.rpc("m09_push", { key: "photos", item: id });
    if (e2) this.fail("addPhoto/push", e2);
  }

  async readPhoto(id: string) {
    const { data: p } = await this.db.from("m09_photos").select("type").eq("id", id).maybeSingle();
    if (!p) return null;
    const { data: blob } = await this.db.storage.from(BUCKET).download(`${id}.${EXT[p.type as string]}`);
    return blob ? { type: p.type as string, bytes: new Uint8Array(await blob.arrayBuffer()) } : null;
  }
}

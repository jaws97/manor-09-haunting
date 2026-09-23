"use client";

import { useEffect } from "react";
import { createStore } from "./store";

/**
 * The guest's invitation, kept on their phone so breaking the seal works
 * offline and the page survives a refresh. The server stays the authority on
 * whether the invitation still exists: a "Reset show" on /host voids every
 * invitation, and phones find out the next time they check in.
 */
export type InviteData = {
  id: string;
  name: string;
  room: number;
  cast: boolean;
  enteredAt?: number;
  /** the server has recorded the entry */
  synced?: boolean;
};

const KEY = "manor09-invite";

export const inviteStore = createStore<InviteData | null | undefined>(undefined, (set) => {
  try {
    const raw = localStorage.getItem(KEY);
    set(raw ? (JSON.parse(raw) as InviteData) : null);
  } catch {
    set(null);
  }
});

export function saveInvite(t: InviteData | null) {
  inviteStore.set(t);
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {}
}

export const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * Breaking the seal is local-first: it always plays, and the enter call is
 * retried until the server has it, so bad venue Wi-Fi can delay the big screen
 * but never block the gate.
 */
export async function syncEnter() {
  const t = inviteStore.get();
  if (!t?.enteredAt || t.synced) return;
  try {
    const res = await post("/api/enter", { id: t.id });
    if (res.ok) saveInvite({ ...t, synced: true });
    else if (res.status === 404) saveInvite(null); // the show was reset: this invitation is void
  } catch {}
}

/** Drop the local invitation if the server no longer knows it. Network errors leave it alone. */
async function checkInvite() {
  const t = inviteStore.get();
  if (!t) return;
  try {
    const res = await fetch(`/api/invite/${encodeURIComponent(t.id)}`, { cache: "no-store" });
    if (res.status === 404 && inviteStore.get()?.id === t.id) saveInvite(null);
  } catch {}
}

/**
 * Checks the invitation with the server ONCE, when the page opens — no polling.
 * The only repeating work is the enter retry, and that is not a poll: it makes
 * a request only while a broken seal is still waiting to reach the server,
 * then goes quiet for good.
 */
export function useInvite() {
  const invite = inviteStore.use();
  useEffect(() => {
    void checkInvite();
    void syncEnter();
    const retry = setInterval(syncEnter, 4000);
    return () => clearInterval(retry);
  }, []);
  return invite;
}

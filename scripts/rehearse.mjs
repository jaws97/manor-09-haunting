#!/usr/bin/env node
/**
 * Dress rehearsal without the crowd: simulates guests arriving at the gate,
 * breaking their seals, whispering to the manor and screaming at it, so you
 * can watch /screen react and see how the server copes before the real night.
 *
 *   node scripts/rehearse.mjs                       # 100 guests over ~40s, then a 15s scream
 *   node scripts/rehearse.mjs --guests 150 --arrive 20 --scream 25
 *   node scripts/rehearse.mjs --url https://your-deploy.vercel.app
 *
 * Uses only the public guest endpoints (no PIN), so open the gates first (Next on /host): the
 * gatehouse turns everyone away while they are locked. Reset afterwards from /host.
 */
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = String(arg("url", "http://127.0.0.1:3000")).replace(/\/$/, "");
const GUESTS = Number(arg("guests", 100));
const ARRIVE_S = Number(arg("arrive", 40));
const SCREAM_S = Number(arg("scream", 15));
const CAST_SHARE = 0.2; // roughly how many arrivals are tonight's residents

const first = ["Asha", "Vikram", "Meera", "Rohan", "Divya", "Karthik", "Neha", "Arjun", "Pooja", "Imran", "Lakshmi", "Sameer", "Tanvi", "Nikhil", "Farah", "Harish"];
const last = ["Iyer", "Menon", "Shah", "Reddy", "Kapoor", "Nair", "Das", "Joshi", "Pillai", "Khan", "Rao", "Bose"];
const whispers = ["Happy birthday, you beautiful monsters!", "Scariest cast in the building.", "Who's haunting the coffee machine?", "Best portraits I've ever screamed at.", "Cake first, crypt later.", "Ten out of ten. Would be haunted again.", "🎃", "👻", "🦇", "💀💀💀"];

const lat = [];
let failed = 0;
async function post(path, body) {
  const t = performance.now();
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    lat.push(performance.now() - t);
    if (!res.ok) failed++;
    return res.ok ? res.json() : null;
  } catch {
    failed++;
    return null;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function castNames() {
  // the invitation page ships the residents' names for its suggestions; reuse it
  const html = await fetch(BASE + "/invite").then((r) => r.text()).catch(() => "");
  const m = html.match(/\\?"cast\\?":\[(.*?)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/\\?"([^"\\]+)\\?"/g)].map((x) => x[1]);
}

async function guest(i, name) {
  await sleep(Math.random() * ARRIVE_S * 1000);
  const invite = await post("/api/invite", { name });
  if (!invite) return null;
  await sleep(1500 + Math.random() * 4000); // queueing at the gate
  await post("/api/enter", { id: invite.id });
  if (Math.random() < 0.15) await post("/api/whisper", { name, text: pick(whispers) });
  return invite;
}

async function scream(n) {
  const end = Date.now() + SCREAM_S * 1000;
  let sent = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      await sleep(Math.random() * 1500);
      while (Date.now() < end) {
        // the room swells then runs out of breath: more taps per second in the middle
        const phase = 1 - Math.abs((end - Date.now()) / (SCREAM_S * 1000) - 0.5) * 2;
        const taps = Math.round(1 + phase * 6 * Math.random());
        sent += taps;
        await post("/api/scream", { n: taps });
        await sleep(1000);
      }
    }),
  );
  return sent;
}

const pct = (p) => {
  const s = [...lat].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))]) : 0;
};

console.log(`Rehearsal against ${BASE}: ${GUESTS} guests arriving over ${ARRIVE_S}s`);
const before = await fetch(BASE + "/api/show").then((r) => r.json()).catch(() => null);
if (before && !before.gatesOpen) {
  console.error("The gates are locked, so the gatehouse would turn every guest away. Open them first (Next on /host, or → on /screen).");
  process.exit(1);
}
const cast = await castNames();
console.log(cast.length ? `Found ${cast.length} residents` : "No resident list found; everyone arrives as a plain guest");
const castPool = [...cast].sort(() => Math.random() - 0.5);

const t0 = Date.now();
const invites = (
  await Promise.all(
    Array.from({ length: GUESTS }, (_, i) => {
      const name = castPool.length && Math.random() < CAST_SHARE ? castPool.pop() : `${pick(first)} ${pick(last)} ${i + 1}`;
      return guest(i, name);
    }),
  )
).filter(Boolean);

const rooms = invites.map((t) => t.room);
const dupes = rooms.length - new Set(rooms).size;
console.log(`Gate: ${invites.length}/${GUESTS} entered in ${((Date.now() - t0) / 1000).toFixed(1)}s · resident invitations ${invites.filter((t) => t.cast).length} · duplicate rooms ${dupes}`);

console.log(`Scream: ${invites.length} phones for ${SCREAM_S}s — watch the eye on /screen (scream phase)`);
const screams = await scream(invites.length);

const show = await fetch(BASE + "/api/show").then((r) => r.json());
console.log(`Server now reports: ${show.arrived.length} in the house · ${show.screams} screams (sent ${screams} this run)`);
console.log(`Requests: ${lat.length} · failed ${failed} · latency p50 ${pct(0.5)}ms · p95 ${pct(0.95)}ms · max ${pct(1)}ms`);
if (dupes || failed) process.exitCode = 1;

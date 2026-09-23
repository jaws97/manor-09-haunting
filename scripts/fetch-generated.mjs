#!/usr/bin/env node
/**
 * Pulls freshly generated art into the project and converts it to webp:
 *   "01".."27"                         → public/portraits/NN.webp  (1200×1800)
 *   "manor" | "gallery" | "seance"     → public/media/<name>.webp  (1920×1080)
 *   "gatehouse"                        → public/media/gatehouse.webp (1200×900)
 * Takes a JSON file of { key: url }. Keys not present are left alone, so a
 * redo of one portrait is a one-entry file. Run scripts/portrait-assets.mjs after.
 *
 *   node scripts/fetch-generated.mjs path/to/urls.json
 */
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/fetch-generated.mjs urls.json");
  process.exit(1);
}
const urls = JSON.parse(readFileSync(file, "utf8"));
mkdirSync("public/portraits", { recursive: true });
mkdirSync("public/media", { recursive: true });

const WIDE = { w: 1920, h: 1080, out: (k) => `public/media/${k}.webp` };
const targets = {
  manor: WIDE,
  gallery: WIDE,
  seance: WIDE,
  gatehouse: { w: 1200, h: 900, out: () => "public/media/gatehouse.webp" },
};

for (const [key, url] of Object.entries(urls)) {
  const t = targets[key] ?? { w: 1200, h: 1800, out: (k) => `public/portraits/${k}.webp` };
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`${key}: ${res.status} ${res.statusText}`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const out = t.out(key);
  await sharp(buf).resize(t.w, t.h, { fit: "cover" }).webp({ quality: 82 }).toFile(out);
  console.log(`${key} → ${out}`);
}

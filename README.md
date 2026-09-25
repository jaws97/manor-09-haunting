# Manor 09 · Huluween

Halloween-themed show for the September birthdays (the night: 7 Oct 2026). The big screen is a haunted manor; phones are the invitations. Full concept, run of show and status: [PLAN.md](PLAN.md). (The show was called "The Haunting" until the theme came through as Huluween; the live URL keeps the old name.)

## Run it

```bash
npm install
npm run dev
```

| Route | Who | What |
|---|---|---|
| `/` | everyone, before the night | The gate: countdown, ticker, 28 dust-sheeted frames. Titles and portraits stay under the sheets until `revealAt` in `src/data/event.ts` (`NEXT_PUBLIC_REVEAL=1` previews the reveal). |
| `/screen` | projector laptop (PIN) | The show. Always opens on the gates, and they start **locked**: the manor lives and plays its soundscape, but the QR is shut behind chained iron gates, so the first few in can't get to what lives in the envelope before everyone else. When the house is full, open them (**Open the gates** on `/host`, or `→` here): lightning, the padlock drops, the gates swing in on the QR, and the whole room tears its invitations at once. Click once to wake the manor (sound + fullscreen): the gates then play their own soundscape for as long as they are up. `←` `→` / space step the show if the remote dies (at the gates, `→` opens them and `←` locks them again); `Home` returns to the gates; `c` toggles the candy break. After a mid-show refresh, jump back from `/host`. |
| `/host` | keeper's phone (PIN) | Remote: open the gates, next/back, candy break (a snipe over the current phase), jump to phase or portrait, keeper's cues, mute, rehearsal tools, reset (which locks the gates again). |
| `/invite` | guests | The gatehouse, where the manor’s black cat jumps down off the wall and brings the guest a sealed invitation → the gatekeeper tears it open along the top, through the wax, and a moment later whatever was living in the envelope comes out at the guest (a one-second jump scare, then the stamp and the confetti). Lights the guest's window in the manor on `/screen`. Turns everyone away while the gates are locked, so a forwarded link gets nobody in early. |
| `/join` | guests, once inside | The parlour: SCREAM button (tap, or the microphone), whispers and emoji that appear live on the big screen, spirit photographs. |

**PIN:** set `HOST_PIN` in `.env.local` (required in production). In development it falls back to `0909`.

**Local data:** `npm run dev` always uses the file store in `.data/`, even when `.env.local` holds Supabase credentials, so rehearsals and test invitations never land in the live database. To point local dev at the live database on purpose, run it with `STORE=supabase` (PowerShell: `$env:STORE="supabase"; npm run dev`). `/api/health` tells you which store is active.

**Rehearse without a crowd:** `npm run rehearse` simulates 100 guests arriving, breaking their seals, whispering and screaming (open `/screen` first and open the gates from `/host`; try `-- --guests 150 --arrive 60`). Reset from `/host` afterwards.

**The keeper (announcer):** lines live in `src/data/vo.ts`; `/host/script` is the recording sheet. Drop takes into `public/media/vo/<id>.mp3` — until then the browser voice stands in, slow and low.

**Portraits:** `public/portraits/NN.webp` (1200×1800, no text, no faces). After adding or replacing one, run `npm run portraits` to rebuild the thumbnails, the blurred room backdrops and the accent colours. `scripts/fetch-generated.mjs` pulls freshly generated art in from a `{ "NN": url }` file. `/host/portraits` is the review gallery.

**Rehearse on real phones:** run the dev server, then open `http://<laptop-ip>:3000/invite` on a phone on the same Wi-Fi.

## Deploy to Vercel

Live: **https://manor-09-haunting.vercel.app** (Vercel project `manor-09-haunting`; pushes to `main` deploy). The steps below are already done for it and are kept for the next show.

Vercel functions share no memory or disk, so the deployed app must use the Supabase store (it switches on automatically in production when the credentials are present). This project shares the Supabase project the movie show used: every object here is prefixed `m09_` (tables, functions) or `m09-` (bucket), so nothing collides with `s09_`.

1. `vercel link` (new project) then `vercel env pull .env.local`, or connect the Supabase integration in the Vercel dashboard.
2. `node scripts/setup-supabase.mjs` — runs [supabase/schema.sql](supabase/schema.sql) and creates the private `m09-photos` bucket. Safe to re-run; `--wipe` clears show data.
3. **Vercel → Project → Settings → Environment Variables:** `HOST_PIN` (required; the app refuses to run staff pages without it), `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (already present if the integration is connected). The service-role key is server-only; never prefix it with `NEXT_PUBLIC_`.
4. Deploy, then open `/api/health`. You want `{"ok":true,"store":"supabase","pin":true}`.
5. Load-test the real thing: open the gates on `/host`, run `npm run rehearse -- --url https://<your-app>.vercel.app`, then **Reset show** from `/host`.

Keep the repo private until the night: it contains the residents' titles and the surprise.

## How it fits together

- `src/data/` — all event content (residents, titles, plaque lines, keeper's script). Re-skin here for next month's theme.
- `src/lib/show-core.ts` — show state + phase machine shared by server and client. Nothing secret lives in it.
- `src/server/store.ts` — `ShowStore` seam: file-backed locally (`.data/`), `src/server/supabase-store.ts` on Vercel. Racy writes (screams, rooms) are single SQL statements or compare-and-swap.
- `src/app/api/` — guests only ever POST (invite, enter, scream, whisper, photo). Only `/screen` and `/host` poll `/api/show`.
- `src/lib/sfx.ts`, `src/lib/seal.ts` — all sound is synthesised with WebAudio (thunder, wind, creaks, knocks, bells, organ, wolves, whispers, bats; the quill, the wax, the cracking seal, the jump scare's scream). Swap individual cues for recorded files later.
- `src/lib/music.ts` — the music, synthesised too, on its own bus that ducks under the keeper and steps out for the candy break: the opening of Bach's Toccata in D minor under the title card, the gates' soundscape (a haunted music box, a crooked waltz, a theremin, the Dies Irae on a far-off bell, with owls, wolves, chains and footsteps in between), and the lullaby under the guest book. Everything but the Toccata and the Dies Irae (both public domain) was written for the manor.
- `src/components/screen/` — the stage: `atmosphere.tsx` (fog, lightning and its bolts, bats, moon, candles, cobwebs), `Manor.tsx` (the house on the gates screen), one file per phase.
- `public/media/scare/` — the five things that can come out of an envelope (generated, no gore); one is picked and preloaded per invitation.
- Nothing is moderated. Whispers appear on the big screen as they arrive (emoji drift up, text shows as a whisper card) and are written into the guest book at the end; spirit photographs go straight onto the gates screen.

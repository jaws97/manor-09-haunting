# Manor 09 · The Haunting — Plan

The night: **7 Oct 2026**. 27 September-born "residents" of a haunted manor. The big screen is the manor; phones are invitations. The team set the theme (Halloween) after the movie-premiere show was built; this is a new show on the same, already load-tested engine (see `../Movie Themed`).

## The idea

Every September birthday is a resident of Manor 09, with a creature title (Aviracula, Snehaferatu, The Gautham Reaper…) and a portrait hanging in the gallery under a dust sheet. Guests are summoned by sealed invitation; the gatekeeper breaks the wax seal at the door and the guest's window lights up in the manor. When the house is full the storm breaks, the clock strikes midnight, the spirits are called at a séance, and the portraits are unveiled one by one. Then the whole house screams until the manor trembles, and everyone signs the guest book.

## Surfaces (Next.js App Router)
| Route | Device | Purpose |
|---|---|---|
| `/` | any | Pre-night teaser: the manor under the moon, countdown, ticker, 27 dust-sheeted frames (reveal after `revealAt`) |
| `/screen` | projector laptop | The show. Phase-driven, no hover dependencies, big type, keyboard fallback |
| `/host` | keeper's phone (PIN) | Remote: next/prev phase, jump to portrait, candy break, keeper's cues, mute, rehearsal tools, reset |
| `/invite` | guest phone | Gatehouse (name → invitation) → sealed envelope → press-and-hold to break the wax |
| `/join` | guest phone | The parlour: SCREAM (tap or microphone), whispers + emoji, spirit photographs |

## Run of show (`phase` = one DB row, broadcast to all screens)
1. **gates** — the manor façade: 120 windows, one per room; each broken seal lights one (residents' rooms glow gold on the top floors); giant QR; "Just arrived · Room 047 · East Wing"; spirit-photo strip; trick-or-treaters strolling the bottom edge; moon, fog, bats, the odd lightning strike
2. **storm** — house lights down, wind, a strike shows the manor for the first time, the iron gates creak open, the camera pushes in through the door; runs on automatically
3. **midnight** — the tower clock's last five strokes, a toll each; on twelve, lightning and bats; runs on
4. **ident** — the team's own "Party People" ident film through a burst of TV static; runs on
5. **title** — "Manor 09 presents · The Haunting" with organ + keeper; waits for the host
6. **seance** — the spirit board: the keeper asks for a sign, the planchette spells S-E-P-T-E-M-B-E-R, then 27, then slides to YES as the candles gutter; waits for the host
7. **gallery** — 27 × ~25s: three knocks on the door of their room → the door creaks open on a dust-sheeted gilt frame → lightning, the sheet whips off → the portrait lives (breathing, varnish, sheen) → title, plaque line, "Known by day as…", keeper reads it
8. **scream** — the fear-o-meter (a thermometer with an eye for a bulb) driven by every phone; at peak: THE MANOR TREMBLES — the stage shakes, lightning, bats, confetti
9. **guestbook** — the makers, the residents, the guests' last words, "Cake in the crypt", post-credits "Party People will return in November"

Candy break (`c`): a trick-or-treat snipe over any phase — pumpkin, ghost and black cat on parade, candy raining, nonsense captions.

## Wow factors (ranked, in scope)
1. The manor lighting up window by window as seals break at the gate
2. Press-and-hold to break a wax seal: cracks that draw in one by one with haptic ticks, heals if let go, shatters into shards, the flap lifts, the letter rises, a bat escapes
3. The storm → midnight → ident opening as one piece, with sound
4. 27 no-face portraits in gilt frames, each revealed with knocks, a creaking door and lightning
5. The séance: a planchette that actually spells, with whispers
6. A room-wide scream measured by phone microphones (tap fallback), pinning a meter until the manor trembles
7. Spirit photographs: every guest photo developed as a Victorian spirit photo on the phone before upload
8. Fog, bats, lightning, candles, cobwebs, moon on every phase; thunder, wind, creaks, bells, organ, wolves, whispers, all synthesised
9. The guest book with the guests' whispers; the candy-break parade

Out of scope: WebGL, Wallet passes, usher scanner, awards voting.

## Stack
Next.js 16 (App Router, TS) on Vercel · Supabase (Postgres + Storage; all objects prefixed `m09_`) · canvas-confetti · qr-code-styling · WebAudio synthesis (no audio assets needed) · Higgsfield `nano_banana_pro` for the art.

Principles carried over from Studio 09: local-first interactions (the seal always breaks, the enter call is retried) · `/screen` and `/host` poll, guest phones only POST (100+ guests, no sockets) · rooms server-assigned and unique (residents keep 1–27, overflow to the crypt) · media preloaded on the projector laptop · transform/opacity-only animation · `prefers-reduced-motion` honoured · rehearsal script + one-click reset.

## Venue (as before)
Projector + speakers, dim not blackout → cream/parchment on near-black, candle-orange and ectoplasm-green accents, heavy type weights, grain and vignette kept light. Fixed 1920×1080 stage scaled to fit; 5% safe margins. Sound is fully in scope; `/host` has mute.

## Art pipeline
27 portraits + 4 backdrops (manor exterior, gatehouse, gallery corridor, séance room) generated with `nano_banana_pro` at 2k (2 credits each, 62 credits total). Prompts: original scenes, the figure always seen from behind / hooded / silhouetted (no faces, so nobody needs to send a photo), no text, lower third kept dark for the HTML title. Two prompts were rejected by the generator's filter (#20) and re-written more gently. `scripts/fetch-generated.mjs` pulls results in; `scripts/portrait-assets.mjs` derives thumbs, blurred room backdrops and accent colours.

Photo tiers from the movie plan still apply if real likenesses are wanted later (A: face-forward stylised portrait from one photo; B: soft likeness; C: no face, what everyone has now).

## Build status
**Built (Sep 23):** scaffold on the Studio 09 engine (stores, PIN, polling, API, rehearsal script, Supabase schema — all renamed for the manor: invites/rooms/screams/whispers) · all five surfaces · the full run of show on `/screen` with synthesised sound · the wax-seal invitation · the parlour with microphone screams and spirit-photo developing · the gate teaser with dust-sheeted frames · 26 of 27 portraits + 4 backdrops generated and processed.

**Next:** portrait #20 (generator keeps rejecting the scene; try again or hand-pick) · organiser's poster-style review at `/host/portraits` · real inside jokes in `src/data/residents.ts` taglines · keeper's voice (pick a voice, record the 37 lines at `/host/script`) · Vercel project + `node scripts/setup-supabase.mjs` · full rehearsal on the real projector with a mid-range Android + iPhone (mic permission prompt, seal hold, haptics).

## Open questions
- Keep "Party People" ident as-is, or cut a Halloween version?
- Which residents want a real-likeness (tier A) portrait? Photo deadline would be Sep 30.

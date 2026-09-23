@AGENTS.md

# Manor 09 · The Haunting

Halloween-themed birthday show for the September birthdays (event night 7 Oct 2026), built on the same engine as the movie-premiere show in `../Movie Themed` (Studio 09). Read [README.md](README.md) for the routes and how to run it, [PLAN.md](PLAN.md) for the concept, run of show and status.

- All event content (residents, titles, plaque lines, keeper's script) lives in `src/data/`. Components never hard-code names.
- `/screen` and `/host` are PIN-gated (`HOST_PIN`; `0909` in dev). The residents' titles and portraits are the surprise: they must not reach any public page before `revealAt` in `src/data/event.ts`.
- `next dev` always uses the file store in `.data/`; production uses Supabase (tables prefixed `m09_`).
- Portrait art is generated with no faces (silhouettes, back views, hooded figures) and no text; titles are laid over it in HTML. Never name real studios, films or characters in image prompts.

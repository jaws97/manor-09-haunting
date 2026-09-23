# Keeper voice samples

Three candidates for the keeper of the manor, each reading the "gates" cue (ElevenLabs engine via Higgsfield `text2speech_v2`, ~0.6 credits a line):

| File | Voice | Notes |
|---|---|---|
| `1-Arthur.mp3` | Arthur | deep, measured |
| `2-Desmond.mp3` | Desmond | warm, theatrical |
| `3-Cillian.mp3` | Cillian | lighter, sinister |

Pick one, then the 37 lines at `/host/script` get generated in that voice and dropped into `public/media/vo/<id>.mp3`. Until then the browser's speech voice reads the lines, slow and low.

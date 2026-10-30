# Built-in background audio

The library contains **no melodic instruments**.

- **Daf rhythms** (`daf-zaffa`, `daf-gentle`, `daf-festive`): short, looping
  frame-drum and hand-clap patterns, about 40 seconds each (64 kbps mono MP3,
  around 320–340 KB). They are original and were synthesised from code by
  `tools/generate-tones.mjs`; no samples or recordings by others are used.
  They are free to use, share and modify (CC0 1.0).

- **Vocal nasheeds** (`nasheed-*`): about 40 seconds each, vocals with a
  light daf only. The lyrics are public-domain texts (the Prophet's ﷺ wedding
  du'a and traditional nasheeds). The recordings were made with ElevenLabs
  Music by the project owner and are distributed under the terms of their
  ElevenLabs plan; see ElevenLabs' terms for attribution or commercial-use
  requirements. They are converted to 80 kbps mono MP3 at about −17 LUFS.

Regenerate the daf rhythms with `node tools/generate-tones.mjs` (requires ffmpeg).

# AI Radio Show Creator

An AI-assisted radio production studio. Scan your local audio library, analyze tracks with Gemini, let AI craft a professional radio show — complete with DJ voice announcements and custom transitions — then render the finished broadcast as a ready-to-air audio file.

Built as a single full-stack app: an Express API server with a React (Vite) frontend served from the same port.

## Features

- **Library scanning** — point the app at any folder (internal disk, external drive, uploads); it walks the tree, probes duration/BPM/metadata with ffprobe, and tracks adds/changes/removals incrementally. Scans can be paused, resumed, and cancelled.
- **AI track analysis** — Gemini enriches each track with genre, subgenre, mood, energy, era, and rotation category.
- **AI show generation** — describe the vibe you want ("high-energy rave with a mid-show peak") and Gemini picks tracks, orders them, writes DJ scripts, and configures transitions.
- **Voice Studio** — generate DJ announcements with Gemini TTS (multiple voice personalities), cached to disk, with a radio-style compressor/limiter chain.
- **Show Builder & Timeline** — arrange tracks, intros/outros/station IDs, and per-transition settings (crossfade, beat-match, cut with pause).
- **Render engine** — ffmpeg-based mixdown with EBU R128 broadcast loudness normalization, ID3 tagging, MP3/WAV output, and progress-tracked render jobs.

Everything degrades gracefully: with no `GEMINI_API_KEY` the app falls back to deterministic heuristics and synthetic voice beds, so you can try it fully offline.

## Quick start

Requirements: **Node.js 20+** and npm. No system ffmpeg needed — static ffmpeg/ffprobe binaries are installed automatically with the npm packages.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

On first boot the app:
1. creates its SQLite database (`storage/radio_studio.sqlite`),
2. synthesizes a small demo library of electronic tracks into `storage/sample_audio/` (~5 tracks, a few seconds),
3. registers and scans that folder, and
4. shows a starter demo show ("Null Sector Sessions #001") built from those tracks.

Add your own music via the **Library → Scan** dialog (any local folder) or by uploading files.

### Enabling AI features

Copy your Gemini API key into `.env` (create it from `.env.example`):

```bash
cp .env.example .env
# then edit .env:
# GEMINI_API_KEY="your-key-here"
```

Get a key at [Google AI Studio](https://aistudio.google.com/apikey). Without a key the app still works — track analysis, show generation, and voice synthesis use built-in fallbacks.

### Optional: use your own ffmpeg

The app resolves ffmpeg/ffprobe in this order:

1. `FFMPEG_PATH` / `FFPROBE_PATH` environment variables,
2. npm-bundled static binaries (`@ffmpeg-installer/ffmpeg`, `@ffprobe-installer/ffprobe`),
3. whatever `ffmpeg`/`ffprobe` is on your `PATH`.

## Scripts

| Command           | What it does |
| ----------------- | ------------ |
| `npm run dev`     | Start the Express server with Vite middleware (dev mode, port 3000) |
| `npm run build`   | Build the frontend (`dist/`) and bundle the server (`dist/server.cjs`) |
| `npm start`       | Run the production bundle (`node dist/server.cjs`) |
| `npm run lint`    | TypeScript check (`tsc --noEmit`) |
| `npm run clean`   | Remove build output |

## Architecture

```
server.ts                     Express bootstrap: JSON body limits, DB init, sample
                              library, /api routes, Vite middleware (dev) or
                              static dist/ (prod). Listens on 0.0.0.0:3000.
server/
  routes.ts                   All /api endpoints (folders, scan, assets, uploads,
                              streaming, AI, voice, shows, renders)
  db.ts                       sql.js (SQLite) persistence: folders, assets, shows,
                              announcements, transitions, render jobs
  scanner.ts                  Folder walker with pause/resume/cancel + progress
  audio_probe.ts              ffprobe-based metadata extraction + filename heuristics
  gemini.ts                   Gemini integration: track analysis, show generation,
                              announcements scripting, TTS with on-disk cache
  renderer.ts                 ffmpeg concat + loudnorm mixdown, render job tracking
  sample_generator.ts         Synthesizes the demo library on first boot
  binaries.ts                 ffmpeg/ffprobe resolution (env override → bundled → PATH)

src/                          React 19 + Tailwind frontend
  App.tsx                     Global state, tab routing, scanner polling
  components/                 Dashboard, Library, Shows, Show Builder, Timeline,
                              Voice Studio, Render, Settings, Sidebar, TransportBar,
                              scan & transition modals
  context/AudioPlayerContext  Shared audio playback engine
  services/api.ts             Typed fetch wrappers for the /api endpoints
  types.ts                    Shared types between client and server

storage/                      Runtime state (gitignored, auto-generated)
  radio_studio.sqlite         Library / shows / render-job database
  sample_audio/               Demo tracks (synthesized on first boot)
  uploads/                    User-uploaded audio
  voice_cache/                Cached TTS announcements
  renders/                    Rendered broadcast files + temp concat lists
```

## API overview

All endpoints live under `/api`. Highlights:

- `GET /api/system/status` — health, Gemini key presence, scanner state
- `GET|POST|DELETE /api/folders…` — library folders (+ `/validate`, `/presets`)
- `POST /api/scan/start|pause|resume|cancel`, `GET /api/scan/status` — scanning
- `GET /api/assets`, `POST /api/assets/upload` — track library & uploads
- `GET /api/audio/stream?path=…` — range-request audio streaming
- `POST /api/ai/analyze-track | generate-show | generate-announcements`
- `POST /api/voice/synthesize`, `GET /api/voice/file/:filename`
- `GET|POST|DELETE /api/shows…`
- `POST /api/render/start`, `GET /api/render/jobs`, `GET /api/renders/file/:filename`

## Troubleshooting

- **Everything looks generic / no AI text** — `GEMINI_API_KEY` is missing or empty; check `.env` and restart.
- **Render fails** — check the render job log in the Render tab; the ffmpeg invocation is logged server-side. Try setting `FFMPEG_PATH`/`FFPROBE_PATH` if you suspect the bundled binary.
- **Want a clean slate** — stop the server and delete the `storage/` directory; the app regenerates the DB and demo library on next boot.
- **Port already in use** — the port is set in `server.ts` (`PORT`).

## Notes

- Originally scaffolded as a Google AI Studio applet; `.env.example` documents the variables AI Studio injects automatically (`GEMINI_API_KEY`, `APP_URL`). For local development a plain `.env` works.
- The bundled ffmpeg is a static community build; swap in your own via `FFMPEG_PATH` if you need specific encoders.

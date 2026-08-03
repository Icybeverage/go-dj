# Go DJ!

Go DJ! is a mobile-first two-deck DJ interface with camera gestures, a
Convex-backed command queue, and a native Mixxx bridge. The repository exists
to make the integration boundary explicit: JamBase supplies festival metadata,
Supabase keeps the JamBase API key server-side and stores authorized audio,
Convex owns the catalog and command state, and Mixxx remains the native audio
engine.

## Data flow

```text
JamBase Data API v3
        │  server-side Bearer key
        ▼
Supabase Edge Function: jambase-outside-lands
        │  normalized lineup snapshot
        ▼
Convex action + 12-hour cron
        ├── festivalArtists / festivalSnapshots
        ├── tracks (verified playable files + BPM)
        └── mixxxCommands (canonical control payloads)
                │
                ▼
        Go DJ! web UI → local relay → Mixxx MIDI/controller mapping
```

## What JamBase does—and does not do

JamBase is the live event and artist metadata source. The Supabase function
queries the Outside Lands event, keeps the API key out of the browser, and
returns the current lineup with performance dates, billing order, genres,
headliner status, and JamBase IDs.

JamBase does not provide MP3 downloads. Audio must be supplied through files we
own, have permission to use, or are licensed to redistribute. Those files are
uploaded to the `outsidelands` Supabase Storage bucket, then registered in
Convex `tracks` with their file path, BPM, and optional analysis metadata. A
lineup artist without an uploaded file is catalog metadata only and cannot be
loaded into the player.

## Repository layout

- `src/` — Go DJ web dashboard, browser audio engine, MediaPipe controls, and
  Convex client.
- `convex/` — schema, track catalog, festival catalog, JamBase refresh action,
  Mixxx command queue, and the scheduled refresh.
- `supabase/functions/jambase-outside-lands/` — read-only JamBase proxy. The
  secret is read from Supabase `jambase`; no API key is committed or sent to
  the frontend.
- `mixxx-bridge/` — native adapter, Convex command poller, and real Mixxx
  controller mapping files.
- `scripts/sync-outsidelands-live.mjs` — one-shot live sync for development or
  an operator-run refresh.
- `test/` — control mapping and protocol tests.

## Local development

```sh
npm ci
npm test
npm run build
npm run dev
```

Convex functions are deployed from the `convex/` directory with the Convex
CLI. Set `CONVEX_URL` for the target deployment before running the live sync:

```sh
node scripts/sync-outsidelands-live.mjs
```

The Supabase function is deployed with the Supabase CLI. Configure the
`jambase` secret in the Supabase project before deploying; never put that
value in Vite environment variables or source control.

## Native Mixxx boundary

The browser can preview authorized Supabase audio and emit canonical Mixxx
commands, but it cannot call Mixxx's native `engine` object. The local relay
claims Convex commands and sends them through the Go DJ! Mixxx controller
mapping. See [`mixxx-bridge/README.md`](mixxx-bridge/README.md) for the native
setup and the dry-run path for VMs without ALSA MIDI.

## Attribution

The UI and catalog retain a link to the JamBase festival page. Production
deployments should follow JamBase's attribution and event-linking requirements.

# Go DJ!

Go DJ! is a universal two-deck DJ control surface with a performance camera,
gesture controls, a Convex-backed session/command plane, and an open-source
Mixxx bridge. Catalog providers are replaceable: Supabase keeps provider keys
server-side and stores authorized audio, Convex owns live session state, and
Mixxx remains the native audio engine.

## Data flow

```text
Any catalog source (JamBase is optional)
        │  server-side Bearer key
        ▼
Supabase Edge Function: jambase-outside-lands
        │  normalized lineup snapshot
        ▼
Convex action + 12-hour cron
        ├── djSessions / djDecks / gestureEvents
        ├── catalogs / catalogItems
        ├── festivalArtists / festivalSnapshots (JamBase view)
        ├── tracks (verified playable files + BPM)
        └── mixxxCommands (canonical control payloads)
                │
                ▼
        Go DJ! web UI or Android APK → local relay → Mixxx MIDI/controller mapping
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
- `convex/` — universal sessions, deck/mixer state, gesture telemetry,
  catalog APIs, track catalog, JamBase refresh action, Mixxx command queue, and
  the scheduled refresh.
- `supabase/functions/jambase-outside-lands/` — read-only JamBase proxy. The
  secret is read from Supabase `jambase`; no API key is committed or sent to
  the frontend.
- `mixxx-bridge/` — native adapter, Convex command poller, and real Mixxx
  controller mapping files.
- `scripts/sync-outsidelands-live.mjs` — one-shot live sync for development or
  an operator-run refresh.
- `test/` — control mapping and protocol tests.
- `mobile/` — Capacitor Android control-surface build instructions.

## Local development

```sh
npm ci
npm test
npm run build
npm run dev
```

Convex functions are deployed from the `convex/` directory with the Convex
CLI, which generates local type references as part of deployment. Set
`CONVEX_URL` for the target deployment before running the live sync; the
operator script uses Convex's dynamic API reference so generated files do not
need to be committed:

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

## Android shell

The Android app bundles the performance camera and gesture/control surface as a
Capacitor APK. It uses the same Convex session key and command protocol as the
web dashboard. The APK is intentionally a remote control for a desktop or
Linux Mixxx engine; see [`mobile/README.md`](mobile/README.md) for the build and
pairing boundary.

## Attribution

The UI and catalog retain a link to the JamBase festival page. Production
deployments should follow JamBase's attribution and event-linking requirements.

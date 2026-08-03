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
own, have permission to use, or are licensed to redistribute. Those files can
be uploaded to the `outsidelands` Supabase Storage bucket, or uploaded by a
user through the browser to Convex File Storage. Both paths are registered in
Convex `tracks` with their storage reference, BPM, and optional analysis
metadata. User uploads are scoped to the browser's session key; a lineup artist
without an uploaded file is catalog metadata only and cannot be loaded into
the player.

## Repository layout

- `src/` — Go DJ web dashboard, browser audio engine, MediaPipe controls, and
  Convex client.
- `convex/` — universal sessions, deck/mixer state, gesture telemetry,
  catalog APIs, track catalog, JamBase refresh action, Mixxx command queue, and
  the scheduled refresh.
- `supabase/functions/jambase-outside-lands/` — read-only JamBase proxy. The
  secret is read from Supabase `jambase`; no API key is committed or sent to
  the frontend.
- `mixxx-bridge/` — desktop native adapter, Convex command poller, and real
  Mixxx controller mapping files.
- `third_party/mixxx/` — pinned upstream Mixxx source used by the Android
  build; update this gitlink deliberately when upgrading Mixxx.
- `mixxx-native/` — the reproducible Go DJ! overlay for Mixxx's QML skin,
  camera permission, and Android build validation.
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

## Android Mixxx target

The Android deliverable is built from the pinned upstream Mixxx source in
`third_party/mixxx`; it is the Mixxx audio engine and QML application, not a
web wrapper. `mixxx-native/apply-overlay.sh` applies the reusable Go DJ!
performance surface to the upstream QML skins. The surface uses real Mixxx
`ControlProxy` objects for deck play, BPM sync, quick-effect parameters, the
master crossfader, and reset, so those controls operate on Mixxx's engine.

The surface also embeds a mirrored Qt Multimedia camera preview. Android
declares camera access as optional hardware and requests access only when the
user taps `ALLOW`; the surface can be moved and pinched to resize. It is
festival-agnostic and can sit on top of any Mixxx library or controller.

Run the official source integration checks locally with
`mixxx-native/validate-source.sh`. The full arm64 APK build is defined in
`.github/workflows/android-mixxx.yml`; Mixxx's official Android dependency
bundle is large, so CI is the reproducible build machine. The existing
Convex session/command plane remains the cross-device backend and the desktop
relay remains available for remote control. The native surface controls the
local Mixxx engine directly; embedding a Convex client inside Mixxx itself is
kept as a separate transport boundary rather than pretending the web SDK is a
native audio engine.

## Attribution

The UI and catalog retain a link to the JamBase festival page. Production
deployments should follow JamBase's attribution and event-linking requirements.

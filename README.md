# Go DJ!

Go DJ! is a universal two-deck DJ control surface with a performance camera,
gesture controls, a Convex-backed session/command plane, and an open-source
Mixxx bridge. Catalog providers are replaceable, Convex owns live session
state, and Mixxx remains the native audio engine.

## Data flow

```text
Any catalog source (JamBase is optional)
        │  server-side provider adapter
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

## JamBase + Convex integration map

This repository deliberately separates event metadata, audio storage, and live
DJ state so each system has a clear job:

| System | Role in Go DJ! | Where to inspect it |
| --- | --- | --- |
| JamBase | Supplies Outside Lands event, artist, schedule, billing, genre, and source-link metadata. It is not an audio-download provider. | `convex/jambase.ts` |
| Object storage | Provides authorized audio files that are registered in the Go DJ! track catalog. | `src/data/songs.js`, `convex/tracks.ts` |
| Convex | Owns reactive sessions, deck state, gesture telemetry, catalog snapshots, playable track metadata, user-upload registration, and the canonical Mixxx command queue. | `convex/schema.ts`, `convex/sessions.ts`, `convex/tracks.ts`, `convex/mixxx.ts` |
| Go DJ! web UI | Reads lineup and playable tracks with Convex queries, sends controls with Convex mutations, and renders the browser audio deck/waveform. | `src/app/App.jsx`, `src/components/dj/Deck.jsx` |
| Mixxx bridge/APK | Consumes the canonical Convex command payloads and applies them to real Mixxx controls. | `mixxx-bridge/`, `mixxx-native/` |

The live path is therefore:

```text
JamBase event metadata
  → server-side provider adapter (secret stays server-side)
  → Convex festival snapshot + artist catalog
  → Go DJ! lineup/library queries

Authorized audio file
  → configured object storage or Convex File Storage
  → Convex tracks record (file, BPM, source, session scope)
  → browser deck / real Mixxx bridge

Gesture or touch control
  → Convex session state + command queue
  → desktop relay or Android Mixxx surface
```

Convex is not being used as a proxy for JamBase or as the browser's audio
engine. It is the shared state and control layer: the browser and native Mixxx
surface can observe the same session, while audio stays local to the browser or
Mixxx engine. The web deck uses wavesurfer.js for the track waveform while its
existing Web Audio graph handles filters, pitch/keylock, effects, and levels.

## What JamBase does—and does not do

JamBase is the live event and artist metadata source. The server-side provider
adapter keeps the API key out of the browser and returns the current lineup
with performance dates, billing order, genres, headliner status, and JamBase
IDs.

JamBase does not provide MP3 downloads. Audio must be supplied through files we
own, have permission to use, or are licensed to redistribute. Those files can
be uploaded to configured object storage, or uploaded by a user through the
browser to Convex File Storage. Both paths are registered in
Convex `tracks` with their storage reference, BPM, and optional analysis
metadata. User uploads are scoped to the browser's session key; a lineup artist
without an uploaded file is catalog metadata only and cannot be loaded into
the player.

## Repository layout

- `src/` — Go DJ web dashboard, browser audio engine, MediaPipe controls, and
  Convex client. `Deck.jsx` uses wavesurfer.js against each existing audio
  element, so waveform interaction does not create a second playback stream.
- `convex/` — universal sessions, deck/mixer state, gesture telemetry,
  catalog APIs, track catalog, JamBase refresh action, Mixxx command queue, and
  the scheduled refresh.
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

## Native Mixxx boundary

The browser can preview authorized audio and emit canonical Mixxx commands,
but it cannot call Mixxx's native `engine` object. The local relay claims
Convex commands and sends them through the Go DJ! Mixxx controller mapping.
See [`mixxx-bridge/README.md`](mixxx-bridge/README.md) for the native setup
and the dry-run path for VMs without ALSA MIDI.

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

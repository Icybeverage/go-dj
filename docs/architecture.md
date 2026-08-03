# Go DJ! backend architecture

## Ownership boundaries

| Concern | System of record | Why |
| --- | --- | --- |
| Festival lineup, dates, billing, artist IDs | JamBase Data API | Live event metadata |
| API-key protection and normalized HTTP endpoint | Supabase Edge Function | The browser never receives the JamBase key |
| Lineup cache and refresh history | Convex `festivalArtists` and `festivalSnapshots` | Reactive UI data and auditable snapshots |
| Universal DJ session state | Convex `djSessions`, `djDecks`, and `gestureEvents` | Realtime cross-device control surface state |
| Generic provider catalogs | Convex `catalogs` and `catalogItems` | JamBase, playlists, and future providers share one model |
| Playable audio metadata | Convex `tracks` | BPM, file path, source, and future analysis fields |
| Authorized festival audio bytes | Supabase Storage | Public playback URLs for files we are licensed to use |
| User-uploaded audio bytes | Convex File Storage | Session-scoped uploads from the Go DJ! library |
| DJ control intent | Convex `mixxxCommands` | Durable command queue between browser and native sidecar |
| Audio engine | Upstream Mixxx | Native playback, effects, sync, and mixer controls |

## Native Android boundary

The website is intentionally Outside Lands-based. The Android target is
universal: it is a real upstream Mixxx Android build with a small Go DJ!
overlay, so the same camera/control surface can be reused with any library or
festival.

`third_party/mixxx` pins the upstream source commit. The overlay in
`mixxx-native/patches` adds the optional Android camera permission and places
`GoDjCameraSurface.qml` on both upstream QML entry points. The component uses
Mixxx `ControlProxy` controls for deck play, `sync_enabled`, quick-effect
`super1`, and `[Master] crossfader`; the camera preview is a Qt Multimedia
`Camera`/`CaptureSession`/`VideoOutput` surface with user-controlled activation.

The Convex data model remains universal and owns session state, gesture events,
and durable command intents. The desktop relay translates those intents into
Mixxx's native mapping. The Android overlay's local controls write directly to
Mixxx's engine; a native Convex transport should be added only at the explicit
pairing boundary, using the same `mixxx-command-v1` contract, rather than
shipping the browser Convex client inside the audio process.

## Session and command flow

Each browser or Android device creates or joins a `sessionKey`. Convex stores
the canonical mixer/deck state and appends every control intent to
`mixxxCommands`. The local relay claims those commands and delivers the
`mixxx-command-v1` payload to Mixxx's native mapping. Browser audio remains a
local preview; the native Mixxx process is the authoritative audio engine when
the bridge is connected.

The current session key is a development pairing mechanism, not user
authentication. Public distribution should replace it with an authenticated
invite or an OIDC-backed Convex identity before allowing arbitrary remote
control.

## JamBase refresh

`supabase/functions/jambase-outside-lands/index.ts` calls the JamBase v3
`/events` feed with a fixed Outside Lands date window. It returns the raw event
payload plus normalized performers. The key is read from the Supabase secret
named `jambase`.

`convex/jambase.ts` calls that proxy and ingests the normalized records through
`festivals.upsertCatalog`. `convex/crons.ts` runs the action every twelve hours.
The mutation removes stale lineup rows for this festival so the Convex count
matches the current JamBase response instead of accumulating renamed records.

## Audio ingest contract

JamBase records are not audio licenses. The ingest boundary intentionally
requires an authorized file before a track is playable:

1. Obtain an MP3 through ownership, permission, a licensed promo, or a
   redistribution-compatible license.
2. Upload it to the `outsidelands` bucket, or use the library's Convex upload
   control for a session-scoped personal track.
3. Register the object in `tracks` with its storage reference and BPM.
4. Run analysis and attach `mediaAnalyses` when available.
5. The Go DJ! library exposes load/play buttons only for records with a file
   path and verified playback.

This keeps the JamBase catalog broad without pretending that event metadata is
permission to copy or redistribute commercial recordings.

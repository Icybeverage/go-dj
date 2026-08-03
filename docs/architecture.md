# Go DJ! backend architecture

## Ownership boundaries

| Concern | System of record | Why |
| --- | --- | --- |
| Festival lineup, dates, billing, artist IDs | JamBase Data API | Live event metadata |
| API-key protection and normalized HTTP endpoint | Supabase Edge Function | The browser never receives the JamBase key |
| Lineup cache and refresh history | Convex `festivalArtists` and `festivalSnapshots` | Reactive UI data and auditable snapshots |
| Playable audio metadata | Convex `tracks` | BPM, file path, source, and future analysis fields |
| Audio bytes | Supabase Storage | Public playback URLs for files we are licensed to use |
| DJ control intent | Convex `mixxxCommands` | Durable command queue between browser and native sidecar |
| Audio engine | Mixxx | Native playback, effects, sync, and mixer controls |

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
2. Upload it to the `outsidelands` bucket.
3. Register the object in `tracks` with its exact storage path and BPM.
4. Run analysis and attach `mediaAnalyses` when available.
5. The Go DJ! library exposes load/play buttons only for records with a file
   path and verified playback.

This keeps the JamBase catalog broad without pretending that event metadata is
permission to copy or redistribute commercial recordings.

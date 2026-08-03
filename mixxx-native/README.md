# Native Mixxx integration

This directory is the integration boundary between Go DJ! and the real
upstream Mixxx Android application.

## Pinned source

The repository pins `third_party/mixxx` to:

```text
14f3ccaaf3787330b07c45b959d7ed0a5b96c201
```

That commit is from the upstream Mixxx `main` branch and includes Mixxx's
official Qt 6/QML Android build path. Keep the pin explicit so a Mixxx update
cannot silently change the native control surface.

## Overlay

`apply-overlay.sh` verifies the pin, checks that the submodule is clean, applies
the small source patch, and copies the two camera QML components into Mixxx's
resource tree. The multimedia capture component is deferred until the user
requests camera access, so Mixxx can boot on devices without a camera provider.
The overlay is deliberately independent of Outside Lands: it
adds a universal performance camera and touch control surface to the Mixxx
application.

The surface is wired to actual Mixxx controls:

- `[Channel1] play` and `[Channel2] play`
- `[Channel1] sync_enabled` and `[Channel2] sync_enabled`
- `[QuickEffectRack1_[Channel1]] super1` and the Channel 2 equivalent
- `[Channel1] pitch_adjust` and `[Channel2] pitch_adjust` with `keylock` enabled for speed-locked frequency changes
- `[Master] crossfader`
- `[Recording] status` and `[Recording] toggle_recording`

The native surface now exposes the same pitch behavior as the website: the
pitch control uses Mixxx's independent `pitch_adjust` control over ±3
semitones and forces keylock on, so transport speed changes only come from
sync or the normal rate control. Its handoff buttons start and sync the target
deck, then after 220 ms move the real crossfader to the target endpoint and
stop the source deck. The target track must already be loaded in Mixxx; native
MediaPipe hand tracking and automatic library-next selection remain web-side
until a native tracker/library bridge is added.

The surface also includes a `REC MP3` control. It calls Mixxx's native
recording manager, selects the built-in LAME MP3 encoder, and creates a
timestamped file in `Music/Mixxx/Recordings` when Android permits that public
folder. If public storage is unavailable, Mixxx falls back to its private app
data recordings directory. The status button shows the native recording
duration and becomes `STOP REC` while the engine is active.

It also declares optional camera hardware, includes `android.permission.CAMERA`,
and shows the mirrored Qt Multimedia preview after the user taps `ALLOW`.
The patch resolves Mixxx's Android 15-only performance-hint preference call at
runtime, so an API 35-targeted build can still launch on API 34 devices.

The Android surface stores its Convex session key in Qt `Settings`, refreshes
the session periodically, and refreshes it when the app returns from sleep.
The camera is released while the app is backgrounded so emulator camera
providers do not hold stale resources across resume. Android also disables
quit-on-last-window-closed; a temporary window loss now suspends the activity
instead of terminating the Mixxx event loop.

## Checks and build

```sh
./mixxx-native/validate-source.sh
./mixxx-native/apply-overlay.sh
```

The full APK build runs in
`.github/workflows/android-mixxx.yml` using Mixxx's own
`tools/android_buildenv.sh` and arm64 Android CMake matrix. The build needs the
official Mixxx dependency archive and Android SDK/NDK; it is intentionally not
replaced by a Capacitor or WebView wrapper.

The Go DJ! web dashboard and Convex backend remain separate from Mixxx's audio
process. Convex stores the universal session and command contract; the desktop
relay consumes that contract, while this native overlay gives Android local
controls that write directly to Mixxx's engine.

## Licensing

Mixxx is GPL-licensed. Review and preserve the upstream `COPYING` and
contributor notices when distributing an APK based on this source.

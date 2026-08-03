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
the small source patch, and copies `qml/GoDjCameraSurface.qml` into Mixxx's
resource tree. The overlay is deliberately independent of Outside Lands: it
adds a universal performance camera and touch control surface to the Mixxx
application.

The surface is wired to actual Mixxx controls:

- `[Channel1] play` and `[Channel2] play`
- `[Channel1] sync_enabled` and `[Channel2] sync_enabled`
- `[QuickEffectRack1_[Channel1]] super1` and the Channel 2 equivalent
- `[Master] crossfader`

It also declares optional camera hardware, includes `android.permission.CAMERA`,
and shows the mirrored Qt Multimedia preview after the user taps `ALLOW`.
The patch resolves Mixxx's Android 15-only performance-hint preference call at
runtime, so an API 35-targeted build can still launch on API 34 devices.

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

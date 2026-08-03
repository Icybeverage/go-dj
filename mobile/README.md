# Go DJ! Android control surface

This is the Android shell for the universal Go DJ! control surface. It bundles
the same web UI, performance camera, MediaPipe gesture widget, and Convex
session client as the desktop site.

The APK is a remote control for an open-source Mixxx instance. The actual
Mixxx audio engine remains on the desktop/Linux host, where the native bridge
can access Mixxx's `engine` API and local audio devices. The phone sends
canonical `mixxx-command-v1` intents to Convex; the local relay claims them and
forwards them to Mixxx. This keeps the Android build useful with any catalog or
festival source instead of hard-coding Outside Lands.

## Build

From the repository root:

```sh
npm ci
npm run build
npx cap sync android
npx cap open android
```

For a command-line debug APK on a machine with Android SDK/Gradle installed:

```sh
npx cap sync android
cd android
./gradlew assembleDebug
```

The resulting APK is under `android/app/build/outputs/apk/debug/`.

Camera permission is declared in the Android manifest. The first camera use
still requires the normal Android permission prompt; HTTPS/secure WebView
access is required for the browser camera API.

## Pairing model

Both the web dashboard and APK use the same `go-dj-session-key` stored on the
device. A future pairing screen should replace that local key with an
authenticated session invite before public distribution. The current backend
is intentionally a development control plane and does not claim end-user
authentication.

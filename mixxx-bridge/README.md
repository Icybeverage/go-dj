# Go DJ! native Mixxx bridge

This directory is the boundary between the browser dashboard, Convex, and
the native Mixxx engine.

## What is real today

- The dashboard sends `mixxx-command-v1` payloads to the Convex `mixxxCommands`
  queue.
- Every canonical Mixxx control includes a group/key pair such as
  `[Channel1]` + `play`, `[Master]` + `crossfader`, or
  `[QuickEffectRack1_[Channel1]]` + `super1`.
- `go-dj-controller.js` is a native Mixxx controller-mapping layer. When it is
  loaded by Mixxx, it uses Mixxx's real `engine.setValue(group, key, value)`
  API. It is not browser code and must not be bundled by Vite.
- `poll-commands.mjs` is the Convex relay worker. It claims pending commands
  and forwards the protocol payload to a local native adapter over HTTP.
- `native-adapter.py` opens a real virtual MIDI port and translates the
  dashboard's MIDI metadata into messages that Mixxx's XML mapping consumes.
- `go-dj-convex.midi.xml` maps those messages to Mixxx's actual deck, mixer,
  filter, pitch, keylock, sync, seek, cue, and effect controls.

## Runtime boundary

Convex is the durable command relay; it is not the audio engine. A local
sidecar still needs to do this loop:

1. Poll or subscribe to `mixxx.pending` with the Convex client.
2. Claim a command, parse `argsJson`, and pass the payload to the native
   Mixxx mapping through the selected local transport (virtual MIDI, OSC, or
   an app-side IPC channel).
3. Acknowledge the command as `done` only after Mixxx accepts it; release it
   back to `pending` if the native adapter is unavailable.

Start the native adapter first:

```sh
/usr/bin/python3 mixxx-bridge/native-adapter.py
```

Then enable `Go DJ! Convex Virtual MIDI` in Mixxx's Preferences → Controllers.
The adapter creates that virtual MIDI port for Mixxx to receive.

Run the Convex relay with:

```sh
GODJ_CONVEX_URL="https://your-deployment.convex.cloud" \
GODJ_ADAPTER_URL="http://127.0.0.1:8787/mixxx" \
node mixxx-bridge/poll-commands.mjs
```

The adapter endpoint is intentionally explicit: it is the desktop/native
piece that sends messages to the native Mixxx mapping. No browser page can
provide Mixxx's native `engine` object by itself.

For protocol-only testing on a VM without ALSA MIDI devices, use
`GODJ_MIDI_DRY_RUN=1`; production use requires `/dev/snd/seq`.

The browser cannot directly call Mixxx's `engine` object, and this repository
does not pretend that the native sidecar is already installed or running.

## Native mapping installation

Copy the JavaScript file into the Mixxx controller-mapping directory and pair
it with a controller XML mapping when wiring a physical or virtual MIDI
transport. The mapping is deliberately transport-neutral so the same
`GoDJMixxx.applyPayload(payload)` function can be called by a future desktop
wrapper or sidecar.

Track loading needs one extra native step: Mixxx's engine controls can play,
seek, sync, filter, pitch-adjust, and mix a selected track, but loading an
arbitrary browser path is a library/decoder operation. The current web demo
keeps its preloaded browser audio path and intentionally does not enqueue the
`loadTrackByPath` action for the native queue. A future native library adapter
must select the matching track in Mixxx's library and then issue
`LoadSelectedTrack` or `LoadSelectedTrackAndPlay`.

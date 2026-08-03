#!/usr/bin/env python3
"""Forward Convex Mixxx command payloads to a real Mixxx MIDI mapping.

Mixxx must have the matching ``go-dj-convex.midi.xml`` mapping enabled for
the virtual MIDI port created by this process.
"""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get("GODJ_ADAPTER_HOST", "127.0.0.1")
PORT = int(os.environ.get("GODJ_ADAPTER_PORT", "8787"))
MIDI_PORT_NAME = os.environ.get("GODJ_MIDI_PORT", "Go DJ! Convex Virtual MIDI")
DRY_RUN = os.environ.get("GODJ_MIDI_DRY_RUN") == "1"


def clamp_midi(value):
    return max(0, min(127, int(round(float(value)))))


def send_cc(midi_out, channel, control, value):
    status = 0xB0 + (int(channel) - 1)
    message = [status, int(control), clamp_midi(value)]
    if midi_out is None:
        print(f"dry-run MIDI: {message}")
    else:
        midi_out.send_message(message)


def send_mixxx_control(midi_out, mixxx):
    if not isinstance(mixxx, dict):
        return 0

    midi = mixxx.get("midi") or {}
    channel = midi.get("channel")
    control = midi.get("cc")
    sent = 0
    if channel is not None and control is not None and "value" in midi:
        send_cc(midi_out, channel, control, midi["value"])
        sent += 1

    if midi.get("keylockCc") is not None and midi.get("keylockMidiValue") is not None:
        send_cc(midi_out, channel, midi["keylockCc"], midi["keylockMidiValue"])
        sent += 1

    return sent


class AdapterHandler(BaseHTTPRequestHandler):
    midi_out = None

    def do_POST(self):
        if self.path != "/mixxx":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length))
            if payload.get("protocol") != "mixxx-command-v1":
                raise ValueError("unsupported command protocol")
            args = payload.get("args") or {}
            mixxx = args.get("mixxx") or {}
            if mixxx.get("action") == "loadTrackByPath":
                raise ValueError(
                    "track loading requires Mixxx library selection; browser paths are not engine controls"
                )
            if send_mixxx_control(self.midi_out, mixxx) == 0:
                raise ValueError("command has no MIDI mapping")
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self.send_response(422)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(error)}).encode())
            return

        self.send_response(204)
        self.end_headers()

    def log_message(self, format_string, *args):
        print(format_string % args)


def main():
    midi_out = None
    if not DRY_RUN:
        try:
            import rtmidi

            midi_out = rtmidi.MidiOut()
            midi_out.open_virtual_port(MIDI_PORT_NAME)
        except (ImportError, RuntimeError, OSError) as error:
            raise SystemExit(
                "Unable to open ALSA MIDI. Run this on a host with /dev/snd/seq "
                f"and python3-rtmidi installed: {error}"
            ) from error
    AdapterHandler.midi_out = midi_out
    server = ThreadingHTTPServer((HOST, PORT), AdapterHandler)
    print(f"Convex adapter listening on http://{HOST}:{PORT}/mixxx")
    print(
        "Dry-run mode: no MIDI device opened"
        if DRY_RUN
        else f"Virtual MIDI port: {MIDI_PORT_NAME}"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if midi_out is not None:
            midi_out.close_port()


if __name__ == "__main__":
    main()

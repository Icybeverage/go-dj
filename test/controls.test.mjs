import test from "node:test";
import assert from "node:assert/strict";
import {
  bpmSyncRate,
  filterFrequencyFromControl,
  filterControlFromFrequency,
  handoffCrossfaderValue,
  pinchControlFromRatio,
  pitchSemitones,
} from "../src/features/dj/math.js";
import {
  deckForHand,
  displayHandSide,
  handGesture,
  routeHandsToDecks,
} from "../src/features/gestures/classifier.js";
import {
  MIXXX_COMMAND_PROTOCOL,
  mixxxCommand,
  normalizeMixxxControl,
} from "../src/features/dj/mixxx.js";
import { createCommandQueue } from "../src/services/convex/commands.js";

function points({ extended = [], thumbUp = false } = {}) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.6 }));
  [6, 10, 14, 18].forEach((pip, index) => {
    landmarks[pip].y = 0.4;
    landmarks[[8, 12, 16, 20][index]].y = extended.includes(index) ? 0.2 : 0.58;
  });
  landmarks[0].y = 0.6;
  landmarks[3].y = thumbUp ? 0.35 : 0.45;
  landmarks[4].y = thumbUp ? 0.15 : 0.55;
  return landmarks;
}

test("BPM sync produces a bounded playback rate", () => {
  assert.equal(bpmSyncRate(true, 140, 127), 127 / 140);
  assert.equal(bpmSyncRate(false, 140, 127), 1);
  assert.equal(bpmSyncRate(true, 40, 200), 2);
  assert.equal(handoffCrossfaderValue(1), 1);
  assert.equal(handoffCrossfaderValue(2), 0);
});

test("pitch stays a semitone control and filter mapping is reversible", () => {
  assert.equal(pitchSemitones(0), -3);
  assert.equal(pitchSemitones(50), 0);
  assert.equal(pitchSemitones(100), 3);
  [0, 25, 50, 75, 100].forEach((value) => {
    const frequency = filterFrequencyFromControl(value);
    assert.ok(Math.abs(filterControlFromFrequency(frequency) - value) <= 1);
  });
});

test("pinch maps its compact active range across the full filter control", () => {
  assert.equal(pinchControlFromRatio(0.26), 1);
  assert.equal(pinchControlFromRatio(0.38), 0);
  assert.equal(pinchControlFromRatio(0.32), 0.5);
});

test("hand poses have distinct control modes", () => {
  assert.equal(handGesture(points(), Infinity), "fist");
  assert.equal(handGesture(points({ thumbUp: true }), Infinity), "sync");
  assert.equal(handGesture(points({ extended: [0, 1] }), Infinity), "pitch");
  assert.equal(handGesture(points({ extended: [0] }), 0.3), "pinch");
  assert.equal(handGesture(points({ extended: [0] }), Infinity), "effect");
  assert.equal(
    handGesture(points({ extended: [0, 1, 2, 3] }), Infinity),
    "crossfader",
  );
});

test("handedness routes left to Deck A and right to Deck B", () => {
  assert.equal(deckForHand("Left", 0.9), 1);
  assert.equal(deckForHand("Right", 0.1), 2);
  assert.equal(deckForHand("", 0.2), 1);
  assert.equal(deckForHand("", 0.8), 2);

  const routed = routeHandsToDecks([
    { handSide: "right", visualX: 0.1 },
    { handSide: "left", visualX: 0.9 },
  ]);
  assert.deepEqual(
    routed.map(({ deck }) => deck),
    [2, 1],
  );
});

test("raw camera handedness maps to the mirrored display side", () => {
  assert.equal(displayHandSide("Left"), "right");
  assert.equal(displayHandSide("Right"), "left");
  assert.equal(displayHandSide("unknown"), "");
  assert.equal(deckForHand(displayHandSide("Left")), 2);
  assert.equal(deckForHand(displayHandSide("Right")), 1);
});

test("command payloads carry canonical Mixxx control names", () => {
  const control = normalizeMixxxControl({
    group: "[Channel1]",
    parameter: "play",
    value: 1,
    controls: [{ parameter: "keylock", value: 1 }],
  });
  assert.equal(control.key, "play");
  assert.equal(control.control, "play");
  assert.equal(control.controls[0].group, "[Channel1]");
  assert.equal(control.controls[0].key, "keylock");

  const payload = mixxxCommand("play", { mixxx: control });
  assert.equal(payload.protocol, MIXXX_COMMAND_PROTOCOL);
  assert.equal(payload.command, "play");
});

test("track load intents enter Convex while the native bridge can defer path loading", async () => {
  const calls = [];
  const enqueue = createCommandQueue(async (args) => calls.push(args), {
    sessionKey: "test-session",
    source: "test",
  });
  assert.equal(
    await enqueue("loadTrack", {
      mixxx: { action: "loadTrackByPath", path: "preloaded.mp3" },
    }),
    true,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sessionKey, "test-session");

  await enqueue("play", {
    mixxx: { group: "[Channel1]", control: "play", value: 1 },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].protocol, MIXXX_COMMAND_PROTOCOL);
});

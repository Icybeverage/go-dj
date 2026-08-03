export const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

export const GESTURE_OPTIONS = [
  {
    id: "filter",
    label: "FILTER",
    pose: "Pinch",
    detail: "LP / HP frequency sweep",
  },
  {
    id: "pitch",
    label: "PITCH",
    pose: "Two fingers",
    detail: "Key-locked ±3 ST",
  },
  {
    id: "effect",
    label: "EFFECT",
    pose: "Index only",
    detail: "Echo mix",
  },
  {
    id: "sync",
    label: "SYNC / NEXT",
    pose: "Closed fist",
    detail: "BPM sync · hold for handoff",
  },
  {
    id: "crossfader",
    label: "CROSSFADER",
    pose: "Wave right / left",
    detail: "A → right · B → left · 0–100%",
  },
  { id: "airhorn", label: "AIRHORN", pose: "Head nod", detail: "One-shot cue" },
];

export const defaultGestureOptions = Object.fromEntries(
  GESTURE_OPTIONS.map(({ id }) => [id, true]),
);

export function createGestureState() {
  return {
    last: { pinch: 0, pitch: 0, effect: 0 },
    values: { filter: 0.5, pitch: 0.5, effect: 0 },
    mode: "neutral",
    candidate: "neutral",
    candidateSince: 0,
    fistHoldTimer: null,
    waveX: null,
    waveAccum: 0,
  };
}

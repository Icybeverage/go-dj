export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function deckGroup(deck) {
  return `[Channel${deck}]`;
}

export function bpmSyncRate(enabled, sourceBpm, targetBpm) {
  const source = Number(sourceBpm);
  const target = Number(targetBpm);
  if (!enabled || source <= 0 || target <= 0) return 1;
  return clamp(target / source, 0.5, 2);
}

export function handoffCrossfaderValue(sourceDeck) {
  return Number(sourceDeck) === 1 ? 1 : 0;
}

export function filterStrength(mode, frequency) {
  const normalized = clamp((Number(frequency) - 40) / (18000 - 40), 0, 1);
  return mode === "highpass" ? normalized : 1 - normalized;
}

export function mixxxFilterPosition(mode, frequency) {
  const strength = filterStrength(mode, frequency);
  return mode === "highpass" ? 0.5 - strength * 0.5 : 0.5 + strength * 0.5;
}

export function pitchSemitones(percent) {
  return ((clamp(percent, 0, 100) - 50) / 50) * 3;
}

export function pitchMidiValue(semitones) {
  return Math.round(((clamp(semitones, -3, 3) + 3) / 6) * 127);
}

export function filterMidiValue(mode, frequency) {
  return Math.round(mixxxFilterPosition(mode, frequency) * 127);
}

export function filterFrequencyFromControl(value) {
  return Math.round(40 * Math.pow(18000 / 40, clamp(value, 0, 100) / 100));
}

export function filterControlFromFrequency(value) {
  return Math.round(
    (Math.log(clamp(value, 40, 18000) / 40) / Math.log(18000 / 40)) * 100,
  );
}

// MediaPipe only labels a hand as a pinch while the normalized thumb/index
// distance is below 0.5. Use half of that range so the filter reaches its
// endpoint in half the physical travel.
export function pinchControlFromRatio(ratio) {
  return clamp(1 - (Number(ratio) - 0.26) / 0.12, 0, 1);
}

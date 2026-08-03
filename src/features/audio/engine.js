import { Context as ToneContext, setContext as setToneContext } from "tone";

export const audioEngine = {
  context: null,
  master: null,
  gains: [null, null],
  channelVolumes: [0.8, 0.8],
  crossfader: 0.5,
  masterVolume: 0.8,
};

export function ensureAudioEngine() {
  if (!audioEngine.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioEngine.context = new AudioContextClass();
    setToneContext(new ToneContext(audioEngine.context));
    audioEngine.master = audioEngine.context.createGain();
    audioEngine.master.gain.value = audioEngine.masterVolume;
    audioEngine.master.connect(audioEngine.context.destination);
  }
  return audioEngine;
}

export function applyMixerLevels() {
  const x = audioEngine.crossfader;
  const left = Math.cos((x * Math.PI) / 2);
  const right = Math.cos(((1 - x) * Math.PI) / 2);
  if (audioEngine.gains[0])
    audioEngine.gains[0].gain.value = audioEngine.channelVolumes[0] * left;
  if (audioEngine.gains[1])
    audioEngine.gains[1].gain.value = audioEngine.channelVolumes[1] * right;
}

export function setMixerCrossfader(value) {
  audioEngine.crossfader = Math.max(0, Math.min(1, Number(value) / 100));
  applyMixerLevels();
}

export function setMixerChannelVolume(channel, value) {
  audioEngine.channelVolumes[channel] = Math.max(
    0,
    Math.min(1, Number(value) / 100),
  );
  applyMixerLevels();
}

export function setMixerMasterVolume(value) {
  audioEngine.masterVolume = Math.max(0, Math.min(1, Number(value) / 100));
  if (audioEngine.master)
    audioEngine.master.gain.value = audioEngine.masterVolume;
}

export function triggerAirhorn() {
  const { context, master } = ensureAudioEngine();
  if (context.state === "suspended") context.resume().catch(() => {});
  const start = context.currentTime + 0.015;
  const end = start + 0.62;
  const output = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2300, start);
  filter.Q.value = 1.2;
  output.gain.setValueAtTime(0.0001, start);
  output.gain.exponentialRampToValueAtTime(0.8, start + 0.025);
  output.gain.exponentialRampToValueAtTime(0.0001, end);
  filter.connect(output).connect(master);
  [
    [560, 430],
    [840, 640],
  ].forEach(([from, to], index) => {
    const oscillator = context.createOscillator();
    const voice = context.createGain();
    oscillator.type = index ? "square" : "sawtooth";
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, end);
    voice.gain.value = index ? 0.18 : 0.42;
    oscillator.connect(voice).connect(filter);
    oscillator.start(start);
    oscillator.stop(end + 0.03);
  });
}

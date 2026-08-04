import { Context as ToneContext, setContext as setToneContext } from "tone";
import { AIRHORN_URL } from "../../data/songs";

export const audioEngine = {
  context: null,
  master: null,
  gains: [null, null],
  channelVolumes: [0.8, 0.8],
  crossfader: 0.5,
  masterVolume: 0.8,
};

let airhornAudio = null;
let airhornSource = null;

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

export function preloadAirhorn() {
  const { context, master } = ensureAudioEngine();
  if (!airhornAudio) {
    airhornAudio = new Audio(AIRHORN_URL);
    airhornAudio.preload = "auto";
    airhornAudio.crossOrigin = "anonymous";
    airhornSource = context.createMediaElementSource(airhornAudio);
    airhornSource.connect(master);
    airhornAudio.load();
  }
}

export function triggerAirhorn() {
  const { context } = ensureAudioEngine();
  if (context.state === "suspended") context.resume().catch(() => {});
  preloadAirhorn();
  airhornAudio.currentTime = 0;
  airhornAudio.play().catch(() => {});
}

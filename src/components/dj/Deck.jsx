import React, { useEffect, useRef, useState } from "react";
import { PitchShift } from "tone";
import WaveSurfer from "wavesurfer.js";
import { Icon } from "./Icons";
import { subscribeDjEvents } from "../../features/dj/bus";
import {
  applyMixerLevels,
  audioEngine,
  ensureAudioEngine,
} from "../../features/audio/engine";
import {
  clamp,
  bpmSyncRate,
  deckGroup,
  filterControlFromFrequency,
  filterFrequencyFromControl,
  filterMidiValue,
  filterStrength,
  formatTime,
  mixxxFilterPosition,
  pitchMidiValue,
  pitchSemitones,
} from "../../features/dj/math";

export function Deck({
  number,
  track,
  enqueue,
  autoPlaySignal,
  syncEnabled,
  syncTargetBpm,
  onSyncChange,
}) {
  const audio = useRef(null);
  const filterNode = useRef(null);
  const analyser = useRef(null);
  const pitchShift = useRef(null);
  const channelGain = useRef(null);
  const effectNodes = useRef(null);
  const spectrumFrame = useRef(null);
  const context = useRef(null);
  const waveformContainer = useRef(null);
  const waveSurfer = useRef(null);
  const remoteGesture = useRef({});
  const cuePoint = useRef(0);
  const playingRef = useRef(false);
  const syncRateRef = useRef(1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState("");
  const [filter, setFilter] = useState(18000);
  const [filterMode, setFilterMode] = useState("lowpass");
  const [pitch, setPitch] = useState(50);
  const [effectMix, setEffectMix] = useState(0);
  const [effectiveBpm, setEffectiveBpm] = useState(track?.bpm || 0);
  const [spectrum, setSpectrum] = useState(Array(32).fill(4));

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const node = audio.current;
    if (!node) return undefined;
    const tick = () => {
      const nextDuration = Number.isFinite(node.duration) ? node.duration : 0;
      setDuration(nextDuration);
      setProgress(nextDuration ? node.currentTime / nextDuration : 0);
    };
    const metadata = () => {
      setDuration(Number.isFinite(node.duration) ? node.duration : 0);
      setProgress(0);
    };
    const ended = () => {
      setPlaying(false);
      setProgress(1);
    };
    const failed = () => {
      setPlaying(false);
      setPlaybackError("Audio could not be loaded");
    };
    node.addEventListener("loadedmetadata", metadata);
    node.addEventListener("durationchange", metadata);
    node.addEventListener("timeupdate", tick);
    node.addEventListener("ended", ended);
    node.addEventListener("error", failed);
    return () => {
      node.removeEventListener("loadedmetadata", metadata);
      node.removeEventListener("durationchange", metadata);
      node.removeEventListener("timeupdate", tick);
      node.removeEventListener("ended", ended);
      node.removeEventListener("error", failed);
    };
  }, []);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.pause();
    audio.current.currentTime = 0;
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setPlaybackError("");
    cuePoint.current = 0;
  }, [track?.url]);

  useEffect(() => {
    const container = waveformContainer.current;
    const media = audio.current;

    waveSurfer.current?.destroy();
    waveSurfer.current = null;
    if (container) container.replaceChildren();

    if (!container || !media || !track?.url) return undefined;

    const instance = WaveSurfer.create({
      container,
      media,
      url: track.url,
      height: 56,
      waveColor: number === 1 ? "#2e837d" : "#8150a3",
      progressColor: number === 1 ? "#57e6da" : "#ce8aff",
      cursorColor: "#f5f7fa",
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
      dragToSeek: true,
      hideScrollbar: true,
    });
    waveSurfer.current = instance;

    return () => {
      if (waveSurfer.current === instance) waveSurfer.current = null;
      instance.destroy();
    };
  }, [number, track?.url]);

  useEffect(() => {
    if (!autoPlaySignal || !track?.url) return undefined;
    const timer = window.setTimeout(() => {
      if (!playingRef.current) start();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [autoPlaySignal, track?.url]);

  useEffect(() => {
    if (filterNode.current) {
      filterNode.current.frequency.value = filter;
      filterNode.current.type = filterMode;
    }
    updatePitchProcessor();
    if (effectNodes.current) effectNodes.current.wet.gain.value = effectMix;
  }, [filter, filterMode, pitch, effectMix]);

  useEffect(() => {
    applyBpmSync(syncEnabled, syncTargetBpm);
  }, [track?.url, syncEnabled, syncTargetBpm, pitch]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(spectrumFrame.current);
      pitchShift.current?.dispose?.();
      Object.values(effectNodes.current || {}).forEach((node) =>
        node.disconnect?.(),
      );
      if (audioEngine.gains[number - 1] === channelGain.current)
        audioEngine.gains[number - 1] = null;
    };
  }, [number]);

  function updatePitchProcessor() {
    if (!pitchShift.current) return;
    const keylockCorrection = -12 * Math.log2(syncRateRef.current || 1);
    pitchShift.current.pitch = pitchSemitones(pitch) + keylockCorrection;
  }

  function applyBpmSync(enabled = syncEnabled, targetBpm = syncTargetBpm) {
    const sourceBpm = Number(track?.bpm);
    const desiredBpm = Number(targetBpm);
    const nextRate = bpmSyncRate(enabled, sourceBpm, desiredBpm);
    syncRateRef.current = nextRate;
    if (audio.current) {
      audio.current.playbackRate = nextRate;
      audio.current.preservesPitch = false;
      audio.current.mozPreservesPitch = false;
      audio.current.webkitPreservesPitch = false;
    }
    updatePitchProcessor();
    setEffectiveBpm(sourceBpm > 0 ? sourceBpm * nextRate : 0);
  }

  async function start() {
    if (!audio.current) return;
    if (!context.current) {
      const bus = ensureAudioEngine();
      context.current = bus.context;
      const source = context.current.createMediaElementSource(audio.current);
      filterNode.current = context.current.createBiquadFilter();
      filterNode.current.type = filterMode;
      filterNode.current.frequency.value = filter;
      pitchShift.current = new PitchShift({
        pitch: pitchSemitones(pitch) - 12 * Math.log2(syncRateRef.current || 1),
        windowSize: 0.08,
      });
      analyser.current = context.current.createAnalyser();
      analyser.current.fftSize = 256;
      channelGain.current = context.current.createGain();
      const delay = context.current.createDelay(1);
      const feedback = context.current.createGain();
      const wet = context.current.createGain();
      const dry = context.current.createGain();
      delay.delayTime.value = 0.28;
      feedback.gain.value = 0.28;
      wet.gain.value = effectMix;
      dry.gain.value = 1;
      effectNodes.current = { delay, feedback, wet, dry };
      source.connect(filterNode.current);
      filterNode.current.connect(pitchShift.current.input.input);
      pitchShift.current.output.output.connect(dry);
      dry.connect(analyser.current);
      pitchShift.current.output.output.connect(delay);
      delay.connect(wet);
      wet.connect(analyser.current);
      delay.connect(feedback);
      feedback.connect(delay);
      analyser.current.connect(channelGain.current);
      channelGain.current.connect(bus.master);
      audioEngine.gains[number - 1] = channelGain.current;
      applyMixerLevels();
      const data = new Uint8Array(analyser.current.frequencyBinCount);
      const drawSpectrum = () => {
        if (!analyser.current) return;
        analyser.current.getByteFrequencyData(data);
        setSpectrum(
          Array.from({ length: 32 }, (_, index) =>
            Math.max(
              3,
              Math.round(
                (data[
                  Math.min(
                    data.length - 1,
                    Math.floor((index * data.length) / 32),
                  )
                ] /
                  255) *
                  100,
              ),
            ),
          ),
        );
        spectrumFrame.current = requestAnimationFrame(drawSpectrum);
      };
      drawSpectrum();
    }
    if (context.current.state === "suspended") await context.current.resume();
    const nextPlaying = !playing;
    try {
      if (playing) {
        audio.current.pause();
        setPlaying(false);
      } else {
        setPlaybackError("");
        await audio.current.play();
        setPlaying(true);
      }
    } catch (cause) {
      setPlaying(false);
      setPlaybackError(cause?.message || "Tap play again to start this song.");
      return;
    }
    void enqueue("play", {
      deck: number,
      playing: nextPlaying,
      mixxx: {
        group: deckGroup(number),
        control: "play",
        value: nextPlaying ? 1 : 0,
        midi: { channel: number, cc: 0, value: nextPlaying ? 127 : 0 },
      },
    });
  }

  function seek(value) {
    const next = clamp(value, 0, 1);
    if (audio.current?.duration)
      audio.current.currentTime = next * audio.current.duration;
    setProgress(next);
    void enqueue("seek", {
      deck: number,
      position: next,
      mixxx: {
        group: deckGroup(number),
        control: "playposition",
        value: next,
        midi: { channel: number, cc: 7, value: Math.round(next * 127) },
      },
    });
  }

  function cue() {
    if (!audio.current) return;
    const currentPosition = audio.current.currentTime || 0;
    const wasPlaying = playingRef.current;
    if (wasPlaying) cuePoint.current = currentPosition;
    audio.current.pause();
    if (!wasPlaying && Math.abs(currentPosition - cuePoint.current) > 0.05)
      cuePoint.current = currentPosition;
    audio.current.currentTime = cuePoint.current;
    setPlaying(false);
    setProgress(duration ? cuePoint.current / duration : 0);
    void enqueue("cue", {
      deck: number,
      cuePoint: cuePoint.current,
      mixxx: {
        group: deckGroup(number),
        control: "cue_default",
        value: 1,
        midi: { channel: number, cc: 4, value: 127 },
      },
    });
  }

  function updateFilter(value, { remote = true, mode = filterMode } = {}) {
    const next = clamp(value, 40, 18000);
    setFilter(next);
    if (filterNode.current) filterNode.current.frequency.value = next;
    if (remote)
      enqueue("setFilter", {
        deck: number,
        type: mode,
        frequency: next,
        strength: filterStrength(mode, next),
        mixxx: {
          group: `[QuickEffectRack1_${deckGroup(number)}]`,
          parameter: "super1",
          value: mixxxFilterPosition(mode, next),
          enabled: true,
          enabledControl: "enabled",
          enabledValue: 1,
          midi: { channel: number, cc: 6, value: filterMidiValue(mode, next) },
        },
      });
  }

  function updateFilterMode(mode, { remote = true } = {}) {
    const next = mode === "highpass" ? 40 : 18000;
    setFilterMode(mode);
    setFilter(next);
    if (filterNode.current) {
      filterNode.current.type = mode;
      filterNode.current.frequency.value = next;
    }
    if (remote)
      enqueue("setFilter", {
        deck: number,
        type: mode,
        frequency: next,
        strength: 0,
        mixxx: {
          group: `[QuickEffectRack1_${deckGroup(number)}]`,
          parameter: "super1",
          value: 0.5,
          enabled: true,
          enabledControl: "enabled",
          enabledValue: 1,
          midi: { channel: number, cc: 6, value: 64 },
        },
      });
  }

  function updatePitch(value, { remote = true } = {}) {
    const next = clamp(value, 0, 100);
    const semitones = pitchSemitones(next);
    setPitch(next);
    updatePitchProcessor();
    if (remote)
      enqueue("setPitch", {
        deck: number,
        percent: next,
        semitones,
        keylock: true,
        tempoPreserved: true,
        mixxx: {
          group: deckGroup(number),
          control: "pitch_adjust",
          value: clamp(semitones, -3, 3),
          semitones,
          controls: [
            { control: "pitch_adjust", value: clamp(semitones, -3, 3) },
            { control: "keylock", value: 1 },
          ],
          midi: {
            channel: number,
            cc: 5,
            value: pitchMidiValue(semitones),
            keylockCc: 33,
            keylockMidiValue: 127,
          },
        },
      });
  }

  function updateEffectMix(value, { remote = true } = {}) {
    const next = clamp(value, 0, 1);
    setEffectMix(next);
    if (effectNodes.current) effectNodes.current.wet.gain.value = next;
    if (remote)
      enqueue("setEffectMix", {
        deck: number,
        unit: 1,
        value: next,
        effect: "browser-delay / native Mixxx EffectUnit1 mix",
        effectName: "Echo",
        requiresEffectLoaded: true,
        mixxx: {
          group: "[EffectRack1_EffectUnit1]",
          control: "mix",
          value: next,
          midi: { channel: 5, cc: 5, value: Math.round(next * 127) },
        },
      });
  }

  function updateSync(
    enabled = !syncEnabled,
    { remote = true, targetBpmOverride = null } = {},
  ) {
    const next = Boolean(enabled);
    const targetBpm = Number(targetBpmOverride ?? syncTargetBpm) || null;
    const sourceBpm = Number(track?.bpm) || null;
    applyBpmSync(next, targetBpm);
    onSyncChange(next);
    if (remote)
      enqueue("setSync", {
        deck: number,
        enabled: next,
        sourceBpm,
        targetBpm,
        playbackRate: syncRateRef.current,
        keylock: true,
        requiresBeatgrid: true,
        mixxx: {
          group: deckGroup(number),
          control: "sync_enabled",
          value: next ? 1 : 0,
          syncMode: next ? 1 : 0,
          midi: { channel: number, cc: 2, value: next ? 127 : 0 },
        },
      });
  }

  function resetDefaults({ remote = true } = {}) {
    updateFilterMode("lowpass", { remote });
    updateFilter(18000, { remote, mode: "lowpass" });
    updatePitch(50, { remote });
    updateEffectMix(0, { remote });
    updateSync(false, { remote });
  }

  useEffect(() => {
    const unsubscribe = subscribeDjEvents((event) => {
      if (event?.deck && event.deck !== number) return;
      const value = clamp((event?.value || 0) * 100, 0, 100);
      const type = event?.type;
      const now = performance.now();
      const state = remoteGesture.current[type] || { time: 0, value: null };
      const shouldSend =
        now - state.time > 140 &&
        (state.value === null || Math.abs(value - state.value) >= 1);
      if (type === "pinch")
        updateFilter(
          filterMode === "highpass"
            ? filterFrequencyFromControl(value)
            : filterFrequencyFromControl(100 - value),
          { remote: shouldSend },
        );
      if (type === "pitch") updatePitch(value, { remote: shouldSend });
      if (type === "effect")
        updateEffectMix(value / 100, { remote: shouldSend });
      if (type === "syncToggle") updateSync(!syncEnabled, { remote: true });
      if (type === "sync")
        updateSync(true, {
          remote: shouldSend,
          targetBpmOverride: event.targetBpm,
        });
      if (type === "tempoKill") updatePitch(50, { remote: true });
      if (type === "resetDefaults") resetDefaults({ remote: shouldSend });
      if (shouldSend) remoteGesture.current[type] = { time: now, value };
    });
    return unsubscribe;
  }, [number, filterMode, syncEnabled, syncTargetBpm]);

  return (
    <section
      className={`deck-card ${number === 1 ? "deck-a" : "deck-b"}`}
      aria-label={`Deck ${number}`}
    >
      <div className="deck-head">
        <span className="deck-label">
          <i /> DECK {number === 1 ? "A" : "B"}
        </span>
        <span className={playing ? "deck-live" : "deck-ready"}>
          {playing ? "PLAYING" : "READY"}
        </span>
      </div>
      <div className="track-identity">
        <div className="deck-mark">{number === 1 ? "A" : "B"}</div>
        <div className="track-copy">
          <strong>
            {track
              ? track.name || `${track.artist} — ${track.title}`
              : "Choose a song below"}
          </strong>
          <span>
            {track
              ? `${effectiveBpm ? `${Math.round(effectiveBpm)} BPM` : "BPM —"}${syncEnabled && syncTargetBpm ? ` · SYNC ${Math.round(syncTargetBpm)}` : ""}`
              : "No song selected"}
          </span>
        </div>
      </div>
      <audio
        ref={audio}
        crossOrigin="anonymous"
        src={track?.url || undefined}
        preload="metadata"
      />
      <div className="deck-waveform">
        <div
          ref={waveformContainer}
          className="waveform-instance"
          aria-label={`Deck ${number} waveform`}
        />
        <div className="spectrum-bars" aria-hidden="true">
          {spectrum.map((level, index) => (
            <i key={index} style={{ height: `${level}%` }} />
          ))}
        </div>
      </div>
      <div className="time-readout">
        <span>
          {track ? formatTime(audio.current?.currentTime || 0) : "--:--"}
        </span>
        <strong>{playing ? "ON AIR" : "CUE"}</strong>
        <span>{track ? formatTime(duration) : "--:--"}</span>
      </div>
      {playbackError && (
        <p className="playback-error" role="status">
          {playbackError}
        </p>
      )}
      <label className="sr-only" htmlFor={`seek-${number}`}>
        Track position
      </label>
      <input
        id={`seek-${number}`}
        className="seek-range"
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={progress}
        onChange={(event) => seek(event.target.value)}
      />
      <div className="deck-actions">
        <button
          className={`transport-button ${playing ? "is-playing" : ""}`}
          type="button"
          onClick={start}
          aria-label={playing ? `Pause deck ${number}` : `Play deck ${number}`}
        >
          <Icon
            name={playing ? "pause" : "play"}
            size={16}
            fill="currentColor"
          />
        </button>
        <button className="utility-button" type="button" onClick={cue}>
          CUE
        </button>
        <button
          className={`utility-button ${syncEnabled ? "is-selected" : ""}`}
          type="button"
          onClick={() => updateSync()}
          aria-label={`Toggle BPM sync for deck ${number}`}
        >
          <Icon name="lock" size={12} /> SYNC
        </button>
      </div>
      <ControlRow
        label={filterMode === "highpass" ? "HIGH-PASS" : "LOW-PASS"}
        value={`${Math.round(filterStrength(filterMode, filter))}%`}
        className="filter-control"
      >
        <div className="mode-buttons">
          <button
            className={filterMode === "lowpass" ? "is-selected" : ""}
            type="button"
            onClick={() => updateFilterMode("lowpass")}
          >
            LP
          </button>
          <button
            className={filterMode === "highpass" ? "is-selected" : ""}
            type="button"
            onClick={() => updateFilterMode("highpass")}
          >
            HP
          </button>
        </div>
        <input
          className="control-range range-cyan"
          type="range"
          min="0"
          max="100"
          step="1"
          value={filterControlFromFrequency(filter)}
          onChange={(event) =>
            updateFilter(filterFrequencyFromControl(event.target.value))
          }
        />
      </ControlRow>
      <ControlRow
        label="PITCH · KEYLOCK"
        value={`${pitchSemitones(pitch).toFixed(1)} ST`}
        className="pitch-control"
      >
        <input
          className="control-range range-violet"
          type="range"
          min="0"
          max="100"
          step="1"
          value={pitch}
          onChange={(event) => updatePitch(event.target.value)}
        />
      </ControlRow>
      <ControlRow
        label="ECHO FX · MIX"
        value={`${Math.round(effectMix * 100)}%`}
        className="effect-control"
      >
        <input
          className="control-range range-pink"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={effectMix}
          onChange={(event) => updateEffectMix(event.target.value)}
        />
      </ControlRow>
    </section>
  );
}

function ControlRow({ label, value, className, children }) {
  return (
    <div className={`control-row ${className}`}>
      <div className="control-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {children}
    </div>
  );
}

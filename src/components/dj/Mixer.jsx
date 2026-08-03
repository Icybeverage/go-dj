import React, { useEffect, useState } from "react";
import { Icon } from "./Icons";
import { subscribeDjEvents, emitDjEvent } from "../../features/dj/bus";
import {
  setMixerChannelVolume,
  setMixerCrossfader,
  setMixerMasterVolume,
} from "../../features/audio/engine";
import { clamp, deckGroup } from "../../features/dj/math";

export function Mixer({ enqueue }) {
  const [crossfader, setCrossfader] = useState(50);
  const [master, setMaster] = useState(80);
  const [channels, setChannels] = useState([80, 80]);

  function change(command, value, args = {}) {
    enqueue(command, { ...args, value: Number(value) });
  }

  function updateCrossfader(value, { remote = true } = {}) {
    const next = clamp(value, 0, 100);
    const mixxxValue = next / 50 - 1;
    setCrossfader(next);
    setMixerCrossfader(next);
    if (remote)
      change("setCrossfader", next, {
        curve: "constant-power",
        deckA: Math.round(Math.cos(((next / 100) * Math.PI) / 2) * 100),
        deckB: Math.round(Math.cos(((1 - next / 100) * Math.PI) / 2) * 100),
        mixxx: {
          group: "[Master]",
          control: "crossfader",
          value: mixxxValue,
          midi: { channel: 5, cc: 0, value: Math.round((next / 100) * 127) },
        },
      });
  }

  function updateChannel(channel, value) {
    const next = clamp(value, 0, 100);
    setChannels((current) =>
      current.map((item, index) => (index === channel ? next : item)),
    );
    setMixerChannelVolume(channel, next);
    change("setChannelVolume", next, {
      channel: channel + 1,
      deck: channel + 1,
      mixxx: {
        group: deckGroup(channel + 1),
        control: "volume",
        value: next / 100,
        midi: {
          channel: channel + 1,
          cc: 3,
          value: Math.round((next / 100) * 127),
        },
      },
    });
  }

  function updateMaster(value) {
    const next = clamp(value, 0, 100);
    setMaster(next);
    setMixerMasterVolume(next);
    change("setMasterVolume", next, {
      mixxx: {
        group: "[Master]",
        control: "gain",
        value: next / 100,
        midi: { channel: 5, cc: 1, value: Math.round((next / 100) * 127) },
      },
    });
  }

  useEffect(() => {
    const remoteGesture = { time: 0, value: null };
    return subscribeDjEvents((event) => {
      if (event?.type !== "crossfader") return;
      const value = clamp(event.value, 0, 1) * 100;
      const now = performance.now();
      const shouldSend =
        now - remoteGesture.time > 140 &&
        (remoteGesture.value === null ||
          Math.abs(value - remoteGesture.value) >= 1);
      updateCrossfader(value, { remote: shouldSend });
      if (shouldSend) Object.assign(remoteGesture, { time: now, value });
    });
  }, [enqueue]);

  function resetMixer() {
    updateCrossfader(50);
    setMixerChannelVolume(0, 80);
    setMixerChannelVolume(1, 80);
    setChannels([80, 80]);
    updateMaster(80);
    emitDjEvent({ type: "resetDefaults", value: 1 });
  }

  return (
    <section className="mixer-card" aria-label="Mixer">
      <div className="mixer-head">
        <span className="eyebrow">MIXER</span>
        <Icon name="sliders" size={15} />
      </div>
      <div className="channel-strip">
        <Channel
          label="A"
          value={channels[0]}
          onChange={(value) => updateChannel(0, value)}
        />
        <Meter />
        <div className="cue-badge">
          <Icon name="headphones" size={13} />
          <span>A/B</span>
        </div>
        <Meter />
        <Channel
          label="B"
          value={channels[1]}
          onChange={(value) => updateChannel(1, value)}
        />
      </div>
      <div className="mixer-controls">
        <label className="fader-control">
          <div className="fader-head">
            <span>A</span>
            <strong>{crossfader}%</strong>
            <span>B</span>
          </div>
          <input
            aria-label="A to B crossfader"
            type="range"
            min="0"
            max="100"
            value={crossfader}
            onChange={(event) => updateCrossfader(event.target.value)}
          />
        </label>
        <label className="fader-control">
          <div className="fader-head">
            <span>MASTER</span>
            <strong>{master}%</strong>
          </div>
          <input
            aria-label="Master volume"
            type="range"
            min="0"
            max="100"
            value={master}
            onChange={(event) => updateMaster(event.target.value)}
          />
        </label>
        <div className="mixer-buttons">
          <button
            className="secondary-button"
            type="button"
            onClick={() => emitDjEvent({ type: "tempoKill", value: 1 })}
          >
            TEMPO KILL
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={resetMixer}
          >
            RESET DEFAULT
          </button>
        </div>
      </div>
    </section>
  );
}

function Channel({ label, value, onChange }) {
  return (
    <label className="channel-fader">
      <span>CH {label}</span>
      <input
        aria-label={`Deck ${label} channel volume`}
        type="range"
        className="vertical-range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Meter() {
  return (
    <div className="vu-meter" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => (
        <i
          key={index}
          className={index > 5 ? "peak" : index > 3 ? "warn" : ""}
        />
      ))}
    </div>
  );
}

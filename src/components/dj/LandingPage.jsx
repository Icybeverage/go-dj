import React, { useState } from "react";
import { Icon } from "./Icons";

const TUTORIAL_STEPS = [
  {
    icon: "music",
    eyebrow: "01 · LOAD",
    title: "Pick a track",
    body: "Choose one of the preloaded songs from the playlist, then send it to Deck A or Deck B.",
    cue: "The playlist stays attached to the decks.",
  },
  {
    icon: "lock",
    eyebrow: "02 · MIX",
    title: "Match the groove",
    body: "Use BPM Sync to match the other deck. Keylock keeps the musical pitch steady while tempo changes.",
    cue: "Sync is one deck at a time, like a DJ clock leader.",
  },
  {
    icon: "hand",
    eyebrow: "03 · GESTURE",
    title: "Control the sound",
    body: "The left hand controls Deck A. The right hand controls Deck B. Pinch filters, two fingers shift pitch, and an index finger rides the echo.",
    cue: "The tracking overlay shows the active hand and deck color.",
  },
  {
    icon: "camera",
    eyebrow: "04 · PERFORM",
    title: "Turn on the camera",
    body: "Allow camera access when you are ready. Two open palms move the crossfader; a head nod fires the airhorn.",
    cue: "You can turn the camera or each gesture off at any time.",
  },
];

export function LandingPage({ onEnter }) {
  const [step, setStep] = useState(0);
  const current = TUTORIAL_STEPS[step];
  const lastStep = step === TUTORIAL_STEPS.length - 1;

  function next() {
    if (lastStep) onEnter();
    else setStep((value) => value + 1);
  }

  return (
    <main className="landing-page">
      <div className="landing-backdrop" aria-hidden="true" />
      <div className="landing-shell">
        <header className="landing-header">
          <div className="brand-lockup">
            <span className="landing-brand">Go DJ!</span>
          </div>
          <span className="landing-caption">MOBILE DJ CONTROL</span>
        </header>

        <section className="landing-content" aria-labelledby="landing-title">
          <div className="landing-intro">
            <span className="eyebrow">YOUR SET STARTS HERE</span>
            <h1 id="landing-title">Go DJ!</h1>
            <p>
              A compact two-deck player for quick mixes, camera control, and
              festival-ready transitions.
            </p>
            <div className="landing-pills" aria-label="App features">
              <span>2 DECKS</span>
              <span>BPM SYNC</span>
              <span>LIVE GESTURES</span>
            </div>
          </div>

          <section className="tutorial-card" aria-labelledby="tutorial-title">
            <div className="tutorial-topline">
              <span className="eyebrow">QUICK TUTORIAL</span>
              <span className="tutorial-count">
                {step + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>
            <div className="tutorial-progress" aria-hidden="true">
              {TUTORIAL_STEPS.map((item, index) => (
                <i
                  key={item.eyebrow}
                  className={index <= step ? "is-done" : ""}
                />
              ))}
            </div>
            <div className="tutorial-main">
              <div className="tutorial-icon">
                <Icon name={current.icon} size={26} />
              </div>
              <div className="tutorial-copy">
                <span className="eyebrow">{current.eyebrow}</span>
                <h2 id="tutorial-title">{current.title}</h2>
                <p>{current.body}</p>
                <small>{current.cue}</small>
              </div>
            </div>
            <div className="tutorial-actions">
              <button className="text-button" type="button" onClick={onEnter}>
                Skip tutorial
              </button>
              <button className="primary-button" type="button" onClick={next}>
                {lastStep ? "Start mixing" : "Next"}
                <Icon name={lastStep ? "play" : "arrowRight"} size={14} />
              </button>
            </div>
          </section>
        </section>

        <footer className="landing-footer">
          <span>
            Use headphones for cueing and a clear camera view for tracking.
          </span>
          <span>Browser audio · MediaPipe camera</span>
        </footer>
      </div>
    </main>
  );
}

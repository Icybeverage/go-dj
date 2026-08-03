import React, { useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";
import { GestureGrid } from "./GestureGrid";
import { Icon } from "./Icons";
import {
  ensureAudioEngine,
  preloadAirhorn,
  triggerAirhorn,
} from "../../features/audio/engine";
import { emitDjEvent } from "../../features/dj/bus";
import { clamp, pinchControlFromRatio } from "../../features/dj/math";
import {
  createGestureState,
  defaultGestureOptions,
  HAND_CONNECTIONS,
} from "../../features/gestures/config";
import {
  handGesture,
  normalizeHandedness,
  routeHandsToDecks,
} from "../../features/gestures/classifier";

export function CameraCard() {
  const video = useRef(null);
  const detector = useRef({ hand: null, face: null });
  const frame = useRef(null);
  const handStates = useRef({
    1: createGestureState(),
    2: createGestureState(),
  });
  const crossfader = useRef({ last: 0, value: 0.5 });
  const handVisible = useRef(false);
  const headMotion = useRef({ lastNoseY: null, cooldownUntil: 0 });
  const gestureOptionsRef = useRef(defaultGestureOptions);
  const drag = useRef(null);
  const [active, setActive] = useState(false);
  const [gestureEnabled, setGestureEnabled] = useState(true);
  const [gestureOptions, setGestureOptions] = useState(defaultGestureOptions);
  const [activeGesture, setActiveGesture] = useState("none");
  const [error, setError] = useState("");
  const [detectorStatus, setDetectorStatus] = useState("Tracker off");
  const [gestureStatus, setGestureStatus] = useState("No hand detected");
  const [position, setPosition] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  function toggleGestureOption(id) {
    setGestureOptions((current) => {
      const next = { ...current, [id]: !current[id] };
      gestureOptionsRef.current = next;
      return next;
    });
  }

  function resetTrackingState() {
    Object.values(handStates.current).forEach((state) => {
      clearTimeout(state.fistHoldTimer);
    });
    handStates.current = {
      1: createGestureState(),
      2: createGestureState(),
    };
    crossfader.current = { last: 0, value: 0.5 };
    handVisible.current = false;
    headMotion.current = { lastNoseY: null, cooldownUntil: 0 };
  }

  async function toggleCamera() {
    if (active) {
      video.current?.srcObject?.getTracks().forEach((track) => track.stop());
      if (video.current) video.current.srcObject = null;
      setActive(false);
      return;
    }
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires HTTPS or localhost.");
      return;
    }
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (cause) {
        if (!["OverconstrainedError", "NotFoundError"].includes(cause?.name))
          throw cause;
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      ensureAudioEngine().context.resume().catch(() => {});
      preloadAirhorn();
      setActive(true);
    } catch (cause) {
      setError(
        cause?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow it in browser settings."
          : `Camera unavailable: ${cause?.message || "no device found"}`,
      );
    }
  }

  function startDrag(event) {
    if (fullscreen || event.target.closest("button")) return;
    const rect = event.currentTarget
      .closest(".camera-dock")
      .getBoundingClientRect();
    drag.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (!drag.current || fullscreen) return;
    const width = drag.current.width || 280;
    const height = drag.current.height || 320;
    setPosition({
      x: Math.max(
        8,
        Math.min(
          window.innerWidth - width - 8,
          event.clientX - drag.current.dx,
        ),
      ),
      y: Math.max(
        8,
        Math.min(
          window.innerHeight - height - 8,
          event.clientY - drag.current.dy,
        ),
      ),
    });
  }

  useEffect(() => {
    return () => {
      video.current?.srcObject?.getTracks().forEach((track) => track.stop());
      cancelAnimationFrame(frame.current);
      resetTrackingState();
      detector.current.hand?.close?.();
      detector.current.face?.close?.();
    };
  }, []);

  useEffect(() => {
    if (!active || !gestureEnabled || !video.current) {
      resetTrackingState();
      if (!gestureEnabled) {
        setDetectorStatus("Gestures off");
        setGestureStatus("Gesture input off");
        setActiveGesture("none");
        const canvas = video.current?.parentElement?.querySelector("canvas");
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      } else if (!active) {
        setDetectorStatus("Tracker off");
        setGestureStatus("No hand detected");
        setActiveGesture("none");
      }
      return undefined;
    }
    let cancelled = false;

    async function startDetector() {
      try {
        setDetectorStatus("Loading gesture tracker…");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
        );
        const handOptions = {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        };
        let hand;
        try {
          hand = await HandLandmarker.createFromOptions(vision, handOptions);
        } catch {
          hand = await HandLandmarker.createFromOptions(vision, {
            ...handOptions,
            baseOptions: { ...handOptions.baseOptions, delegate: "CPU" },
          });
        }
        let face = null;
        try {
          const faceOptions = {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.55,
            minFacePresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          };
          try {
            face = await FaceLandmarker.createFromOptions(vision, faceOptions);
          } catch {
            face = await FaceLandmarker.createFromOptions(vision, {
              ...faceOptions,
              baseOptions: { ...faceOptions.baseOptions, delegate: "CPU" },
            });
          }
        } catch {
          face = null;
        }
        if (cancelled) {
          hand.close();
          face?.close?.();
          return;
        }
        detector.current = { hand, face };
        setDetectorStatus(
          face ? "Tracking ready · 2 hands + nod" : "Tracking ready · 2 hands",
        );

        const detect = () => {
          if (
            !cancelled &&
            detector.current.hand &&
            video.current?.readyState >= 2
          ) {
            const timestamp = performance.now();
            const result = detector.current.hand.detectForVideo(
              video.current,
              timestamp,
            );
            const faceResult = detector.current.face?.detectForVideo(
              video.current,
              timestamp,
            );
            const detectedHands = routeHandsToDecks(
              (result.landmarks || []).map((points, handIndex) => {
                const palmX =
                  [0, 5, 9, 13, 17].reduce(
                    (sum, index) => sum + points[index].x,
                    0,
                  ) / 5;
                const palmY =
                  [0, 5, 9, 13, 17].reduce(
                    (sum, index) => sum + points[index].y,
                    0,
                  ) / 5;
                const pinchDistance = Math.hypot(
                  points[4].x - points[8].x,
                  points[4].y - points[8].y,
                );
                const palmSize = Math.max(
                  0.05,
                  Math.hypot(
                    points[0].x - points[9].x,
                    points[0].y - points[9].y,
                  ),
                );
                const handedness =
                  result.handedness?.[handIndex]?.[0] ||
                  result.handednesses?.[handIndex]?.[0];
                return {
                  points,
                  palmY,
                  pinchRatio: pinchDistance / palmSize,
                  visualX: clamp(1 - palmX, 0, 1),
                  handSide: normalizeHandedness(handedness),
                  rawMode: handGesture(points, pinchDistance / palmSize),
                };
              }),
            );

            const canvas =
              video.current?.parentElement?.querySelector("canvas");
            if (canvas && video.current.videoWidth) {
              canvas.width = video.current.videoWidth;
              canvas.height = video.current.videoHeight;
              const ctx = canvas.getContext("2d");
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              detectedHands.forEach(({ points, deck }) => {
                ctx.strokeStyle = deck === 1 ? "#57e6da" : "#ce8aff";
                ctx.lineWidth = 3;
                HAND_CONNECTIONS.forEach(([a, b]) => {
                  ctx.beginPath();
                  ctx.moveTo(
                    points[a].x * canvas.width,
                    points[a].y * canvas.height,
                  );
                  ctx.lineTo(
                    points[b].x * canvas.width,
                    points[b].y * canvas.height,
                  );
                  ctx.stroke();
                });
                ctx.fillStyle = deck === 1 ? "#57e6da" : "#ce8aff";
                points.forEach((point) => {
                  ctx.beginPath();
                  ctx.arc(
                    point.x * canvas.width,
                    point.y * canvas.height,
                    4,
                    0,
                    Math.PI * 2,
                  );
                  ctx.fill();
                });
              });
            }

            const facePoints = faceResult?.faceLandmarks?.[0];
            if (facePoints?.[1] && facePoints?.[33] && facePoints?.[263]) {
              const signal =
                facePoints[1].y * 0.72 +
                ((facePoints[33].y + facePoints[263].y) / 2) * 0.28;
              const previous = headMotion.current.lastNoseY;
              if (
                previous !== null &&
                signal - previous > 0.032 &&
                timestamp > headMotion.current.cooldownUntil
              ) {
                headMotion.current.cooldownUntil = timestamp + 1300;
                if (gestureOptionsRef.current.airhorn) {
                  setActiveGesture("airhorn");
                  setGestureStatus("HEAD NOD · AIRHORN");
                  triggerAirhorn();
                  emitDjEvent({ type: "airhorn" });
                }
              }
              headMotion.current.lastNoseY =
                previous === null ? signal : previous * 0.7 + signal * 0.3;
            } else {
              headMotion.current.lastNoseY = null;
            }

            const now = timestamp;
            detectedHands.forEach(({ palmY, pinchRatio, rawMode, deck }) => {
              const state = handStates.current[deck];
              if (rawMode !== state.candidate) {
                state.candidate = rawMode;
                state.candidateSince = now;
              }
              const mode =
                now - state.candidateSince >= 120
                  ? state.candidate
                  : state.mode;
              const pinchValue = pinchControlFromRatio(pinchRatio);
              const pitchValue = clamp(1 - palmY, 0, 1);
              const label = deck === 1 ? "A" : "B";
              if (mode !== "fist" && state.mode === "fist")
                clearTimeout(state.fistHoldTimer);
              if (mode === "pinch") {
                state.mode = mode;
                if (
                  !gestureOptionsRef.current.filter ||
                  now - state.last.pinch <= 80
                )
                  return;
                state.last.pinch = now;
                setActiveGesture("filter");
                state.values.filter =
                  state.values.filter * 0.72 + pinchValue * 0.28;
                setGestureStatus(
                  `DECK ${label} · Pinch filter ${Math.round(state.values.filter * 100)}%`,
                );
                emitDjEvent({
                  type: "pinch",
                  value: state.values.filter,
                  deck,
                });
              } else if (mode === "pitch") {
                state.mode = mode;
                if (
                  !gestureOptionsRef.current.pitch ||
                  now - state.last.pitch <= 60
                )
                  return;
                state.last.pitch = now;
                setActiveGesture("pitch");
                state.values.pitch =
                  state.values.pitch * 0.55 + pitchValue * 0.45;
                setGestureStatus(
                  `DECK ${label} · Two-finger pitch ${Math.round(state.values.pitch * 100)}%`,
                );
                emitDjEvent({ type: "pitch", value: state.values.pitch, deck });
              } else if (mode === "effect") {
                state.mode = mode;
                if (
                  !gestureOptionsRef.current.effect ||
                  now - state.last.effect <= 70
                )
                  return;
                state.last.effect = now;
                setActiveGesture("effect");
                state.values.effect =
                  state.values.effect * 0.72 + pitchValue * 0.28;
                setGestureStatus(
                  `DECK ${label} · Index FX ${Math.round(state.values.effect * 100)}%`,
                );
                emitDjEvent({
                  type: "effect",
                  value: state.values.effect,
                  deck,
                });
              } else if (mode === "fist") {
                if (state.mode !== "fist") {
                  state.mode = mode;
                  if (!gestureOptionsRef.current.sync) return;
                  setActiveGesture("sync");
                  setGestureStatus(`DECK ${label} · Closed fist · BPM sync`);
                  emitDjEvent({ type: "syncNext", deck });
                  clearTimeout(state.fistHoldTimer);
                  state.fistHoldTimer = window.setTimeout(() => {
                    if (!gestureOptionsRef.current.sync) return;
                    setGestureStatus(`DECK ${label} · Fist held · handoff`);
                    emitDjEvent({ type: "handoffNext", deck });
                  }, 900);
                }
              } else if (
                mode === "sync" &&
                state.mode !== "sync" &&
                now - state.last.sync > 900
              ) {
                state.last.sync = now;
                state.mode = mode;
                if (!gestureOptionsRef.current.sync) return;
                setActiveGesture("sync");
                setGestureStatus(`DECK ${label} · Thumbs up · BPM sync`);
                emitDjEvent({ type: "syncToggle", deck });
              } else if (mode === "neutral" || mode === "crossfader") {
                clearTimeout(state.fistHoldTimer);
                state.mode = mode;
              }
            });

            const openHands = gestureOptionsRef.current.crossfader
              ? detectedHands.filter(
                  ({ deck }) => handStates.current[deck].mode === "crossfader",
                )
              : [];
            if (detectedHands.length === 2 && openHands.length === 2) {
              if (now - crossfader.current.last > 70) {
                crossfader.current.last = now;
                const value =
                  openHands.reduce(
                    (sum, handData) => sum + handData.visualX,
                    0,
                  ) / openHands.length;
                crossfader.current.value =
                  crossfader.current.value * 0.72 + value * 0.28;
                setActiveGesture("crossfader");
                setGestureStatus(
                  `Open palms · crossfader ${Math.round(crossfader.current.value * 100)}%`,
                );
                emitDjEvent({
                  type: "crossfader",
                  value: crossfader.current.value,
                });
              }
            }
            if (detectedHands.length) handVisible.current = true;
            else if (handVisible.current) {
              handVisible.current = false;
              Object.values(handStates.current).forEach((state) => {
                clearTimeout(state.fistHoldTimer);
                state.mode = "neutral";
              });
              setActiveGesture("none");
              setGestureStatus("No hand detected");
            }
          }
          frame.current = requestAnimationFrame(detect);
        };
        detect();
      } catch (cause) {
        if (!cancelled)
          setDetectorStatus(
            `Gesture tracker unavailable: ${cause?.message || "model failed"}`,
          );
      }
    }

    startDetector();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame.current);
      resetTrackingState();
      detector.current.hand?.close?.();
      detector.current.face?.close?.();
      detector.current = { hand: null, face: null };
    };
  }, [active, gestureEnabled]);

  const cameraStyle = fullscreen
    ? undefined
    : position
      ? { left: position.x, top: position.y, right: "auto" }
      : undefined;

  return (
    <div
      className={`camera-dock ${fullscreen ? "camera-fullscreen" : ""} ${position ? "is-moved" : ""}`}
      style={cameraStyle}
      onPointerMove={moveDrag}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <section className="camera-card" aria-labelledby="camera-title">
        <div className="card-header" onPointerDown={startDrag}>
          <div>
            <span className="eyebrow">LIVE INPUT</span>
            <h2 id="camera-title">Performance camera</h2>
          </div>
          <div className="camera-actions">
            <button
              className="icon-button"
              type="button"
              onClick={toggleCamera}
              aria-label={active ? "Stop camera" : "Allow camera"}
            >
              <Icon name={active ? "pause" : "camera"} size={15} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => setFullscreen((value) => !value)}
              aria-label={
                fullscreen ? "Exit fullscreen camera" : "Fullscreen camera"
              }
            >
              <Icon name={fullscreen ? "minimize" : "maximize"} size={15} />
            </button>
          </div>
        </div>
        <div className="camera-viewport">
          <video ref={video} className="mirrored" autoPlay muted playsInline />
          <canvas className="tracking-overlay mirrored" />
          <span className={`camera-state ${active ? "is-live" : ""}`}>
            <i />
            {active ? "LIVE" : "OFF"}
          </span>
          <span className="gesture-badge">{gestureStatus}</span>
        </div>
        <div className="camera-status">
          <span>{detectorStatus}</span>
          {error && <span className="error-text">{error}</span>}
        </div>
      </section>
      <GestureGrid
        enabled={gestureEnabled}
        options={gestureOptions}
        activeGesture={activeGesture}
        onToggle={() => setGestureEnabled((value) => !value)}
        onToggleGesture={toggleGestureOption}
      />
    </div>
  );
}

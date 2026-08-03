export function fingerStates(points) {
  return [8, 12, 16, 20].map(
    (tip, index) => points[tip].y < points[[6, 10, 14, 18][index]].y - 0.025,
  );
}

export function normalizeHandedness(value) {
  const label = String(
    value?.categoryName || value?.displayName || value?.label || value || "",
  ).toLowerCase();
  if (label.includes("left")) return "left";
  if (label.includes("right")) return "right";
  return "";
}

// MediaPipe reports handedness as if a selfie image were mirrored. The video
// element is mirrored for the user, but landmark detection runs on the raw
// camera frame, so swap the model label before routing to the displayed side.
export function displayHandSide(value) {
  const side = normalizeHandedness(value);
  if (side === "left") return "right";
  if (side === "right") return "left";
  return "";
}

export function deckForHand(handSide, visualX = 0.5) {
  const side = normalizeHandedness(handSide);
  if (side === "left") return 1;
  if (side === "right") return 2;
  return Number(visualX) < 0.5 ? 1 : 2;
}

export function routeHandsToDecks(hands) {
  const used = new Set();
  return hands.slice(0, 2).reduce((routed, hand) => {
    const preferred = deckForHand(hand.handSide, hand.visualX);
    const alternate = preferred === 1 ? 2 : 1;
    const deck = used.has(preferred)
      ? used.has(alternate)
        ? null
        : alternate
      : preferred;
    if (deck) {
      used.add(deck);
      routed.push({ ...hand, deck });
    }
    return routed;
  }, []);
}

export function handGesture(points, pinchRatio = Infinity) {
  const fingers = fingerStates(points);
  const extended = fingers.filter(Boolean).length;
  const thumbUp =
    points[4].y < points[3].y - 0.04 &&
    points[4].y < points[0].y - 0.08 &&
    extended === 0;
  const peace = fingers[0] && fingers[1] && !fingers[2] && !fingers[3];
  const indexOnly = fingers[0] && !fingers[1] && !fingers[2] && !fingers[3];
  if (thumbUp) return "sync";
  if (peace) return "pitch";
  if (pinchRatio < 0.5 && extended <= 2) return "pinch";
  if (indexOnly) return "effect";
  if (extended === 4) return "crossfader";
  if (extended === 0) return "fist";
  return "neutral";
}

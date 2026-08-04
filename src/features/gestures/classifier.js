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

export function deckForHand(handSide) {
  const side = normalizeHandedness(handSide);
  if (side === "left") return 1;
  if (side === "right") return 2;
  // Never infer a deck from screen position: an unknown hand must not bleed
  // into the opposite deck.
  return null;
}

export function routeHandsToDecks(hands) {
  const used = new Set();
  return hands.slice(0, 2).reduce((routed, hand) => {
    const preferred = deckForHand(hand.handSide);
    if (!preferred || used.has(preferred)) return routed;
    used.add(preferred);
    routed.push({ ...hand, deck: preferred });
    return routed;
  }, []);
}

export function handGesture(points, pinchRatio = Infinity) {
  const fingers = fingerStates(points);
  const extended = fingers.filter(Boolean).length;
  const peace = fingers[0] && fingers[1] && !fingers[2] && !fingers[3];
  const indexOnly = fingers[0] && !fingers[1] && !fingers[2] && !fingers[3];
  if (peace) return "pitch";
  if (pinchRatio < 0.5 && extended >= 1 && extended <= 2) return "pinch";
  if (indexOnly) return "effect";
  if (extended === 4) return "crossfader";
  return "neutral";
}

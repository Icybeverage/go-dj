const listeners = new Set();

export function emitDjEvent(detail) {
  listeners.forEach((listener) => listener(detail));
}

export function subscribeDjEvents(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

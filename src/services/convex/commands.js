import {
  mixxxCommand,
  normalizeMixxxControl,
} from "../../features/dj/mixxx.js";

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export function createCommandQueue(enqueueMutation, options = {}) {
  return async function enqueue(command, args = {}) {
    try {
      const mixxx = normalizeMixxxControl(args.mixxx);
      const payload = mixxxCommand(command, {
        ...args,
        ...(mixxx ? { mixxx } : {}),
      });
      const request = {
        command,
        protocol: payload.protocol,
        argsJson: JSON.stringify(payload),
        ...(options.sessionKey ? { sessionKey: options.sessionKey } : {}),
        ...(options.source ? { source: options.source } : {}),
        requestId: requestId(),
      };
      await enqueueMutation(request);
      return true;
    } catch {
      return false;
    }
  };
}

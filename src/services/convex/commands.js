import {
  mixxxCommand,
  normalizeMixxxControl,
} from "../../features/dj/mixxx.js";

export function createCommandQueue(enqueueMutation) {
  return async function enqueue(command, args = {}) {
    try {
      if (args?.mixxx?.action === "loadTrackByPath") return true;
      const mixxx = normalizeMixxxControl(args.mixxx);
      const payload = mixxxCommand(command, {
        ...args,
        ...(mixxx ? { mixxx } : {}),
      });
      await enqueueMutation({
        command,
        protocol: payload.protocol,
        argsJson: JSON.stringify(payload),
      });
      return true;
    } catch {
      return false;
    }
  };
}

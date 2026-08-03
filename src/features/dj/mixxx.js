export const MIXXX_COMMAND_PROTOCOL = "mixxx-command-v1";

export function mixxxCommand(command, args = {}) {
  return {
    protocol: MIXXX_COMMAND_PROTOCOL,
    command,
    args,
  };
}

export function normalizeMixxxControl(mixxx) {
  if (!mixxx || typeof mixxx !== "object") return null;
  const key = mixxx.key || mixxx.control || mixxx.parameter;
  if (!mixxx.group || !key) return null;
  return {
    ...mixxx,
    key,
    control: key,
    ...(Array.isArray(mixxx.controls)
      ? {
          controls: mixxx.controls.map((item) => ({
            ...item,
            ...(item.group || mixxx.group
              ? { group: item.group || mixxx.group }
              : {}),
            key: item.key || item.control || item.parameter,
            control: item.key || item.control || item.parameter,
          })),
        }
      : {}),
  };
}

/*
 * Go DJ! native Mixxx controller mapping layer.
 *
 * This file is intentionally plain JavaScript: Mixxx loads controller
 * mappings in its own JS runtime, where `engine` is provided by Mixxx.
 * A Convex sidecar should parse a mixxx-command-v1 message and call
 * GoDJMixxx.applyPayload(payload) inside this mapping.
 */

var GoDJMixxx = (function () {
  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function numericValue(value) {
    if (typeof value === "boolean") return value ? 1 : 0;
    var number = Number(value);
    return isFiniteNumber(number) ? number : null;
  }

  function applyControl(control, inheritedGroup) {
    if (!control || typeof control !== "object") return false;
    var group = control.group || inheritedGroup;
    var key = control.key || control.control || control.parameter;
    var value = numericValue(control.value);
    if (typeof group !== "string" || typeof key !== "string" || value === null)
      return false;

    engine.setValue(group, key, value);
    return true;
  }

  function applyPayload(payload) {
    if (!payload || payload.protocol !== "mixxx-command-v1") return false;
    var args = payload.args || {};
    var mixxx = args.mixxx;

    if (!mixxx) return false;
    if (Array.isArray(mixxx.controls)) {
      var applied = 0;
      mixxx.controls.forEach(function (control) {
        if (applyControl(control, mixxx.group)) applied += 1;
      });
      return applied > 0;
    }

    return applyControl(mixxx);
  }

  return {
    init: function () {},
    shutdown: function () {},
    applyControl: applyControl,
    applyPayload: applyPayload,
  };
})();

"use strict";

function objectPayload(value) {
  if (Buffer.isBuffer(value)) value = value.toString();
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value : {};
}

function zigbeeBrightness(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.max(1, Math.min(254, Math.round(number)));
}

function validateControls(controls) {
  if (!Array.isArray(controls)) throw new TypeError("Inovelli controls must be an array");

  for (const [index, control] of controls.entries()) {
    if (!control || typeof control !== "object") {
      throw new TypeError(`Inovelli control ${index + 1} must be an object`);
    }
    if (!control.switchTopic || !control.targetTopic) {
      throw new TypeError(
        `Inovelli control ${index + 1} requires switchTopic and targetTopic`,
      );
    }
  }
}

module.exports = function createInovelliControl(controls) {
  validateControls(controls);

  // Live observations only. Nothing is written to disk or restored on restart.
  const switchStates = new Map();
  const switchBrightness = new Map();

  function buildDoubleTap(msg) {
    const control = controls.find((item) => item.switchTopic === msg.topic);
    if (!control) return null;

    const action = objectPayload(msg.payload).action;
    if (action !== "up_double" && action !== "down_double") return null;

    const kelvin = Number(
      action === "up_double"
        ? (control.upColorTempK ?? 4000)
        : (control.downColorTempK ?? 2200),
    );
    const boundedKelvin = Math.max(1000, Math.min(10000, kelvin));
    const brightness =
      action === "up_double"
        ? 254
        : Math.round(
            (Math.max(
              1,
              Math.min(100, Number(control.downBrightnessPercent ?? 20)),
            ) *
              254) /
              100,
          );

    return {
      ...msg,
      topic: `${control.targetTopic}/set`,
      payload: JSON.stringify({
        state: "ON",
        brightness,
        color_temp: Math.round(1000000 / boundedKelvin),
      }),
    };
  }

  function reconcileLedBar(msg) {
    const payload = objectPayload(msg.payload);
    const isSwitch = controls.some((item) => item.switchTopic === msg.topic);

    if (isSwitch) {
      if (payload.state === "ON" || payload.state === "OFF") {
        switchStates.set(msg.topic, payload.state);
      }
      const reportedBrightness = zigbeeBrightness(payload.brightness);
      if (reportedBrightness !== undefined) {
        switchBrightness.set(msg.topic, reportedBrightness);
      }
      return null;
    }

    const targetControls = controls.filter((item) => item.targetTopic === msg.topic);
    if (targetControls.length === 0) return null;

    const hasState = payload.state === "ON" || payload.state === "OFF";
    const desiredBrightness = zigbeeBrightness(payload.brightness);
    const hasBrightness = desiredBrightness !== undefined && payload.state !== "OFF";
    if (!hasState && !hasBrightness) return null;

    const commands = [];
    for (const control of targetControls) {
      const stateMatches = !hasState || switchStates.get(control.switchTopic) === payload.state;
      const brightnessMatches =
        !hasBrightness || switchBrightness.get(control.switchTopic) === desiredBrightness;
      if (stateMatches && brightnessMatches) continue;

      const command = {};
      if (!stateMatches) command.state = payload.state;
      // Bar fill follows brightness. Z2M LED color/intensity settings stay authoritative.
      if (!brightnessMatches) command.brightness = desiredBrightness;

      commands.push({
        topic: `${control.switchTopic}/set`,
        payload: JSON.stringify(command),
      });
    }

    // A Node-RED Function node uses an array-of-messages to send several
    // commands through one output (for multiple switches sharing one group).
    return commands.length > 0 ? [commands] : null;
  }

  return { buildDoubleTap, reconcileLedBar };
};

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const createInovelliControl = require("../lib/inovelli-control.js");

const kitchen = {
  name: "Kitchen",
  switchTopic: "zigbee2mqtt/Kitchen Switch",
  targetTopic: "zigbee2mqtt/Kitchen Group",
  upColorTempK: 4000,
  downColorTempK: 2200,
  downBrightnessPercent: 20,
};

test("double tap up always sets 100% and the configured color temperature", () => {
  const control = createInovelliControl([kitchen]);
  const result = control.buildDoubleTap({
    topic: kitchen.switchTopic,
    payload: { action: "up_double" },
  });

  assert.equal(result.topic, `${kitchen.targetTopic}/set`);
  assert.deepEqual(JSON.parse(result.payload), {
    state: "ON",
    brightness: 254,
    color_temp: 250,
  });
});

test("double tap down applies its configured brightness and temperature", () => {
  const control = createInovelliControl([kitchen]);
  const result = control.buildDoubleTap({
    topic: kitchen.switchTopic,
    payload: JSON.stringify({ action: "down_double" }),
  });

  assert.deepEqual(JSON.parse(result.payload), {
    state: "ON",
    brightness: 51,
    color_temp: 455,
  });
});

test("a target report updates only switch fields that differ", () => {
  const control = createInovelliControl([kitchen]);
  control.reconcileLedBar({
    topic: kitchen.switchTopic,
    payload: { state: "ON", brightness: 51 },
  });

  const [commands] = control.reconcileLedBar({
    topic: kitchen.targetTopic,
    payload: { state: "ON", brightness: 254 },
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0].topic, `${kitchen.switchTopic}/set`);
  assert.deepEqual(JSON.parse(commands[0].payload), { brightness: 254 });
});

test("one group report can synchronize multiple configured switches", () => {
  const secondSwitch = {
    ...kitchen,
    name: "Second kitchen switch",
    switchTopic: "zigbee2mqtt/Second Kitchen Switch",
  };
  const control = createInovelliControl([kitchen, secondSwitch]);

  const [commands] = control.reconcileLedBar({
    topic: kitchen.targetTopic,
    payload: { state: "OFF", brightness: 127 },
  });

  assert.deepEqual(
    commands.map((message) => message.topic),
    [`${kitchen.switchTopic}/set`, `${secondSwitch.switchTopic}/set`],
  );
  assert.deepEqual(
    commands.map((message) => JSON.parse(message.payload)),
    [{ state: "OFF" }, { state: "OFF" }],
  );
});

test("unrelated MQTT events are ignored", () => {
  const control = createInovelliControl([kitchen]);
  assert.equal(
    control.reconcileLedBar({ topic: "zigbee2mqtt/Other", payload: { state: "ON" } }),
    null,
  );
  assert.equal(
    control.buildDoubleTap({ topic: "zigbee2mqtt/Other", payload: { action: "up_double" } }),
    null,
  );
});

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const config = require("../config.js");
const settings = require("../settings.js");

test("settings manifest loads MQTT config, controls, and the application module", () => {
  assert.equal(settings.flowFile, "flows.json");
  assert.equal(process.env.MQTT_HOST, config.mqtt.host);
  assert.equal(process.env.MQTT_PORT, String(config.mqtt.port));
  assert.equal(process.env.Z2M_BASE_TOPIC, config.mqtt.baseTopic);
  assert.deepEqual(
    config.controls.map(({ switchTopic, targetTopic }) => ({ switchTopic, targetTopic })),
    [
      {
        switchTopic: "zigbee2mqtt/Kitchen Sink Switch",
        targetTopic: "zigbee2mqtt/KitchenSinkLightGroup",
      },
      {
        switchTopic: "zigbee2mqtt/KitchenSwitch",
        targetTopic: "zigbee2mqtt/KitchenLights",
      },
    ],
  );
  assert.equal(
    typeof settings.functionGlobalContext.inovelliControl.buildDoubleTap,
    "function",
  );
  assert.equal(
    typeof settings.functionGlobalContext.inovelliControl.reconcileLedBar,
    "function",
  );
});

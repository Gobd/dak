"use strict";

module.exports = {
  mqtt: {
    host: "localhost",
    port: 1883,
    baseTopic: "zigbee2mqtt",
  },

  controls: [
    {
      name: "KitchenSinkLight",
      switchTopic: "zigbee2mqtt/Kitchen Sink Switch",
      targetTopic: "zigbee2mqtt/KitchenSinkLightGroup",
      upColorTempK: 5400,
      downColorTempK: 2200,
      downBrightnessPercent: 20,
    },
    {
      name: "KitchenLights",
      switchTopic: "zigbee2mqtt/KitchenSwitch",
      targetTopic: "zigbee2mqtt/KitchenLights",
      upColorTempK: 5400,
      downColorTempK: 2200,
      downBrightnessPercent: 20,
    },
  ],
};

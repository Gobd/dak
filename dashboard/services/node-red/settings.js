const config = require("./config.js");
const createInovelliControl = require("./lib/inovelli-control.js");

process.env.MQTT_HOST = config.mqtt.host;
process.env.MQTT_PORT = String(config.mqtt.port);
process.env.Z2M_BASE_TOPIC = config.mqtt.baseTopic;

module.exports = {
  flowFile: "flows.json",
  functionGlobalContext: {
    inovelliControl: createInovelliControl(config.controls),
  },
};

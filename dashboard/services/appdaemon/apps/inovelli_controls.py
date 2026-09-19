"""AppDaemon adapter for the Inovelli Zigbee2MQTT controller."""

from __future__ import annotations

import json
from typing import Any

from appdaemon.plugins import mqtt
from inovelli_control import InovelliController


class InovelliControls(mqtt.Mqtt):
    def initialize(self) -> None:
        self.controller = InovelliController(self.args.get("controls", []))
        for topic in sorted(self.controller.topics):
            self.mqtt_subscribe(topic, namespace="mqtt")
        self.listen_event(self.mqtt_message, "MQTT_MESSAGE", namespace="mqtt")
        self.log(f"Listening for {len(self.controller.controls)} Inovelli control(s)")

    def mqtt_message(self, _event_name: str, data: dict[str, Any], _kwargs: dict[str, Any]) -> None:
        topic = data.get("topic")
        if topic not in self.controller.topics:
            return

        payload = data.get("payload")
        for command in self.controller.handle(topic, payload):
            encoded_payload = json.dumps(command.payload, separators=(",", ":"))
            self.mqtt_publish(
                command.topic,
                encoded_payload,
                namespace="mqtt",
            )

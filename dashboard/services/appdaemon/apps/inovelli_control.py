"""Pure Zigbee2MQTT message handling for Inovelli controls."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Command:
    topic: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class Control:
    name: str
    switch_topic: str
    target_topic: str
    up_color_temp_k: float = 4000
    down_color_temp_k: float = 2200
    down_brightness_percent: float = 20

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> Control:
        if not value.get("switch_topic") or not value.get("target_topic"):
            raise ValueError("each control requires switch_topic and target_topic")
        return cls(**value)


def _object_payload(value: Any) -> dict[str, Any]:
    if isinstance(value, bytes):
        value = value.decode(errors="replace")
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return {}
    return value if isinstance(value, dict) else {}


def _zigbee_brightness(value: Any) -> int | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return max(1, min(254, round(number)))


class InovelliController:
    """Translate switch actions and reconcile switch LEDs with group reports."""

    def __init__(self, controls: list[dict[str, Any]]) -> None:
        if not isinstance(controls, list):
            raise TypeError("controls must be a list")
        self.controls = [Control.from_dict(item) for item in controls]
        self._by_switch = {item.switch_topic: item for item in self.controls}
        self._by_target: dict[str, list[Control]] = {}
        for item in self.controls:
            self._by_target.setdefault(item.target_topic, []).append(item)
        self._switch_states: dict[str, str] = {}
        self._switch_brightness: dict[str, int] = {}

    @property
    def topics(self) -> set[str]:
        return set(self._by_switch) | set(self._by_target)

    def handle(self, topic: str, raw_payload: Any) -> list[Command]:
        payload = _object_payload(raw_payload)
        commands = self._double_tap(topic, payload)
        commands.extend(self._reconcile_led_bar(topic, payload))
        return commands

    def _double_tap(self, topic: str, payload: dict[str, Any]) -> list[Command]:
        control = self._by_switch.get(topic)
        action = payload.get("action")
        if control is None or action not in {"up_double", "down_double"}:
            return []

        if action == "up_double":
            kelvin = control.up_color_temp_k
            brightness = 254
        else:
            kelvin = control.down_color_temp_k
            percent = max(1, min(100, control.down_brightness_percent))
            brightness = round(percent * 254 / 100)

        kelvin = max(1000, min(10000, kelvin))
        return [
            Command(
                topic=f"{control.target_topic}/set",
                payload={
                    "state": "ON",
                    "brightness": brightness,
                    "color_temp": round(1_000_000 / kelvin),
                },
            ),
            Command(
                topic=f"{control.switch_topic}/set",
                payload={"state": "ON", "brightness": brightness},
            ),
        ]

    def _reconcile_led_bar(self, topic: str, payload: dict[str, Any]) -> list[Command]:
        if topic in self._by_switch:
            if payload.get("state") in {"ON", "OFF"}:
                self._switch_states[topic] = payload["state"]
            brightness = _zigbee_brightness(payload.get("brightness"))
            if brightness is not None:
                self._switch_brightness[topic] = brightness
            return []

        controls = self._by_target.get(topic, [])
        state = payload.get("state")
        has_state = state in {"ON", "OFF"}
        brightness = _zigbee_brightness(payload.get("brightness"))
        has_brightness = brightness is not None and state != "OFF"
        if not controls or (not has_state and not has_brightness):
            return []

        commands: list[Command] = []
        for control in controls:
            command: dict[str, Any] = {}
            if has_state and self._switch_states.get(control.switch_topic) != state:
                command["state"] = state
            if has_brightness and self._switch_brightness.get(control.switch_topic) != brightness:
                command["brightness"] = brightness
            if command:
                commands.append(Command(f"{control.switch_topic}/set", command))
        return commands

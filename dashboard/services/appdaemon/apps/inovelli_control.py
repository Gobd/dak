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
    down_held_color_temp_k: float = 3000
    down_held_brightness_percent: float = 50

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> Control:
        if not value.get("switch_topic") or not value.get("target_topic"):
            raise ValueError("each control requires switch_topic and target_topic")
        return cls(**value)


@dataclass(frozen=True)
class PendingPreset:
    brightness: int
    color_temp: int
    waiting_for_on: bool = False


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


def _zigbee_color_temp(value: Any) -> int | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number <= 0:
        return None
    return round(number)


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
        self._target_states: dict[str, str] = {}
        self._target_brightness: dict[str, int] = {}
        self._target_color_temp: dict[str, int] = {}
        self._switch_brightness: dict[str, int] = {}
        self._pending_brightness: dict[str, int] = {}
        self._pending_presets: dict[str, int] = {}
        self._pending_attribute_presets: dict[str, PendingPreset] = {}
        self._held_switches: set[str] = set()

    @property
    def topics(self) -> set[str]:
        return set(self._by_switch) | set(self._by_target)

    def handle(self, topic: str, raw_payload: Any) -> list[Command]:
        payload = _object_payload(raw_payload)
        commands = self._double_tap(topic, payload)
        commands.extend(self._reconcile_led_bar(topic, payload))
        commands.extend(self._down_hold_when_off(topic, payload))
        return commands

    def _down_hold_when_off(self, topic: str, payload: dict[str, Any]) -> list[Command]:
        control = self._by_switch.get(topic)
        if control is None or payload.get("action") != "down_held":
            return []

        # A state included with the action is the freshest indication. If the
        # action has no state, use the group's last report, then the directly
        # bound switch's last report.
        state = payload.get("state")
        if state not in {"ON", "OFF"}:
            state = self._target_states.get(control.target_topic)
        if state is None:
            state = self._switch_states.get(topic)
        if state != "OFF":
            return []

        kelvin = max(1000, min(10000, control.down_held_color_temp_k))
        percent = max(1, min(100, control.down_held_brightness_percent))
        brightness = round(percent * 254 / 100)
        color_temp = round(1_000_000 / kelvin)
        return self._start_attribute_then_on(control, brightness, color_temp)

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
        color_temp = round(1_000_000 / kelvin)
        state = payload.get("state")
        if state not in {"ON", "OFF"}:
            state = self._target_states.get(control.target_topic)
        if state is None:
            state = self._switch_states.get(topic)
        if state == "OFF":
            return self._start_attribute_then_on(control, brightness, color_temp)

        self._pending_attribute_presets.pop(topic, None)
        self._switch_states[topic] = "ON"
        self._target_states[control.target_topic] = "ON"
        self._pending_brightness[topic] = brightness
        self._pending_presets[topic] = brightness
        return [
            Command(
                topic=f"{control.target_topic}/set",
                payload={
                    "state": "ON",
                    "brightness": brightness,
                    "color_temp": color_temp,
                },
            ),
            Command(
                topic=f"{control.switch_topic}/set",
                payload={"state": "ON", "brightness": brightness},
            ),
        ]

    def _reconcile_led_bar(self, topic: str, payload: dict[str, Any]) -> list[Command]:
        if topic in self._by_switch:
            action = payload.get("action")
            if action in {"up_single", "down_single", "up_held", "down_held"}:
                self._pending_attribute_presets.pop(topic, None)
            if action in {
                "up_single",
                "down_single",
                "up_held",
                "down_held",
                "up_release",
                "down_release",
            }:
                self._pending_presets.pop(topic, None)
                self._pending_brightness.pop(topic, None)
            if action in {"up_held", "down_held"}:
                self._held_switches.add(topic)
                self._pending_brightness.pop(topic, None)
            elif action in {"up_release", "down_release"}:
                self._held_switches.discard(topic)

            if payload.get("state") in {"ON", "OFF"}:
                self._switch_states[topic] = payload["state"]
            brightness = _zigbee_brightness(payload.get("brightness"))
            if brightness is not None:
                pending = self._pending_brightness.get(topic)
                if pending is None or brightness == pending:
                    self._switch_brightness[topic] = brightness
                if brightness == pending:
                    self._pending_brightness.pop(topic, None)
            return []

        controls = self._by_target.get(topic, [])
        state = payload.get("state")
        has_state = state in {"ON", "OFF"}
        brightness = _zigbee_brightness(payload.get("brightness"))
        color_temp = _zigbee_color_temp(payload.get("color_temp"))
        has_brightness = brightness is not None and state != "OFF"
        has_color_temp = color_temp is not None
        if not controls or (not has_state and not has_brightness and not has_color_temp):
            if has_brightness:
                self._target_brightness[topic] = brightness
            if has_color_temp:
                self._target_color_temp[topic] = color_temp
            return []

        if has_state:
            self._target_states[topic] = state
        if brightness is not None:
            self._target_brightness[topic] = brightness
        if has_color_temp:
            self._target_color_temp[topic] = color_temp

        commands: list[Command] = []
        for control in controls:
            pending_preset = self._pending_attribute_presets.get(control.switch_topic)
            if pending_preset is not None:
                commands.extend(
                    self._advance_attribute_preset(
                        control,
                        pending_preset,
                        state if has_state else None,
                    )
                )
                continue

            if control.switch_topic in self._held_switches:
                continue

            pending_preset = self._pending_presets.get(control.switch_topic)
            if pending_preset is not None:
                # Z2M can publish intermediate group levels while the preset
                # command is settling. Echoing those levels to the directly
                # bound switch creates a feedback loop and can interrupt a
                # subsequent paddle hold.
                if state != "ON" or brightness != pending_preset:
                    continue
                self._pending_presets.pop(control.switch_topic, None)

            command: dict[str, Any] = {}
            if has_state and self._switch_states.get(control.switch_topic) != state:
                command["state"] = state
            brightness_matches = (
                self._switch_brightness.get(control.switch_topic) == brightness
                or self._pending_brightness.get(control.switch_topic) == brightness
            )
            if has_brightness and not brightness_matches:
                command["brightness"] = brightness
            if command:
                commands.append(Command(f"{control.switch_topic}/set", command))
                if "brightness" in command:
                    self._pending_brightness[control.switch_topic] = command["brightness"]
        return commands

    def _start_attribute_then_on(
        self,
        control: Control,
        brightness: int,
        color_temp: int,
    ) -> list[Command]:
        self._pending_attribute_presets[control.switch_topic] = PendingPreset(
            brightness,
            color_temp,
        )
        # Require fresh reports for both attributes. A cached match from before
        # the action is not confirmation that this preset reached the group.
        self._target_brightness.pop(control.target_topic, None)
        self._target_color_temp.pop(control.target_topic, None)
        return [
            Command(
                topic=f"{control.target_topic}/set",
                payload={"brightness": brightness, "color_temp": color_temp},
            )
        ]

    def _advance_attribute_preset(
        self,
        control: Control,
        pending: PendingPreset,
        state: str | None,
    ) -> list[Command]:
        target = control.target_topic
        attributes_match = (
            self._target_brightness.get(target) == pending.brightness
            and self._target_color_temp.get(target) == pending.color_temp
        )

        if pending.waiting_for_on:
            if state != "ON":
                return []
            self._pending_attribute_presets.pop(control.switch_topic, None)
            self._switch_states[control.switch_topic] = "ON"
            self._pending_brightness[control.switch_topic] = pending.brightness
            self._pending_presets[control.switch_topic] = pending.brightness
            return [
                Command(
                    topic=f"{control.switch_topic}/set",
                    payload={
                        "state": "ON",
                        "brightness": pending.brightness,
                    },
                )
            ]

        if not attributes_match:
            return []

        if state == "ON":
            self._pending_attribute_presets.pop(control.switch_topic, None)
            self._switch_states[control.switch_topic] = "ON"
            self._pending_brightness[control.switch_topic] = pending.brightness
            self._pending_presets[control.switch_topic] = pending.brightness
            return [
                Command(
                    topic=f"{control.switch_topic}/set",
                    payload={
                        "state": "ON",
                        "brightness": pending.brightness,
                    },
                )
            ]

        self._pending_attribute_presets[control.switch_topic] = PendingPreset(
            pending.brightness,
            pending.color_temp,
            waiting_for_on=True,
        )
        return [Command(topic=f"{target}/set", payload={"state": "ON"})]

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "apps"))

from inovelli_control import InovelliController

KITCHEN = {
    "name": "Kitchen",
    "switch_topic": "zigbee2mqtt/Kitchen Switch",
    "target_topic": "zigbee2mqtt/Kitchen Group",
    "up_color_temp_k": 4000,
    "down_color_temp_k": 2200,
    "down_brightness_percent": 20,
    "down_held_color_temp_k": 3000,
    "down_held_brightness_percent": 50,
}


class InovelliControllerTests(unittest.TestCase):
    def test_double_tap_up(self):
        controller = InovelliController([KITCHEN])
        commands = controller.handle(KITCHEN["switch_topic"], {"action": "up_double"})
        assert len(commands) == 2
        assert commands[0].topic == f"{KITCHEN['target_topic']}/set"
        assert commands[0].payload == {
            "state": "ON",
            "brightness": 254,
            "color_temp": 250,
        }
        assert commands[1].topic == f"{KITCHEN['switch_topic']}/set"
        assert commands[1].payload == {"state": "ON", "brightness": 254}

    def test_double_tap_down_accepts_json(self):
        controller = InovelliController([KITCHEN])
        commands = controller.handle(KITCHEN["switch_topic"], json.dumps({"action": "down_double"}))
        assert len(commands) == 2
        assert commands[0].payload == {
            "state": "ON",
            "brightness": 51,
            "color_temp": 455,
        }
        assert commands[1].topic == f"{KITCHEN['switch_topic']}/set"
        assert commands[1].payload == {"state": "ON", "brightness": 51}

    def test_double_tap_led_command_is_not_duplicated_while_acknowledgment_is_pending(self):
        controller = InovelliController([KITCHEN])
        controller.handle(KITCHEN["switch_topic"], {"action": "down_double"})
        controller.handle(KITCHEN["switch_topic"], {"state": "ON", "brightness": 245})

        assert controller.handle(KITCHEN["target_topic"], {"state": "ON", "brightness": 51}) == []
        assert controller.handle(KITCHEN["target_topic"], {"state": "ON", "brightness": 51}) == []

    def test_preset_ignores_transient_group_brightness_until_it_lands(self):
        controller = InovelliController([KITCHEN])
        controller.handle(KITCHEN["switch_topic"], {"action": "up_double"})

        assert controller.handle(KITCHEN["target_topic"], {"state": "ON", "brightness": 60}) == []
        assert controller.handle(KITCHEN["target_topic"], {"state": "ON", "brightness": 254}) == []

    def test_down_preset_also_ignores_transient_group_brightness(self):
        controller = InovelliController([KITCHEN])
        controller.handle(KITCHEN["switch_topic"], {"action": "down_double"})

        assert controller.handle(KITCHEN["target_topic"], {"state": "ON", "brightness": 180}) == []
        assert controller.handle(KITCHEN["target_topic"], {"state": "ON", "brightness": 51}) == []

    def test_down_hold_turns_off_group_on_with_its_own_preset(self):
        controller = InovelliController([KITCHEN])
        controller.handle(KITCHEN["target_topic"], {"state": "OFF", "brightness": 0})

        commands = controller.handle(
            KITCHEN["switch_topic"], {"action": "down_held"}
        )

        assert [command.topic for command in commands] == [
            f"{KITCHEN['target_topic']}/set",
            f"{KITCHEN['switch_topic']}/set",
        ]
        assert commands[0].payload == {
            "state": "ON",
            "brightness": 127,
            "color_temp": 333,
        }
        assert commands[1].payload == {"state": "ON", "brightness": 127}

    def test_down_hold_does_not_override_an_already_on_light(self):
        controller = InovelliController([KITCHEN])
        controller.handle(
            KITCHEN["target_topic"], {"state": "ON", "brightness": 200}
        )

        assert controller.handle(
            KITCHEN["switch_topic"], {"action": "down_held"}
        ) == []

    def test_down_hold_can_use_switch_state_before_group_report(self):
        controller = InovelliController([KITCHEN])
        controller.handle(KITCHEN["switch_topic"], {"state": "OFF"})

        commands = controller.handle(
            KITCHEN["switch_topic"], {"action": "down_held"}
        )

        assert commands[0].payload == {
            "state": "ON",
            "brightness": 127,
            "color_temp": 333,
        }

    def test_down_hold_uses_current_off_state_on_the_action(self):
        controller = InovelliController([KITCHEN])
        controller.handle(
            KITCHEN["target_topic"], {"state": "ON", "brightness": 200}
        )

        commands = controller.handle(
            KITCHEN["switch_topic"], {"action": "down_held", "state": "OFF"}
        )

        assert commands[0].payload == {
            "state": "ON",
            "brightness": 127,
            "color_temp": 333,
        }

    def test_bound_single_tap_down_is_not_reasserted_by_preset_state(self):
        controller = InovelliController([KITCHEN])
        controller.handle(KITCHEN["switch_topic"], {"action": "down_double"})
        controller.handle(
            KITCHEN["switch_topic"],
            {"action": "down_single", "state": "ON", "brightness": 51},
        )

        # The single-tap off is sent by the switch's direct group binding. The
        # controller must only mirror the resulting group state to the LED bar.
        commands = controller.handle(
            KITCHEN["target_topic"], {"state": "OFF", "brightness": 0}
        )
        assert len(commands) == 1
        assert commands[0].topic == f"{KITCHEN['switch_topic']}/set"
        assert commands[0].payload == {"state": "OFF"}

    def test_group_report_updates_only_different_switch_fields(self):
        controller = InovelliController([KITCHEN])
        controller.handle(KITCHEN["switch_topic"], {"state": "ON", "brightness": 51})
        commands = controller.handle(KITCHEN["target_topic"], {"state": "ON", "brightness": 254})
        assert len(commands) == 1
        assert commands[0].payload == {"brightness": 254}

    def test_group_report_updates_multiple_switches(self):
        second = {
            **KITCHEN,
            "name": "Second kitchen switch",
            "switch_topic": "zigbee2mqtt/Second Kitchen Switch",
        }
        controller = InovelliController([KITCHEN, second])
        commands = controller.handle(KITCHEN["target_topic"], {"state": "OFF", "brightness": 127})
        assert [command.topic for command in commands] == [
            f"{KITCHEN['switch_topic']}/set",
            f"{second['switch_topic']}/set",
        ]
        assert [command.payload for command in commands] == [{"state": "OFF"}] * 2

    def test_group_reconciliation_does_not_interrupt_active_hold(self):
        controller = InovelliController([KITCHEN])
        controller.handle(
            KITCHEN["switch_topic"],
            {"action": "up_held", "state": "ON", "brightness": 51},
        )

        assert controller.handle(KITCHEN["target_topic"], {"state": "ON", "brightness": 100}) == []

        controller.handle(
            KITCHEN["switch_topic"],
            {"action": "up_release", "state": "ON", "brightness": 100},
        )
        assert controller.handle(KITCHEN["target_topic"], {"state": "ON", "brightness": 120})[
            0
        ].payload == {"brightness": 120}

    def test_unrelated_and_invalid_events_are_ignored(self):
        controller = InovelliController([KITCHEN])
        assert controller.handle("zigbee2mqtt/Other", "not json") == []


if __name__ == "__main__":
    unittest.main()

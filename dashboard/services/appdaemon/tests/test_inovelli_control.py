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
}


class InovelliControllerTests(unittest.TestCase):
    def test_double_tap_up(self):
        controller = InovelliController([KITCHEN])
        commands = controller.handle(KITCHEN["switch_topic"], {"action": "up_double"})
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
        assert commands[0].payload == {
            "state": "ON",
            "brightness": 51,
            "color_temp": 455,
        }
        assert commands[1].topic == f"{KITCHEN['switch_topic']}/set"
        assert commands[1].payload == {"state": "ON", "brightness": 51}

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

    def test_unrelated_and_invalid_events_are_ignored(self):
        controller = InovelliController([KITCHEN])
        assert controller.handle("zigbee2mqtt/Other", "not json") == []


if __name__ == "__main__":
    unittest.main()

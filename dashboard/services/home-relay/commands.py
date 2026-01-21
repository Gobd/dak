"""Voice command definitions - shared between relay and voice_control service."""

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class VoiceCommand:
    """A registered voice command."""

    name: str
    patterns: list[re.Pattern[str]]
    handler: Callable[[dict[str, Any]], dict[str, Any]]
    help_text: str
    examples: list[str]


# Global command registry
COMMANDS: list[VoiceCommand] = []


def command(name: str, patterns: list[str], help_text: str, examples: list[str]):
    """Register a voice command with patterns and handler."""

    def decorator(func):
        COMMANDS.append(
            VoiceCommand(
                name=name,
                patterns=[re.compile(p, re.IGNORECASE) for p in patterns],
                handler=func,
                help_text=help_text,
                examples=examples,
            )
        )
        return func

    return decorator


def parse_command(text: str) -> tuple[VoiceCommand, dict] | None:
    """Match text against registered commands."""
    for cmd in COMMANDS:
        for pattern in cmd.patterns:
            match = pattern.search(text)
            if match:
                return cmd, match.groupdict()
    return None


# =============================================================================
# COMMANDS
# =============================================================================

HOME_RELAY_URL = "http://localhost:5111"


def _post_command(cmd_type: str, **kwargs) -> dict:
    """Post a voice command to the relay for SSE broadcast."""
    try:
        response = httpx.post(
            f"{HOME_RELAY_URL}/voice/command",
            json={"type": cmd_type, **kwargs},
            timeout=5,
        )
        return {"success": response.is_success}
    except Exception:
        return {"success": False, "message": "Failed to send command"}


@command(
    name="add_to_list",
    patterns=[
        r"add (?P<item>.+?) to (?P<list>[\w\s]+?)(?:\s+list)?$",
        r"put (?P<item>.+?) on (?P<list>[\w\s]+?)(?:\s+list)?$",
    ],
    help_text="Add item to a list (groceries, shopping, etc)",
    examples=[
        "add cheese to groceries",
        "add milk to shopping list",
        "put eggs on grocery list",
    ],
)
def cmd_add_to_list(params: dict) -> dict:
    """Add an item to a note/list."""
    item = params["item"].strip()
    list_name = params["list"].strip()
    result = _post_command("add-to-list", item=item, list=list_name)
    result["message"] = f"Added '{item}' to {list_name}" if result["success"] else "Failed"
    return result


@command(
    name="weather",
    patterns=[
        r"what('?s| is) the weather",
        r"how('?s| is) the weather",
        r"weather forecast",
        r"today'?s (weather|forecast|high|low)",
        r"what'?s the (high|low|temperature|temp)",
    ],
    help_text="Get current indoor temp and today's forecast",
    examples=["what's the weather", "today's forecast", "what's the high"],
)
def cmd_weather(_params: dict) -> dict:
    """Get weather info: indoor temp and forecast high/low."""
    parts = []

    # Get indoor temperature from sensor
    try:
        response = httpx.get(f"{HOME_RELAY_URL}/sensors/all", timeout=5)
        if response.is_success:
            data = response.json()
            indoor = data.get("indoor", {})
            if indoor.get("temperature") is not None:
                temp = round(indoor["temperature"])
                parts.append(f"Inside it's {temp} degrees")
    except Exception:
        pass

    # Get forecast from config location using Open-Meteo
    try:
        config_response = httpx.get(f"{HOME_RELAY_URL}/config", timeout=5)
        if config_response.is_success:
            config = config_response.json()
            location = config.get("globalSettings", {}).get("defaultLocation", {})
            lat = location.get("lat")
            lon = location.get("lon")

            if lat and lon:
                weather_url = (
                    f"https://api.open-meteo.com/v1/forecast?"
                    f"latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min"
                    f"&temperature_unit=fahrenheit&timezone=auto&forecast_days=1"
                )
                weather_response = httpx.get(weather_url, timeout=10)
                if weather_response.is_success:
                    weather = weather_response.json()
                    daily = weather.get("daily", {})
                    highs = daily.get("temperature_2m_max", [])
                    lows = daily.get("temperature_2m_min", [])
                    if highs and lows:
                        high = round(highs[0])
                        low = round(lows[0])
                        parts.append(f"Today's high is {high}, low is {low}")
    except Exception:
        pass

    if not parts:
        return {"success": False, "message": "Weather data unavailable"}

    msg = ". ".join(parts)
    return {"success": True, "message": msg, "speak": msg}


@command(
    name="climate_check",
    patterns=[
        r"(is it|what'?s?) (warmer|cooler|hotter|colder) (outside|inside)",
        r"how (warm|cold|hot) is it (outside|inside)",
        r"(compare|check) (indoor|outdoor|inside|outside) temperature",
    ],
    help_text="Compare indoor vs outdoor temperature",
    examples=["is it warmer outside", "how hot is it inside"],
)
def cmd_climate_check(_params: dict) -> dict:
    """Check indoor/outdoor temperature comparison."""
    try:
        response = httpx.get(f"{HOME_RELAY_URL}/sensors/all", timeout=5)
        if not response.is_success:
            return {"success": False, "message": "Sensor data unavailable"}

        data = response.json()
        comparison = data.get("comparison")

        if not comparison:
            return {"success": False, "message": "Comparison data unavailable"}

        diff = abs(comparison.get("difference", 0))
        if comparison.get("outside_feels_cooler"):
            msg = f"Outside is {diff} degrees cooler"
        elif comparison.get("outside_feels_warmer"):
            msg = f"Outside is {diff} degrees hotter"
        else:
            msg = "Outside is about the same"

        return {"success": True, "message": msg, "speak": msg}
    except Exception:
        return {"success": False, "message": "Failed to check climate"}


@command(
    name="device_control",
    patterns=[
        r"turn (?P<action>on|off) (?:the )?(?P<device>.+)",
        r"(?P<device>.+) (?P<action>on|off)$",
    ],
    help_text="Turn Kasa smart devices on or off",
    examples=["turn on the lamp", "turn off bedroom light", "lamp on"],
)
def cmd_device_control(params: dict) -> dict:
    """Control Kasa smart devices."""
    device = params["device"].strip()
    action = params["action"].lower()

    try:
        response = httpx.post(
            f"{HOME_RELAY_URL}/kasa/toggle-by-name",
            json={"device": device, "state": action == "on"},
            timeout=10,
        )

        if response.is_success:
            data = response.json()
            if "error" in data:
                return {"success": False, "message": data["error"]}
            return {"success": True, "message": f"Turned {action} {device}"}
        return {"success": False, "message": f"Failed to control {device}"}
    except Exception:
        return {"success": False, "message": f"Failed to control {device}"}


@command(
    name="timer",
    patterns=[
        r"(?:start|set) (?:a )?(?P<duration>\d+) ?(?P<unit>second|minute|hour)s?"
        r"(?: timer)?(?: (?:called|named|for) (?P<name>.+))?",
        r"timer (?:for )?(?P<duration>\d+) ?(?P<unit>second|minute|hour)s?"
        r"(?: (?:called|named|for) (?P<name>.+))?",
    ],
    help_text="Start a countdown timer",
    examples=[
        "start 10 minute timer called water",
        "set a 2 hour timer for laundry",
        "timer 30 seconds",
    ],
)
def cmd_timer(params: dict) -> dict:
    """Start a countdown timer."""
    duration = int(params["duration"])
    unit = params["unit"].lower()
    name = (params.get("name") or "Timer").strip()

    multipliers = {"second": 1, "minute": 60, "hour": 3600}
    seconds = duration * multipliers.get(unit, 60)

    result = _post_command("timer", seconds=seconds, name=name)
    unit_display = unit + ("s" if duration != 1 else "")
    result["message"] = (
        f"Started {duration} {unit_display} timer: {name}" if result["success"] else "Failed"
    )
    return result


@command(
    name="stop_timer",
    patterns=[
        # Simple "stop" - for when timer is alerting
        r"^stop$",
        r"^stop (?:it|that|the alarm)$",
        # Full stop timer commands
        r"(?:stop|cancel|dismiss|clear)(?: the)?(?: (?P<name>.+))? timer",
        r"timer (?:stop|cancel|dismiss|off)",
    ],
    help_text="Stop or cancel a timer",
    examples=["stop", "stop timer", "cancel water timer", "dismiss timer"],
)
def cmd_stop_timer(params: dict) -> dict:
    """Stop or cancel a timer."""
    name = (params.get("name") or "").strip() or None
    result = _post_command("stop-timer", name=name)
    result["message"] = "Timer stopped" if result["success"] else "Failed to stop timer"
    return result


@command(
    name="add_time",
    patterns=[
        r"add (?P<duration>\d+) ?(?P<unit>second|minute|hour)s?"
        r"(?: to)?(?: (?:the )?(?P<name>.+?))?(?: timer)?$",
    ],
    help_text="Add time to a timer",
    examples=["add 5 minutes to pasta timer", "add 10 minutes"],
)
def cmd_add_time(params: dict) -> dict:
    """Add time to a timer."""
    duration = int(params["duration"])
    unit = params["unit"].lower()
    name = (params.get("name") or "").strip() or None

    multipliers = {"second": 1, "minute": 60, "hour": 3600}
    seconds = duration * multipliers.get(unit, 60)

    result = _post_command("adjust-timer", seconds=seconds, name=name)
    unit_display = unit + ("s" if duration != 1 else "")
    result["message"] = f"Added {duration} {unit_display}" if result["success"] else "Failed"
    return result


@command(
    name="subtract_time",
    patterns=[
        r"(?:subtract|remove|minus|take) (?P<duration>\d+) ?(?P<unit>second|minute|hour)s?"
        r"(?: from)?(?: (?:the )?(?P<name>.+?))?(?: timer)?$",
    ],
    help_text="Subtract time from a timer",
    examples=["subtract 5 minutes from pasta timer", "remove 2 minutes"],
)
def cmd_subtract_time(params: dict) -> dict:
    """Subtract time from a timer."""
    duration = int(params["duration"])
    unit = params["unit"].lower()
    name = (params.get("name") or "").strip() or None

    multipliers = {"second": 1, "minute": 60, "hour": 3600}
    seconds = -(duration * multipliers.get(unit, 60))

    result = _post_command("adjust-timer", seconds=seconds, name=name)
    unit_display = unit + ("s" if duration != 1 else "")
    result["message"] = f"Subtracted {duration} {unit_display}" if result["success"] else "Failed"
    return result


@command(
    name="help",
    patterns=[
        r"(what can you do|help|commands|what can i say)",
    ],
    help_text="List available voice commands",
    examples=["what can you do", "help"],
)
def cmd_help(_params: dict) -> dict:
    """List available commands."""
    lines = ["You can say:"]
    lines.extend(f"  - {cmd.examples[0]}" for cmd in COMMANDS if cmd.name != "help")
    return {"success": True, "message": "\n".join(lines)}

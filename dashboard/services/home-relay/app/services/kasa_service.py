"""Kasa smart device service.

Provides async operations via a shared event loop running in a background thread.
This avoids creating new event loops per request and handles python-kasa's async API.

Supports:
- Device discovery and control (on/off, brightness)
- Countdown timers via IotCountdown module
- Schedules via IotSchedule module
"""

import asyncio
import contextlib
import logging
import threading
from collections.abc import Coroutine
from datetime import datetime
from typing import TypeVar

from kasa import Device, Discover, Module

logger = logging.getLogger(__name__)

# Cache for discovered devices (refreshed on each discover call)
_device_cache: dict = {}

# Shared event loop for async operations
_loop: asyncio.AbstractEventLoop | None = None
_loop_thread: threading.Thread | None = None

T = TypeVar("T")

# Day name to index mapping (Kasa uses Sunday=0)
DAY_TO_INDEX = {"sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6}
INDEX_TO_DAY = {v: k for k, v in DAY_TO_INDEX.items()}

# Cache for sun times (fetched once per session)
_sun_times_cache: dict[str, int] | None = None


def _get_sun_times() -> dict[str, int] | None:
    """Get cached sunrise/sunset times."""
    global _sun_times_cache
    if _sun_times_cache is None:
        try:
            from app.routers.brightness import _fetch_sun_times

            sun = _fetch_sun_times()
            if sun.get("sunrise") and sun.get("sunset"):
                _sun_times_cache = {"sunrise": sun["sunrise"], "sunset": sun["sunset"]}
        except Exception:
            pass
    return _sun_times_cache


def get_event_loop() -> asyncio.AbstractEventLoop:
    """Get or create the shared event loop running in a background thread."""
    global _loop, _loop_thread

    if _loop is None or not _loop.is_running():
        loop = asyncio.new_event_loop()
        _loop = loop

        def run_loop():
            asyncio.set_event_loop(loop)
            loop.run_forever()

        _loop_thread = threading.Thread(target=run_loop, daemon=True)
        _loop_thread.start()
        logger.info("Started Kasa event loop thread")

    return _loop


def run_async(coro: Coroutine[None, None, T]) -> T:
    """Run an async coroutine in the shared event loop."""
    loop = get_event_loop()
    future = asyncio.run_coroutine_threadsafe(coro, loop)
    return future.result(timeout=30)


def _time_to_minutes(time_str: str) -> int:
    """Convert HH:MM to minutes from midnight."""
    hour, minute = map(int, time_str.split(":"))
    return hour * 60 + minute


def _minutes_to_time(minutes: int) -> str:
    """Convert minutes from midnight to 12-hour AM/PM format."""
    hour = minutes // 60
    minute = minutes % 60
    if hour == 0:
        return f"12:{minute:02d}am"
    if hour < 12:
        return f"{hour}:{minute:02d}am"
    if hour == 12:
        return f"12:{minute:02d}pm"
    return f"{hour - 12}:{minute:02d}pm"


def _get_device_type(dev: Device) -> str:
    """Get device type string."""
    device_type = getattr(dev, "device_type", None)
    if device_type is None:
        return "unknown"
    return device_type.name.lower() if hasattr(device_type, "name") else str(device_type).lower()


def _get_device_features(dev: Device) -> list[str]:
    """Get list of supported features."""
    modules = getattr(dev, "modules", None)
    if not modules:
        return []
    return [str(module_type).lower() for module_type in modules]


def _get_on_since(dev: Device) -> str | None:
    """Get ISO timestamp of when device was turned on."""
    if not getattr(dev, "is_on", False):
        return None
    # Try to get on_since from device info
    on_since = getattr(dev, "on_since", None)
    if on_since and isinstance(on_since, datetime):
        return on_since.isoformat()
    return None


def _get_brightness(dev: Device) -> int | None:
    """Get brightness level for dimmable devices."""
    # Check for Light module (newer python-kasa)
    modules = getattr(dev, "modules", None)
    if modules and Module.Light in modules:
        light = modules[Module.Light]
        if hasattr(light, "brightness"):
            return light.brightness
    # Fallback to direct attribute
    return getattr(dev, "brightness", None)


def _get_color_temp(dev: Device) -> int | None:
    """Get color temperature for supported devices."""
    try:
        modules = getattr(dev, "modules", None)
        if modules and Module.Light in modules:
            light = modules[Module.Light]
            if hasattr(light, "color_temp"):
                return light.color_temp
        return getattr(dev, "color_temp", None)
    except Exception:
        # Some lights don't support color temp
        return None


def _has_emeter(dev: Device) -> bool:
    """Check if device has energy monitoring."""
    modules = getattr(dev, "modules", None)
    if modules:
        return Module.Energy in modules
    return hasattr(dev, "emeter_realtime")


async def _get_emeter_data(dev: Device) -> tuple[float | None, float | None]:
    """Get power and energy data from device."""
    power = None
    energy_today = None

    modules = getattr(dev, "modules", None)
    if modules and Module.Energy in modules:
        energy = modules[Module.Energy]
        power = getattr(energy, "current_consumption", None)
        energy_today = getattr(energy, "consumption_today", None)
    elif hasattr(dev, "emeter_realtime"):
        with contextlib.suppress(Exception):
            get_realtime = getattr(dev, "get_emeter_realtime")
            realtime = await get_realtime()
            power = realtime.get("power") or realtime.get("power_mw", 0) / 1000
        with contextlib.suppress(Exception):
            get_daily = getattr(dev, "get_emeter_daily")
            daily = await get_daily()
            today = datetime.now().day
            energy_today = daily.get(today, 0)

    return power, energy_today


async def _get_countdown_info_async(
    dev: Device, *, parent: Device | None = None, child_id: str | None = None
) -> tuple[int | None, str | None]:
    """Get countdown timer info: (seconds_remaining, action).

    For child devices, pass parent device and child_id to query with context.
    """
    try:
        # Try module system first
        modules = getattr(dev, "modules", None)
        if modules and Module.IotCountdown in modules:
            countdown = modules[Module.IotCountdown]
            if hasattr(countdown, "rules") and countdown.rules:
                for rule in countdown.rules:
                    enabled = getattr(rule, "enable", 0)
                    if enabled:
                        remaining = getattr(rule, "remain", 0)
                        if remaining and remaining > 0:
                            act = getattr(rule, "act", None)
                            action = "on" if act == 1 else "off" if act == 0 else None
                            return remaining, action

        # For child devices, query parent with child context
        # child_id might be "MAC_UNIQUEID" format - Kasa only accepts the part after underscore
        protocol_dev = parent if parent and child_id else dev
        if hasattr(protocol_dev, "protocol"):
            try:
                query = {"count_down": {"get_rules": {}}}
                if child_id:
                    query_child_id = child_id.split("_")[-1] if "_" in child_id else child_id
                    query = {"context": {"child_ids": [query_child_id]}, **query}
                result = await protocol_dev.protocol.query(query)
                rules = result.get("count_down", {}).get("get_rules", {}).get("rule_list", [])
                for rule in rules:
                    if rule.get("enable", 0):
                        remaining = rule.get("remain", 0)
                        if remaining and remaining > 0:
                            act = rule.get("act", 0)
                            action = "on" if act == 1 else "off"
                            return remaining, action
            except Exception:
                pass  # Device might not support count_down
    except Exception as e:
        logger.warning("Failed to get countdown info: %s", e)
    return None, None


async def _get_next_scheduled_action(
    dev: Device, *, parent: Device | None = None, child_id: str | None = None
) -> tuple[str | None, str | None]:
    """Get next scheduled action: (action, time_str).

    For child devices, pass parent device and child_id to query with context.
    Returns the next scheduled on/off action and when it will occur.
    time_str is either "sunrise", "sunset", or "HH:MM".
    """
    try:
        rules_to_check = []

        # Try module system first
        modules = getattr(dev, "modules", None)
        if modules and Module.IotSchedule in modules:
            schedule = modules[Module.IotSchedule]
            if hasattr(schedule, "rules") and schedule.rules:
                rules_to_check = list(schedule.rules)

        # For child devices, query parent with child context
        # child_id might be "MAC_UNIQUEID" format - Kasa only accepts the part after underscore
        protocol_dev = parent if parent and child_id else dev
        if not rules_to_check and hasattr(protocol_dev, "protocol"):
            try:
                query = {"schedule": {"get_rules": {}}}
                if child_id:
                    query_child_id = child_id.split("_")[-1] if "_" in child_id else child_id
                    query = {"context": {"child_ids": [query_child_id]}, **query}
                result = await protocol_dev.protocol.query(query)
                raw_rules = result.get("schedule", {}).get("get_rules", {}).get("rule_list", [])
                rules_to_check = raw_rules
            except Exception:
                pass

        if not rules_to_check:
            return None, None

        now = datetime.now()
        today_weekday = (now.weekday() + 1) % 7  # Convert to Sunday=0 format
        current_minutes = now.hour * 60 + now.minute
        sun = _get_sun_times()

        best_action = None
        best_time_str = None
        best_minutes_until = float("inf")

        def get_rule_val(rule, key: str, default=None):
            """Get value from rule object or dict."""
            if isinstance(rule, dict):
                return rule.get(key, default)
            return getattr(rule, key, default)

        for rule in rules_to_check:
            if not get_rule_val(rule, "enable", 0):
                continue

            # Get action
            sact = get_rule_val(rule, "sact")
            if sact is not None and hasattr(sact, "value"):
                action = "on" if sact.value == 1 else "off"
            else:
                action = "on" if sact == 1 else "off"

            # Get time info
            stime_opt = get_rule_val(rule, "stime_opt", 0) or 0
            soffset = get_rule_val(rule, "soffset", 0) or 0
            smin = get_rule_val(rule, "smin", 0) or 0

            # Calculate target time in minutes from midnight
            # stime_opt: 0=specific time, 1=sunrise, 2=sunset
            if stime_opt == 1:  # Sunrise
                time_str = "sunrise" if soffset == 0 else f"sunrise{soffset:+d}m"
                target_minutes = (sun["sunrise"] // 60 % 1440 if sun else 390) + soffset
            elif stime_opt == 2:  # Sunset
                time_str = "sunset" if soffset == 0 else f"sunset{soffset:+d}m"
                target_minutes = (sun["sunset"] // 60 % 1440 if sun else 1110) + soffset
            else:
                target_minutes = smin
                hour = smin // 60
                minute = smin % 60
                if hour == 0:
                    time_str = f"12:{minute:02d}am"
                elif hour < 12:
                    time_str = f"{hour}:{minute:02d}am"
                elif hour == 12:
                    time_str = f"12:{minute:02d}pm"
                else:
                    time_str = f"{hour - 12}:{minute:02d}pm"

            # Check if this rule applies today or tomorrow
            wday = get_rule_val(rule, "wday", []) or []
            if len(wday) == 7 and all(w in (0, 1) for w in wday):
                # Boolean array format
                applies_today = wday[today_weekday] == 1
                applies_tomorrow = wday[(today_weekday + 1) % 7] == 1
            else:
                applies_today = today_weekday in wday
                applies_tomorrow = ((today_weekday + 1) % 7) in wday

            # Calculate minutes until this rule fires
            if applies_today and target_minutes > current_minutes:
                minutes_until = target_minutes - current_minutes
            elif applies_tomorrow:
                minutes_until = (1440 - current_minutes) + target_minutes
            else:
                continue  # Doesn't apply soon

            if minutes_until < best_minutes_until:
                best_minutes_until = minutes_until
                best_action = action
                best_time_str = time_str

        return best_action, best_time_str
    except Exception as e:
        logger.warning("Failed to get next scheduled action: %s", e)
        return None, None


async def _build_device_info(
    dev: Device, ip: str, *, parent: Device | None = None, child_id: str | None = None
) -> dict:
    """Build full device info dict.

    For child devices, pass parent device and child_id to query schedules/countdowns.
    """
    name = getattr(dev, "alias", None) or ip
    countdown_remaining, countdown_action = await _get_countdown_info_async(
        dev, parent=parent, child_id=child_id
    )
    next_action, next_action_at = await _get_next_scheduled_action(
        dev, parent=parent, child_id=child_id
    )

    info = {
        "name": name,
        "ip": ip,
        "on": getattr(dev, "is_on", None),
        "model": getattr(dev, "model", "unknown"),
        "type": _get_device_type(dev),
        "on_since": _get_on_since(dev),
        "brightness": _get_brightness(dev),
        "color_temp": _get_color_temp(dev),
        "has_emeter": _has_emeter(dev),
        "features": _get_device_features(dev),
        "countdown_remaining": countdown_remaining,
        "countdown_action": countdown_action,
        "next_action": next_action,
        "next_action_at": next_action_at,
    }

    # Get energy data if available
    if info["has_emeter"]:
        power, energy_today = await _get_emeter_data(dev)
        info["power_watts"] = power
        info["energy_today_kwh"] = energy_today

    return info


async def discover_devices() -> list[dict]:
    """Async device discovery with extended info."""
    global _device_cache
    logger.info("Starting Kasa device discovery...")
    devices = await Discover.discover(discovery_timeout=3)
    logger.info("Discovery found %d device(s)", len(devices))

    result = []
    for ip, dev in devices.items():
        logger.info("Processing device at %s: %s", ip, type(dev).__name__)
        try:
            await dev.update()
        except Exception as e:
            logger.warning("Failed to update device %s: %s", ip, e)

        name = getattr(dev, "alias", None) or ip
        logger.info("  Device name: %s, model: %s", name, getattr(dev, "model", "unknown"))

        # Check for child devices (multi-plug, power strips)
        children = getattr(dev, "children", None)
        if children:
            logger.info("  Device has %d child device(s)", len(children))
            for child in children:
                child_name = getattr(child, "alias", None) or "unnamed"
                child_id = getattr(child, "device_id", None) or getattr(child, "index", "?")
                logger.info("    Child: %s (id=%s)", child_name, child_id)
                if child_name.startswith("TP-LINK_"):
                    continue
                try:
                    child_id_str = str(child_id)
                    child_info = await _build_device_info(
                        child, ip, parent=dev, child_id=child_id_str
                    )
                    child_info["child_id"] = child_id_str
                    child_info["parent_name"] = name
                    result.append(child_info)
                except Exception as e:
                    logger.warning("    Failed to build info for child %s: %s", child_name, e)

        if name.startswith("TP-LINK_"):
            logger.info("  Skipping unrenamed device: %s", name)
            continue  # Skip unrenamed devices

        # Only add parent device if it has no children (avoid double-listing)
        if not children:
            _device_cache[ip] = dev
            try:
                info = await _build_device_info(dev, ip)
                result.append(info)
            except Exception as e:
                logger.warning("Failed to build info for %s: %s", name, e)
        else:
            _device_cache[ip] = dev

    logger.info("Discovery complete: %d device(s) returned", len(result))
    return result


async def toggle_device(ip: str) -> dict:
    """Toggle device on/off."""
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        if dev is None:
            return {"error": f"Device not found at {ip}"}
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()

    if dev.is_on:
        await dev.turn_off()
    else:
        await dev.turn_on()

    with contextlib.suppress(Exception):
        await dev.update()

    return {
        "ip": ip,
        "on": dev.is_on,
        "name": getattr(dev, "alias", ip),
        "on_since": _get_on_since(dev),
        "brightness": _get_brightness(dev),
    }


async def toggle_device_by_name(name: str, *, state: bool | None) -> dict:
    """Find device by name and toggle/set state."""
    global _device_cache
    name_lower = name.lower()

    # First try cache
    for ip, dev in _device_cache.items():
        dev_name = getattr(dev, "alias", "") or ""
        if name_lower in dev_name.lower():
            return await _set_device_state(dev, ip, state=state)

    # Refresh discovery if not found
    await discover_devices()

    for ip, dev in _device_cache.items():
        dev_name = getattr(dev, "alias", "") or ""
        if name_lower in dev_name.lower():
            return await _set_device_state(dev, ip, state=state)

    return {"error": f"Device '{name}' not found"}


async def _set_device_state(dev: Device, ip: str, *, state: bool | None) -> dict:
    """Set device to specific state or toggle."""
    with contextlib.suppress(Exception):
        await dev.update()

    if state is None:
        # Toggle
        if dev.is_on:
            await dev.turn_off()
        else:
            await dev.turn_on()
    elif state:
        await dev.turn_on()
    else:
        await dev.turn_off()

    with contextlib.suppress(Exception):
        await dev.update()

    return {
        "ip": ip,
        "on": dev.is_on,
        "name": getattr(dev, "alias", ip),
        "on_since": _get_on_since(dev),
        "brightness": _get_brightness(dev),
    }


async def get_device_status(ip: str) -> dict:
    """Get device status with extended info."""
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        if dev is None:
            return {"error": f"Device not found at {ip}"}
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()

    return {
        "ip": ip,
        "on": dev.is_on,
        "name": getattr(dev, "alias", ip),
        "on_since": _get_on_since(dev),
        "brightness": _get_brightness(dev),
    }


async def set_brightness(ip: str, brightness: int) -> dict:
    """Set device brightness (0-100)."""
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        if dev is None:
            return {"error": f"Device not found at {ip}"}
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()

    # Set brightness through Light module
    if hasattr(dev, "modules") and Module.Light in dev.modules:
        light = dev.modules[Module.Light]
        await light.set_brightness(brightness)
    elif hasattr(dev, "set_brightness"):
        set_brightness_fn = getattr(dev, "set_brightness")
        await set_brightness_fn(brightness)
    else:
        raise ValueError("Device does not support brightness control")

    with contextlib.suppress(Exception):
        await dev.update()

    return {
        "ip": ip,
        "name": getattr(dev, "alias", ip),
        "brightness": _get_brightness(dev) or brightness,
        "on": dev.is_on,
    }


async def set_countdown(ip: str, minutes: int, action: str = "off") -> dict:
    """Set countdown timer to turn device on/off after delay.

    Uses the IotCountdown module with raw protocol commands since
    RuleModule doesn't expose add_rule directly.
    """
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        if dev is None:
            return {"error": f"Device not found at {ip}"}
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()

    enabled = False
    delay_seconds = minutes * 60
    act_value = 1 if action == "on" else 0

    # Try IotCountdown module first (python-kasa 0.9+)
    if hasattr(dev, "modules") and Module.IotCountdown in dev.modules:
        countdown = dev.modules[Module.IotCountdown]

        # Check for existing rules and clear them first
        if hasattr(countdown, "rules") and countdown.rules:
            for rule in countdown.rules:
                with contextlib.suppress(Exception):
                    await countdown.delete_rule(rule)

        # Use raw protocol to add countdown rule (enable, delay in seconds, act 0=off/1=on)
        try:
            await dev.protocol.query(
                {
                    "count_down": {
                        "add_rule": {
                            "enable": 1,
                            "delay": delay_seconds,
                            "act": act_value,
                            "name": "countdown",
                        }
                    }
                }
            )
            enabled = True
        except Exception as e:
            logger.warning("Failed to set countdown via IotCountdown protocol: %s", e)

    # Fallback: try raw protocol directly (for devices without module detection)
    if not enabled and hasattr(dev, "protocol"):
        try:
            # First try to get existing rules and delete them
            with contextlib.suppress(Exception):
                result = await dev.protocol.query({"count_down": {"get_rules": {}}})
                rules = result.get("count_down", {}).get("get_rules", {}).get("rule_list", [])
                for rule in rules:
                    rule_id = rule.get("id")
                    if rule_id:
                        await dev.protocol.query({"count_down": {"delete_rule": {"id": rule_id}}})

            # Add new countdown rule
            await dev.protocol.query(
                {
                    "count_down": {
                        "add_rule": {
                            "enable": 1,
                            "delay": delay_seconds,
                            "act": act_value,
                            "name": "countdown",
                        }
                    }
                }
            )
            enabled = True
        except Exception as e:
            logger.warning("Failed to set countdown via raw protocol: %s", e)

    # Final fallback: try legacy set_countdown method
    if not enabled and hasattr(dev, "set_countdown"):
        try:
            set_countdown_fn = getattr(dev, "set_countdown")
            await set_countdown_fn(delay_seconds, action == "on")
            enabled = True
        except Exception as e:
            logger.warning("Failed to set countdown via legacy method: %s", e)

    return {
        "ip": ip,
        "name": getattr(dev, "alias", ip),
        "minutes": minutes,
        "action": action,
        "enabled": enabled,
    }


def _parse_schedule_rules(raw_rules: list) -> list[dict]:
    """Parse raw schedule rules into our format."""
    rules = []
    for rule in raw_rules:
        try:
            # Handle both dict (raw protocol) and object (module) formats
            def get_val(key, default=None):
                if isinstance(rule, dict):
                    return rule.get(key, default)
                return getattr(rule, key, default)

            rule_id = str(get_val("id", ""))
            enabled = bool(get_val("enable", 0))

            # sact is an Action enum or int: TurnOn=1, TurnOff=0
            sact = get_val("sact", None)
            if sact is not None and hasattr(sact, "value"):
                action = "on" if sact.value == 1 else "off"
            else:
                action = "on" if sact == 1 else "off"

            # Check for sunrise/sunset rules using stime_opt
            # stime_opt: 0=specific time, 1=sunrise, 2=sunset
            stime_opt = get_val("stime_opt", 0) or 0
            soffset = get_val("soffset", 0) or 0
            offset_mins = None

            if stime_opt == 1:
                time_str = "sunrise"
                if soffset != 0:
                    offset_mins = soffset
            elif stime_opt == 2:
                time_str = "sunset"
                if soffset != 0:
                    offset_mins = soffset
            else:
                smin = get_val("smin", 0) or 0
                time_str = _minutes_to_time(smin)

            # wday can be boolean array or list of indices
            wday = get_val("wday", []) or []
            if len(wday) == 7 and all(w in (0, 1) for w in wday):
                days = [INDEX_TO_DAY[i] for i, en in enumerate(wday) if en]
            else:
                days = [INDEX_TO_DAY.get(d, "mon") for d in wday if d in INDEX_TO_DAY]

            rule_data = {
                "id": rule_id,
                "enabled": enabled,
                "action": action,
                "time": time_str,
                "days": days,
            }
            if offset_mins is not None:
                rule_data["offset_mins"] = offset_mins

            rules.append(rule_data)
        except Exception as e:
            logger.warning("Failed to parse rule: %s", e)
    return rules


async def get_schedule_rules(ip: str, *, child_id: str | None = None) -> dict:
    """Get device schedule rules.

    For child devices (multi-plugs), pass child_id to query with context.

    Rules use the IotSchedule module. Each rule has:
    - id: rule identifier
    - name: rule name
    - enable: 0/1
    - wday: list of weekday indices (Sunday=0)
    - smin: start time in minutes from midnight
    - sact: start action (TurnOn=1, TurnOff=0)
    """
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        if dev is None:
            return {"error": f"Device not found at {ip}"}
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()

    rules = []
    device_name = getattr(dev, "alias", ip)

    # For child devices, query with context
    # child_id might be "MAC_UNIQUEID" format - Kasa only accepts the part after underscore
    if child_id and hasattr(dev, "protocol"):
        try:
            query_child_id = child_id.split("_")[-1] if "_" in child_id else child_id
            result = await dev.protocol.query({
                "context": {"child_ids": [query_child_id]},
                "schedule": {"get_rules": {}},
            })
            raw_rules = result.get("schedule", {}).get("get_rules", {}).get("rule_list", [])
            rules = _parse_schedule_rules(raw_rules)

            # Get child device name
            children = getattr(dev, "children", [])
            for child in children:
                cid = getattr(child, "device_id", None) or getattr(child, "index", "")
                if str(cid) == child_id or child_id in str(cid):
                    device_name = getattr(child, "alias", device_name)
                    break

            return {"ip": ip, "name": device_name, "rules": rules}
        except Exception as e:
            logger.warning("Failed to query child schedule: %s", e)

    # Try IotSchedule module (python-kasa 0.9+)
    modules = getattr(dev, "modules", None)
    if modules and Module.IotSchedule in modules:
        schedule = dev.modules[Module.IotSchedule]
        if hasattr(schedule, "rules"):
            rules = _parse_schedule_rules(list(schedule.rules))

    return {"ip": ip, "name": device_name, "rules": rules}


async def add_schedule_rule(ip: str, action: str, time: str, days: list[str]) -> dict:
    """Add a new schedule rule to device.

    Uses raw protocol commands since RuleModule doesn't expose add_rule.
    """
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        if dev is None:
            raise ValueError(f"Device not found at {ip}")
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()

    # RuleModule doesn't expose add_rule, so we must use raw protocol
    if not hasattr(dev, "protocol"):
        raise ValueError("Device does not support schedules")

    # Convert days to indices (Sunday=0 for Kasa devices)
    day_indices = [DAY_TO_INDEX.get(d.lower(), 1) for d in days]

    # Determine time type: specific time, sunrise, or sunset
    # stime_opt: 0=specific time, 1=sunrise, 2=sunset
    if time.lower() == "sunrise":
        stime_opt = 1
        smin = 0
        soffset = 0  # No offset for now, TODO: support offset parameter
    elif time.lower() == "sunset":
        stime_opt = 2
        smin = 0
        soffset = 0
    else:
        stime_opt = 0
        smin = _time_to_minutes(time)
        soffset = 0

    # Build the rule payload for raw protocol
    # sact: 1=on, 0=off
    # stime_opt: 0=specific time, 1=sunrise, 2=sunset
    # wday: list of day indices
    # repeat: 1 if recurring
    rule_payload = {
        "name": f"schedule_{action}",
        "enable": 1,
        "sact": 1 if action == "on" else 0,
        "stime_opt": stime_opt,
        "smin": smin,
        "soffset": soffset,
        "wday": day_indices,
        "repeat": 1 if len(day_indices) > 0 else 0,
        # End action disabled
        "eact": -1,
        "etime_opt": -1,
        "emin": 0,
    }

    try:
        await dev.protocol.query({"schedule": {"add_rule": rule_payload}})
    except Exception as e:
        logger.error("Failed to add schedule rule: %s", e)
        raise ValueError(f"Failed to add schedule: {e}") from e

    with contextlib.suppress(Exception):
        await dev.update()

    return await get_schedule_rules(ip)


async def update_schedule_rule(
    ip: str,
    rule_id: str,
    enabled: bool | None = None,
    action: str | None = None,
    time: str | None = None,
    days: list[str] | None = None,
) -> dict:
    """Update an existing schedule rule.

    Uses raw protocol commands to edit the rule.
    """
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        if dev is None:
            raise ValueError(f"Device not found at {ip}")
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()

    # RuleModule doesn't expose edit_rule, so we must use raw protocol
    if not hasattr(dev, "modules") or Module.IotSchedule not in dev.modules:
        raise ValueError("Device does not support schedules")

    schedule = dev.modules[Module.IotSchedule]

    # Get existing rule values from module
    existing_rule = None
    current_enable = 1
    current_sact = 0
    current_smin = 0
    current_wday = []
    current_name = "schedule"

    if hasattr(schedule, "rules"):
        for r in schedule.rules:
            if str(getattr(r, "id", "")) == rule_id:
                existing_rule = r
                current_enable = getattr(r, "enable", 1)
                current_sact = getattr(r, "sact", None)
                if current_sact is not None and hasattr(current_sact, "value"):
                    current_sact = current_sact.value
                current_smin = getattr(r, "smin", 0) or 0
                current_wday = getattr(r, "wday", []) or []
                current_name = getattr(r, "name", "schedule")
                break

    if not existing_rule:
        raise ValueError(f"Rule {rule_id} not found")

    # Get current stime_opt and soffset
    current_stime_opt = getattr(existing_rule, "stime_opt", 0) or 0
    current_soffset = getattr(existing_rule, "soffset", 0) or 0

    # Apply updates
    new_enable = (1 if enabled else 0) if enabled is not None else current_enable
    new_sact = (1 if action == "on" else 0) if action is not None else current_sact
    new_wday = [DAY_TO_INDEX.get(d.lower(), 1) for d in days] if days is not None else current_wday

    # Handle time: could be HH:MM, "sunrise", or "sunset"
    if time is not None:
        if time.lower() == "sunrise":
            new_stime_opt = 1
            new_smin = 0
            new_soffset = 0
        elif time.lower() == "sunset":
            new_stime_opt = 2
            new_smin = 0
            new_soffset = 0
        else:
            new_stime_opt = 0
            new_smin = _time_to_minutes(time)
            new_soffset = 0
    else:
        new_stime_opt = current_stime_opt
        new_smin = current_smin
        new_soffset = current_soffset

    rule_payload = {
        "id": rule_id,
        "name": current_name,
        "enable": new_enable,
        "sact": new_sact,
        "stime_opt": new_stime_opt,
        "smin": new_smin,
        "soffset": new_soffset,
        "wday": new_wday,
        "repeat": 1 if len(new_wday) > 0 else 0,
        "eact": -1,
        "etime_opt": -1,
        "emin": 0,
    }

    try:
        await dev.protocol.query({"schedule": {"edit_rule": rule_payload}})
    except Exception as e:
        logger.error("Failed to update schedule rule: %s", e)
        raise ValueError(f"Failed to update schedule: {e}") from e

    with contextlib.suppress(Exception):
        await dev.update()

    return await get_schedule_rules(ip)


async def delete_schedule_rule(ip: str, rule_id: str) -> dict:
    """Delete a schedule rule."""
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        if dev is None:
            raise ValueError(f"Device not found at {ip}")
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()

    if not hasattr(dev, "modules") or Module.IotSchedule not in dev.modules:
        raise ValueError("Device does not support schedules")

    schedule = dev.modules[Module.IotSchedule]

    # Find and delete the rule using module API
    rule_to_delete = None
    if hasattr(schedule, "rules"):
        for r in schedule.rules:
            if str(getattr(r, "id", "")) == rule_id:
                rule_to_delete = r
                break

    if not rule_to_delete:
        raise ValueError(f"Rule {rule_id} not found")

    await schedule.delete_rule(rule_to_delete)

    with contextlib.suppress(Exception):
        await dev.update()

    return await get_schedule_rules(ip)

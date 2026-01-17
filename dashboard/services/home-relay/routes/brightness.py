"""Brightness control endpoints."""

import re
import subprocess
import time
from datetime import date, datetime

import httpx
from flask import Blueprint, jsonify, request

bp = Blueprint("brightness", __name__, url_prefix="/brightness")

# Cache for sun times (refreshed daily)
_sun_cache = {"date": None, "sunrise": None, "sunset": None}

# Config loader - set by main app
_load_config = None


def init_app(load_config_fn):
    """Initialize with config loader from main app."""
    global _load_config
    _load_config = load_config_fn


def _get_current():
    """Get current brightness level from ddcutil."""
    try:
        proc = subprocess.run(
            ["ddcutil", "getvcp", "10"],
            capture_output=True,
            timeout=10,
        )
        if proc.returncode == 0:
            match = re.search(r"current value\s*=\s*(\d+)", proc.stdout.decode())
            if match:
                return int(match.group(1))
    except Exception:
        pass
    return None


def _set_level(level: int) -> dict:
    """Set brightness level via ddcutil."""
    level = max(1, min(100, level))
    try:
        result = subprocess.run(
            ["ddcutil", "setvcp", "10", str(level), "--noverify"],
            capture_output=True,
            timeout=10,
        )
        if result.returncode == 0:
            return {"success": True, "level": level}
        return {"error": result.stderr.decode()}
    except FileNotFoundError:
        return {"error": "ddcutil not installed"}
    except Exception as e:
        return {"error": str(e)}


def _calculate_target(
    sunrise: int, sunset: int, day_brightness: int, night_brightness: int, transition_mins: int
) -> int:
    """Calculate target brightness based on current time and sun position."""
    now = int(time.time())
    trans_secs = transition_mins * 60

    sunrise_start = sunrise - trans_secs // 2
    sunrise_end = sunrise + trans_secs // 2
    sunset_start = sunset - trans_secs // 2
    sunset_end = sunset + trans_secs // 2

    if now < sunrise_start:
        # Before sunrise transition - full night
        return night_brightness
    if now < sunrise_end:
        # During sunrise transition - gradually brighten
        progress = (now - sunrise_start) * 100 // trans_secs
        brightness_range = day_brightness - night_brightness
        return night_brightness + brightness_range * progress // 100
    if now < sunset_start:
        # Daytime - full day
        return day_brightness
    if now < sunset_end:
        # During sunset transition - gradually dim
        progress = (now - sunset_start) * 100 // trans_secs
        brightness_range = day_brightness - night_brightness
        return day_brightness - brightness_range * progress // 100
    # After sunset transition - full night
    return night_brightness


def _fetch_sun_times():
    """Fetch and cache sun times for today."""
    global _sun_cache
    today = date.today().isoformat()

    if _sun_cache["date"] == today:
        return _sun_cache

    config = _load_config()
    brightness = config.get("brightness", {})
    lat = brightness.get("lat")
    lon = brightness.get("lon")

    if not lat or not lon:
        return {"error": "Location not configured", "date": None, "sunrise": None, "sunset": None}

    try:
        resp = httpx.get(
            "https://api.sunrise-sunset.org/json",
            params={"lat": lat, "lng": lon, "formatted": 0},
            timeout=10,
        )
        data = resp.json()
        results = data.get("results", {})

        sunrise_utc = results.get("sunrise")
        sunset_utc = results.get("sunset")

        if not sunrise_utc or not sunset_utc:
            return {"error": "Invalid API response", "date": None, "sunrise": None, "sunset": None}

        sunrise_dt = datetime.fromisoformat(sunrise_utc.replace("Z", "+00:00"))
        sunset_dt = datetime.fromisoformat(sunset_utc.replace("Z", "+00:00"))

        _sun_cache = {
            "date": today,
            "sunrise": int(sunrise_dt.timestamp()),
            "sunset": int(sunset_dt.timestamp()),
        }
        return _sun_cache
    except Exception as e:
        return {"error": str(e), "date": None, "sunrise": None, "sunset": None}


@bp.route("/sun", methods=["GET"])
def sun():
    """Get today's sunrise/sunset times (cached daily)."""
    return jsonify(_fetch_sun_times())


@bp.route("/set", methods=["POST"])
def set_brightness():
    """Manually set brightness level."""
    data = request.get_json() or {}
    level = data.get("level")

    if level is None:
        return jsonify({"error": "level required"}), 400

    result = _set_level(int(level))
    if "error" in result:
        return jsonify(result), 500
    return jsonify(result)


@bp.route("/status", methods=["GET"])
def status():
    """Get current brightness and sun times."""
    config = _load_config()
    brightness_config = config.get("brightness", {})
    return jsonify(
        {
            "config": brightness_config,
            "current": _get_current(),
            "sun": _fetch_sun_times(),
        }
    )


@bp.route("/auto", methods=["POST", "GET"])
def auto():
    """Auto-adjust brightness based on sun position. Call from cron."""
    config = _load_config()
    brightness_config = config.get("brightness", {})

    if not brightness_config.get("enabled"):
        return jsonify({"skipped": True, "reason": "disabled"})

    sun = _fetch_sun_times()
    if sun.get("error"):
        return jsonify({"error": sun["error"]}), 500

    target = _calculate_target(
        sunrise=sun["sunrise"],
        sunset=sun["sunset"],
        day_brightness=brightness_config.get("dayBrightness", 100),
        night_brightness=brightness_config.get("nightBrightness", 1),
        transition_mins=brightness_config.get("transitionMins", 60),
    )

    current = _get_current()
    if current == target:
        return jsonify({"changed": False, "level": current})

    result = _set_level(target)
    if "error" in result:
        return jsonify(result), 500

    return jsonify({"changed": True, "previous": current, "level": target})

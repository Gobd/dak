"""Brightness control endpoints.

Uses ddcutil to control monitor brightness via DDC/CI.
Supports auto-adjustment based on sunrise/sunset times.
"""

import re
import subprocess
import time
from datetime import date, timedelta
from typing import Union

from astral import LocationInfo
from astral.sun import sun as calc_sun
from fastapi import APIRouter, HTTPException
from timezonefinder import TimezoneFinder

from app.models.brightness import (
    AutoBrightnessResponse,
    AutoBrightnessSkippedResponse,
    BrightnessConfig,
    BrightnessStatus,
    SetBrightnessErrorResponse,
    SetBrightnessRequest,
    SetBrightnessResponse,
    SunTimes,
)
from app.services.config_service import load_config

router = APIRouter(prefix="/brightness", tags=["brightness"])

# Cache for sun times (refreshed daily or on location change)
_sun_cache: dict = {"date": None, "lat": None, "lon": None, "sunrise": None, "sunset": None}


def _get_current() -> int | None:
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


def _fetch_sun_times() -> dict:
    """Calculate sun times for today using astral (no API needed)."""
    global _sun_cache
    today = date.today().isoformat()

    config = load_config()
    brightness = config.get("brightness", {})
    lat = brightness.get("lat")
    lon = brightness.get("lon")

    if not lat or not lon:
        return {"error": "Location not configured", "date": None, "sunrise": None, "sunset": None}

    # Check cache - invalidate if date or location changed
    if (
        _sun_cache["date"] == today
        and _sun_cache.get("lat") == lat
        and _sun_cache.get("lon") == lon
    ):
        return _sun_cache

    try:
        # Get timezone from coordinates
        tf = TimezoneFinder()
        tz_name = tf.timezone_at(lat=lat, lng=lon) or "UTC"

        location = LocationInfo(timezone=tz_name, latitude=lat, longitude=lon)
        s = calc_sun(location.observer, date=date.today())

        sunrise_ts = int(s["sunrise"].timestamp())
        sunset_ts = int(s["sunset"].timestamp())

        # Astral sometimes returns yesterday's sunset - if so, get today's sunset
        if sunset_ts < sunrise_ts:
            s_tomorrow = calc_sun(location.observer, date=date.today() + timedelta(days=1))
            sunset_ts = int(s_tomorrow["sunset"].timestamp())

        _sun_cache = {
            "date": today,
            "lat": lat,
            "lon": lon,
            "sunrise": sunrise_ts,
            "sunset": sunset_ts,
        }
        return _sun_cache
    except Exception as e:
        return {"error": str(e), "date": None, "sunrise": None, "sunset": None}


@router.get("/sun", response_model=SunTimes)
async def sun():
    """Get today's sunrise/sunset times (cached daily)."""
    return _fetch_sun_times()


@router.post(
    "/set",
    response_model=SetBrightnessResponse,
    responses={500: {"model": SetBrightnessErrorResponse}},
)
async def set_brightness(req: SetBrightnessRequest):
    """Manually set brightness level."""
    result = _set_level(req.level)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return SetBrightnessResponse(success=result["success"], level=result["level"])


@router.get("/status", response_model=BrightnessStatus)
async def status():
    """Get current brightness and sun times."""
    config = load_config()
    brightness_config = config.get("brightness", {})
    return BrightnessStatus(
        config=BrightnessConfig(**brightness_config),
        current=_get_current(),
        sun=SunTimes(**_fetch_sun_times()),
    )


@router.post(
    "/auto",
    response_model=Union[AutoBrightnessResponse, AutoBrightnessSkippedResponse],
)
@router.get(
    "/auto",
    response_model=Union[AutoBrightnessResponse, AutoBrightnessSkippedResponse],
)
async def auto():
    """Auto-adjust brightness based on sun position. Call from cron."""
    config = load_config()
    brightness_config = config.get("brightness", {})

    if not brightness_config.get("enabled"):
        return AutoBrightnessSkippedResponse(skipped=True, reason="disabled")

    sun_data = _fetch_sun_times()
    if sun_data.get("error"):
        raise HTTPException(status_code=500, detail=sun_data["error"])

    target = _calculate_target(
        sunrise=sun_data["sunrise"],
        sunset=sun_data["sunset"],
        day_brightness=brightness_config.get("dayBrightness", 100),
        night_brightness=brightness_config.get("nightBrightness", 1),
        transition_mins=brightness_config.get("transitionMins", 60),
    )

    current = _get_current()
    if current is not None and current == target:
        return AutoBrightnessResponse(changed=False, level=current)

    result = _set_level(target)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return AutoBrightnessResponse(changed=True, previous=current, level=target)

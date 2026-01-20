"""Kasa smart device endpoints."""

import asyncio
import contextlib
import threading
from collections.abc import Coroutine
from typing import TypeVar

from flask import Blueprint, jsonify, request
from kasa import Discover

bp = Blueprint("kasa", __name__, url_prefix="/kasa")

# Cache for discovered devices (refreshed on each discover call)
_device_cache = {}

# Shared event loop for async operations (avoids creating new loop per request)
_loop: asyncio.AbstractEventLoop | None = None
_loop_thread: threading.Thread | None = None

T = TypeVar("T")


def _get_event_loop() -> asyncio.AbstractEventLoop:
    """Get or create the shared event loop running in a background thread."""
    global _loop, _loop_thread

    if _loop is None or not _loop.is_running():
        _loop = asyncio.new_event_loop()

        def run_loop():
            asyncio.set_event_loop(_loop)
            _loop.run_forever()

        _loop_thread = threading.Thread(target=run_loop, daemon=True)
        _loop_thread.start()

    return _loop


def run_async(coro: Coroutine[None, None, T]) -> T:
    """Run an async coroutine in the shared event loop."""
    loop = _get_event_loop()
    future = asyncio.run_coroutine_threadsafe(coro, loop)
    return future.result(timeout=30)


@bp.route("/discover", methods=["GET", "POST"])
def discover():
    """Discover Kasa devices on the network."""
    try:
        devices = run_async(_discover_devices())
        return jsonify(devices)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


async def _discover_devices():
    """Async device discovery."""
    global _device_cache
    devices = await Discover.discover(discovery_timeout=1)

    result = []
    for ip, dev in devices.items():
        with contextlib.suppress(Exception):
            await dev.update()

        name = getattr(dev, "alias", None) or ip
        if name.startswith("TP-LINK_"):
            continue  # Skip unrenamed devices

        _device_cache[ip] = dev
        result.append(
            {
                "name": name,
                "ip": ip,
                "on": getattr(dev, "is_on", None),
                "model": getattr(dev, "model", "unknown"),
                "type": _get_device_type(dev),
            }
        )

    return result


def _get_device_type(dev):
    """Get device type string."""
    device_type = getattr(dev, "device_type", None)
    if device_type is None:
        return "unknown"
    return device_type.name.lower() if hasattr(device_type, "name") else str(device_type).lower()


@bp.route("/toggle", methods=["POST"])
def toggle():
    """Toggle a Kasa device on/off."""
    data = request.get_json() or {}
    ip = data.get("ip") or request.args.get("ip")

    if not ip:
        return jsonify({"error": "ip required"}), 400

    try:
        result = run_async(_toggle_device(ip))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


async def _toggle_device(ip):
    """Async device toggle."""
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()

    if dev.is_on:
        await dev.turn_off()
    else:
        await dev.turn_on()

    with contextlib.suppress(Exception):
        await dev.update()
    return {"ip": ip, "on": dev.is_on, "name": getattr(dev, "alias", ip)}


@bp.route("/toggle-by-name", methods=["POST"])
def toggle_by_name():
    """Toggle a Kasa device by name (for voice commands)."""
    data = request.get_json() or {}
    name = data.get("device") or data.get("name")
    state = data.get("state")  # Optional: True=on, False=off, None=toggle

    if not name:
        return jsonify({"error": "device name required"}), 400

    try:
        result = run_async(_toggle_device_by_name(name, state=state))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


async def _toggle_device_by_name(name: str, *, state: bool | None):
    """Find device by name and toggle/set state."""
    global _device_cache
    name_lower = name.lower()

    # First try cache
    for ip, dev in _device_cache.items():
        dev_name = getattr(dev, "alias", "") or ""
        if name_lower in dev_name.lower():
            return await _set_device_state(dev, ip, state=state)

    # Refresh discovery if not found
    await _discover_devices()

    for ip, dev in _device_cache.items():
        dev_name = getattr(dev, "alias", "") or ""
        if name_lower in dev_name.lower():
            return await _set_device_state(dev, ip, state=state)

    return {"error": f"Device '{name}' not found"}


async def _set_device_state(dev, ip: str, *, state: bool | None):
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
    return {"ip": ip, "on": dev.is_on, "name": getattr(dev, "alias", ip)}


@bp.route("/status", methods=["GET"])
def status():
    """Get status of a specific device."""
    ip = request.args.get("ip")

    if not ip:
        return jsonify({"error": "ip required"}), 400

    try:
        result = run_async(_get_status(ip))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


async def _get_status(ip):
    """Async get device status."""
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        _device_cache[ip] = dev

    with contextlib.suppress(Exception):
        await dev.update()
    return {"ip": ip, "on": dev.is_on, "name": getattr(dev, "alias", ip)}

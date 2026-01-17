"""Kasa smart device endpoints."""

import asyncio

from flask import Blueprint, jsonify, request
from kasa import Discover

bp = Blueprint("kasa", __name__, url_prefix="/kasa")

# Cache for discovered devices (refreshed on each discover call)
_device_cache = {}


@bp.route("/discover", methods=["GET"])
def discover():
    """Discover Kasa devices on the network."""
    try:
        devices = asyncio.run(_discover_devices())
        return jsonify(devices)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


async def _discover_devices():
    """Async device discovery."""
    global _device_cache
    devices = await Discover.discover(discovery_timeout=1)

    result = []
    for ip, dev in devices.items():
        try:
            await dev.update()
        except Exception:
            pass  # Some devices have timezone issues

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
        result = asyncio.run(_toggle_device(ip))
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

    try:
        await dev.update()
    except Exception:
        pass

    if dev.is_on:
        await dev.turn_off()
    else:
        await dev.turn_on()

    try:
        await dev.update()
    except Exception:
        pass
    return {"ip": ip, "on": dev.is_on, "name": getattr(dev, "alias", ip)}


@bp.route("/status", methods=["GET"])
def status():
    """Get status of a specific device."""
    ip = request.args.get("ip")

    if not ip:
        return jsonify({"error": "ip required"}), 400

    try:
        result = asyncio.run(_get_status(ip))
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

    try:
        await dev.update()
    except Exception:
        pass
    return {"ip": ip, "on": dev.is_on, "name": getattr(dev, "alias", ip)}

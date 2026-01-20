"""
Volume control routes.
Controls system volume via ALSA (amixer) on Linux.
"""

import logging
import subprocess

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)
bp = Blueprint("volume", __name__, url_prefix="/volume")


def get_volume() -> int:
    """Get current system volume (0-100)."""
    try:
        result = subprocess.run(
            ["amixer", "get", "Master"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        # Parse output like "[50%]"
        for line in result.stdout.split("\n"):
            if "%" in line:
                start = line.find("[") + 1
                end = line.find("%")
                if start > 0 and end > start:
                    return int(line[start:end])
    except Exception:
        logger.exception("Failed to get volume")
    return 50  # Default


def set_volume(volume: int) -> bool:
    """Set system volume (0-100)."""
    try:
        volume = max(0, min(100, volume))
        subprocess.run(
            ["amixer", "set", "Master", f"{volume}%"],
            capture_output=True,
            timeout=5,
        )
        return True
    except Exception:
        logger.exception("Failed to set volume")
        return False


@bp.route("", methods=["GET"])
def volume_get():
    """Get current volume level."""
    return jsonify({"volume": get_volume()})


@bp.route("", methods=["POST"])
def volume_set():
    """Set volume level."""
    data = request.get_json()
    volume = data.get("volume")

    if not isinstance(volume, (int, float)):
        return jsonify({"error": "Invalid volume"}), 400

    success = set_volume(int(volume))
    return jsonify({"success": success, "volume": get_volume()})

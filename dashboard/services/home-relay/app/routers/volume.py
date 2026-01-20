"""Volume control endpoints.

Controls system volume via ALSA (amixer) on Linux.
"""

import logging
import subprocess

from fastapi import APIRouter

from app.models.volume import VolumeRequest, VolumeResponse, VolumeSetResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/volume", tags=["volume"])


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


@router.get("", response_model=VolumeResponse)
async def volume_get():
    """Get current volume level."""
    return VolumeResponse(volume=get_volume())


@router.post("", response_model=VolumeSetResponse)
async def volume_set(req: VolumeRequest):
    """Set volume level."""
    success = set_volume(req.volume)
    return VolumeSetResponse(success=success, volume=get_volume())

"""Config management endpoints.

Preserves the _saveId mechanism for preventing update loops:
- Client sends _saveId with config save
- _saveId is stripped before persisting (not saved to file)
- _saveId is echoed in SSE notification
- Originating client ignores SSE update matching its saveId
"""

from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.config import BrightnessSettings
from app.services.config_service import load_config, save_config
from app.services.sse_manager import config_sse

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/subscribe")
async def config_subscribe():
    """SSE endpoint for live config updates."""
    return StreamingResponse(
        config_sse.subscribe(initial_message={"type": "connected"}),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("", response_model=dict[str, Any])
async def get_config():
    """Get full dashboard configuration."""
    return load_config()


@router.post("", response_model=dict[str, Any])
async def set_config(data: dict[str, Any]):
    """Save dashboard configuration.

    Note: If data contains _saveId, it will be:
    1. Stripped before persisting to file
    2. Echoed in the SSE notification so the originating client
       can ignore the update it triggered
    """
    return save_config(data)


@router.get("/brightness", response_model=BrightnessSettings)
async def get_brightness_config():
    """Get just the brightness section (for shell script)."""
    config = load_config()
    return config.get("brightness", {})

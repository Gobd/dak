"""Voice command SSE broadcast endpoints.

Receives voice commands and broadcasts to all SSE subscribers.
Dashboard forwards these to notes-app iframe via postMessage.
"""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.voice import VoiceCommand, VoiceCommandResponse
from app.services.sse_manager import voice_sse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])


def broadcast_command(command: dict) -> None:
    """Send command to all SSE subscribers (exported for use by transcribe)."""
    voice_sse.broadcast(command)


@router.post("/command", response_model=VoiceCommandResponse)
async def send_command(data: VoiceCommand):
    """Receive voice command and broadcast to dashboard.

    Body: { "type": "add-to-list", "item": "cheese", "list": "groceries" }
    """
    if not data.type:
        raise HTTPException(status_code=400, detail="Missing command type")

    # Convert to dict for broadcasting (includes extra fields)
    command_dict = data.model_dump(exclude_none=True)
    logger.info("Voice command: %s", command_dict)
    broadcast_command(command_dict)

    return VoiceCommandResponse(success=True, command=command_dict)


@router.get("/subscribe")
async def subscribe():
    """SSE endpoint for dashboard to receive voice commands."""
    return StreamingResponse(
        voice_sse.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

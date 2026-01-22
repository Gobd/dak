"""Pydantic models for voice and transcription endpoints."""

from typing import Any

from pydantic import BaseModel


class VoiceCommand(BaseModel):
    """Voice command to broadcast."""

    type: str
    # Additional fields vary by command type
    item: str | None = None
    list: str | None = None
    text: str | None = None
    command: str | None = None

    model_config = {"extra": "allow"}


class VoiceCommandResponse(BaseModel):
    """Voice command sent response."""

    success: bool
    command: dict[str, Any]


class TranscriptionResponse(BaseModel):
    """Transcription result."""

    text: str


class TranscriptionErrorResponse(BaseModel):
    """Transcription error response."""

    error: str


class CommandResult(BaseModel):
    """Command execution result."""

    success: bool
    message: str | None = None
    speak: str | None = None

    model_config = {"extra": "allow"}


class TranscribeAndExecuteResponse(BaseModel):
    """Transcribe and execute result."""

    text: str
    command: str | None = None
    result: CommandResult | None = None
    error: str | None = None


class WebSocketMessage(BaseModel):
    """WebSocket message from server."""

    type: str
    text: str = ""
    command: str | None = None
    result: CommandResult | None = None
    error: str | None = None

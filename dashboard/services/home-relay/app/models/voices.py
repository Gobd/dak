"""Pydantic models for Piper TTS voice management endpoints."""

from pydantic import BaseModel


class TTSStatusResponse(BaseModel):
    """TTS status response."""

    installed: bool
    selectedVoice: str
    voiceReady: bool


class VoiceInfo(BaseModel):
    """TTS voice information."""

    id: str
    name: str
    description: str
    size: str
    downloaded: bool
    downloading: bool
    progress: int


class SpeakRequest(BaseModel):
    """Speak text request."""

    text: str


class SpeakResponse(BaseModel):
    """Speak text response."""

    success: bool

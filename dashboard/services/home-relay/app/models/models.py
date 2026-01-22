"""Pydantic models for Vosk model management endpoints."""

from pydantic import BaseModel


class VoskModelInfo(BaseModel):
    """Vosk model information."""

    id: str
    name: str
    size: str
    description: str
    downloaded: bool
    downloading: bool
    progress: int


class DownloadProgress(BaseModel):
    """Download progress SSE event."""

    status: str  # "starting", "downloading", "extracting", "complete", "error"
    progress: int
    error: str | None = None


class DeleteResponse(BaseModel):
    """Delete model response."""

    status: str


class AlreadyDownloadedResponse(BaseModel):
    """Already downloaded response."""

    status: str = "already_downloaded"

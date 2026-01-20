"""Pydantic models for volume endpoints."""

from pydantic import BaseModel, Field


class VolumeResponse(BaseModel):
    """Current volume level."""

    volume: int = Field(ge=0, le=100)


class VolumeRequest(BaseModel):
    """Set volume request."""

    volume: int = Field(ge=0, le=100)


class VolumeSetResponse(BaseModel):
    """Volume set response."""

    success: bool
    volume: int = Field(ge=0, le=100)

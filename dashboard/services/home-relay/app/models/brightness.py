"""Pydantic models for brightness endpoints."""

from pydantic import BaseModel, Field


class SunTimes(BaseModel):
    """Sunrise and sunset times."""

    date: str | None = None
    sunrise: int | None = None
    sunset: int | None = None
    error: str | None = None


class BrightnessConfig(BaseModel):
    """Brightness configuration section."""

    lat: float | None = None
    lon: float | None = None
    enabled: bool | None = None
    dayBrightness: int | None = None
    nightBrightness: int | None = None
    transitionMins: int | None = None


class BrightnessStatus(BaseModel):
    """Current brightness status."""

    config: BrightnessConfig
    current: int | None = None
    sun: SunTimes


class SetBrightnessRequest(BaseModel):
    """Set brightness request."""

    level: int = Field(ge=1, le=100)


class SetBrightnessResponse(BaseModel):
    """Set brightness response."""

    success: bool
    level: int


class SetBrightnessErrorResponse(BaseModel):
    """Set brightness error response."""

    error: str


class AutoBrightnessResponse(BaseModel):
    """Auto brightness response."""

    changed: bool
    level: int
    previous: int | None = None


class AutoBrightnessSkippedResponse(BaseModel):
    """Auto brightness skipped response."""

    skipped: bool
    reason: str

"""Pydantic models for config endpoints."""

from pydantic import BaseModel, Field


class GlobalSettings(BaseModel):
    """Global dashboard settings."""

    voiceEnabled: bool | None = None
    wakeWord: str | None = None
    voiceModel: str | None = None
    ttsVoice: str | None = None
    defaultLocation: str | None = None

    model_config = {"extra": "allow"}


class BrightnessSettings(BaseModel):
    """Brightness section of config."""

    lat: float | None = None
    lon: float | None = None
    enabled: bool | None = None
    dayBrightness: int | None = None
    nightBrightness: int | None = None
    transitionMins: int | None = None

    model_config = {"extra": "allow"}


class SensorSettings(BaseModel):
    """Sensor section of config."""

    indoor: str | None = None
    outdoor: str | None = None

    model_config = {"extra": "allow"}


class DashboardConfig(BaseModel):
    """Full dashboard configuration.

    Note: _saveId is used to track which client initiated the save,
    allowing that client to ignore its own SSE update notification.
    This prevents update loops.
    """

    brightness: BrightnessSettings | None = None
    globalSettings: GlobalSettings | None = None
    sensors: SensorSettings | None = None
    # Internal field: stripped before persisting, echoed in SSE notification
    saveId: str | None = Field(default=None, alias="_saveId")

    model_config = {"extra": "allow", "populate_by_name": True}


class ConfigUpdateEvent(BaseModel):
    """SSE event for config updates."""

    type: str = "config-updated"
    saveId: str | None = None


class ConfigConnectedEvent(BaseModel):
    """SSE event for initial connection."""

    type: str = "connected"

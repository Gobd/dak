"""Pydantic models for Kasa smart device endpoints."""

from pydantic import BaseModel


class KasaDevice(BaseModel):
    """Kasa device info."""

    name: str
    ip: str
    on: bool | None = None
    model: str
    type: str
    # Extended info
    on_since: str | None = None  # ISO timestamp when turned on
    brightness: int | None = None  # 0-100 for dimmable devices
    color_temp: int | None = None  # Color temperature for bulbs
    has_emeter: bool = False
    power_watts: float | None = None  # Current power draw
    energy_today_kwh: float | None = None  # Energy used today
    features: list[str] = []  # List of supported features


class ToggleRequest(BaseModel):
    """Toggle device request."""

    ip: str


class ToggleResponse(BaseModel):
    """Toggle device response."""

    ip: str
    on: bool
    name: str
    on_since: str | None = None
    brightness: int | None = None


class ToggleByNameRequest(BaseModel):
    """Toggle device by name request."""

    device: str | None = None
    name: str | None = None
    state: bool | None = None  # True=on, False=off, None=toggle


class ToggleByNameErrorResponse(BaseModel):
    """Toggle by name error response."""

    error: str


class StatusRequest(BaseModel):
    """Status request (query param)."""

    ip: str


class BrightnessRequest(BaseModel):
    """Set brightness request."""

    ip: str
    brightness: int  # 0-100


class BrightnessResponse(BaseModel):
    """Set brightness response."""

    ip: str
    name: str
    brightness: int
    on: bool


class CountdownRequest(BaseModel):
    """Set countdown timer request."""

    ip: str
    minutes: int  # Minutes until action
    action: str = "off"  # "on" or "off"


class CountdownResponse(BaseModel):
    """Countdown timer response."""

    ip: str
    name: str
    minutes: int
    action: str
    enabled: bool


class ScheduleRule(BaseModel):
    """A schedule rule."""

    id: str
    enabled: bool
    action: str  # "on" or "off"
    time: str  # HH:MM
    days: list[str]  # ["mon", "tue", etc.]


class ScheduleResponse(BaseModel):
    """Device schedule response."""

    ip: str
    name: str
    rules: list[ScheduleRule]


class AddScheduleRequest(BaseModel):
    """Add schedule rule request."""

    ip: str
    action: str  # "on" or "off"
    time: str  # HH:MM
    days: list[str]  # ["mon", "tue", etc.]


class UpdateScheduleRequest(BaseModel):
    """Update schedule rule request."""

    ip: str
    rule_id: str
    enabled: bool | None = None
    action: str | None = None  # "on" or "off"
    time: str | None = None  # HH:MM
    days: list[str] | None = None


class DeleteScheduleRequest(BaseModel):
    """Delete schedule rule request."""

    ip: str
    rule_id: str

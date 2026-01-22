"""Pydantic models for Wake-on-LAN endpoints."""

from pydantic import BaseModel


class WakeRequest(BaseModel):
    """Wake-on-LAN request."""

    mac: str


class WakeResponse(BaseModel):
    """Wake-on-LAN response."""

    success: bool
    mac: str


class PingResponse(BaseModel):
    """Ping response."""

    ip: str
    online: bool


class MacLookupResponse(BaseModel):
    """MAC lookup response."""

    ip: str
    mac: str | None = None


class MacLookupErrorResponse(BaseModel):
    """MAC lookup error response."""

    ip: str
    mac: None = None
    error: str

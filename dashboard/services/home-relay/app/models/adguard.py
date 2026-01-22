"""Pydantic models for AdGuard Home proxy."""

from pydantic import BaseModel


class AdGuardRequest(BaseModel):
    """Proxy request to AdGuard Home."""

    url: str  # AdGuard base URL
    username: str
    password: str


class AdGuardProtectionRequest(AdGuardRequest):
    """Set protection state."""

    enabled: bool
    duration: int | None = None  # milliseconds

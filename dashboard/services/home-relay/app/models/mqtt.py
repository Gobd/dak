"""Pydantic models for MQTT/Zigbee2MQTT device management."""

from typing import Any, Literal

from pydantic import BaseModel


class ZigbeeDevice(BaseModel):
    """Zigbee device from Zigbee2MQTT."""

    friendly_name: str
    ieee_address: str
    type: Literal["Coordinator", "Router", "EndDevice"]
    network_address: int
    model: str | None = None
    vendor: str | None = None
    description: str | None = None
    power_source: str | None = None
    supported: bool = True
    interviewing: bool = False
    interview_completed: bool = True


class DeviceListResponse(BaseModel):
    """List of all Zigbee devices."""

    devices: list[ZigbeeDevice]
    permit_join: bool
    permit_join_timeout: int | None = None


class RenameRequest(BaseModel):
    """Rename device request."""

    old_name: str
    new_name: str


class RenameResponse(BaseModel):
    """Rename device response."""

    success: bool
    old_name: str
    new_name: str


class RemoveRequest(BaseModel):
    """Remove device request."""

    device: str
    force: bool = False


class RemoveResponse(BaseModel):
    """Remove device response."""

    success: bool
    device: str


class PermitJoinRequest(BaseModel):
    """Enable/disable device pairing."""

    enable: bool
    time: int = 120  # Seconds to allow pairing (default 2 minutes)


class PermitJoinResponse(BaseModel):
    """Permit join response."""

    success: bool
    permit_join: bool
    time: int | None = None


class BridgeInfo(BaseModel):
    """Zigbee2MQTT bridge info."""

    version: str | None = None
    coordinator: dict[str, Any] | None = None
    log_level: str | None = None
    permit_join: bool = False
    permit_join_timeout: int | None = None

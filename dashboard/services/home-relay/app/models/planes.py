"""Pydantic models for the plane-tracker endpoints."""

from typing import Literal

from pydantic import BaseModel

MatchType = Literal["icao_hex", "callsign_prefix", "model", "unresolved"]


class WatchlistEntry(BaseModel):
    """A single watch-list entry to alert on."""

    id: int
    label: str
    match_type: MatchType
    match_value: str
    max_altitude_ft: int | None = None
    created_at: str


class WatchlistEntryRequest(BaseModel):
    """Request to create a watch-list entry."""

    label: str
    match_type: MatchType
    match_value: str
    max_altitude_ft: int | None = None


class PlaneSighting(BaseModel):
    """A single aircraft from the most recent adsb.fi poll."""

    hex: str
    flight: str | None = None
    registration: str | None = None
    model: str | None = None
    desc: str | None = None
    lat: float | None = None
    lon: float | None = None
    alt_baro: int | None = None
    ground_speed: float | None = None
    track: float | None = None
    distance_nm: float | None = None
    bearing_deg: float | None = None
    closing_speed_kt: float | None = None
    eta_minutes: float | None = None
    miss_distance_nm: float | None = None
    in_geofence: bool
    matched_watchlist_id: int | None = None
    matched_label: str | None = None


class PlaneSettings(BaseModel):
    """Current plane-tracker settings."""

    active_location_profile_id: int | None
    radius_nm: float
    target_warning_minutes: float
    max_miss_distance_nm: float
    poll_interval_seconds: int
    ntfy_topic: str | None
    ntfy_base_url: str


class PlaneSettingsUpdate(BaseModel):
    """Request to update plane-tracker settings.

    All fields optional so the client can patch a subset; omitted fields
    keep their current stored value.
    """

    radius_nm: float | None = None
    target_warning_minutes: float | None = None
    max_miss_distance_nm: float | None = None
    poll_interval_seconds: int | None = None
    ntfy_topic: str | None = None
    ntfy_base_url: str | None = None


class LocationProfile(BaseModel):
    """A named location available to the plane tracker."""

    id: int
    name: str
    lat: float | None
    lon: float | None
    is_active: bool
    created_at: str


class LocationProfileCreate(BaseModel):
    """Create a named location profile and make it active."""

    name: str


class LocationProfileUpdate(BaseModel):
    """Update a location profile's name or coordinates."""

    name: str | None = None
    lat: float | None = None
    lon: float | None = None


class PlanesLiveResponse(BaseModel):
    """Live aircraft list plus poll metadata."""

    aircraft: list[PlaneSighting]
    last_polled_at: str | None
    last_poll_error: str | None = None


class GenericSuccess(BaseModel):
    """Generic success response."""

    success: bool

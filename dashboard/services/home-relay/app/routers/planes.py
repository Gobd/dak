"""Plane-tracker endpoints: live nearby aircraft, geofence/watchlist settings.

Polls adsb.fi in the background (see app.services.plane_service) and alerts
via ntfy.sh when a watch-listed aircraft enters the configured geofence.
"""

from fastapi import APIRouter, HTTPException

from app.models.planes import (
    GenericSuccess,
    LocationProfile,
    LocationProfileCreate,
    LocationProfileUpdate,
    PlaneSettings,
    PlaneSettingsUpdate,
    PlanesLiveResponse,
    WatchlistEntry,
    WatchlistEntryRequest,
)
from app.services import plane_service

router = APIRouter(prefix="/planes", tags=["planes"])


@router.get("/live", response_model=PlanesLiveResponse)
async def live():
    """Get the most recent poll's nearby aircraft."""
    return plane_service.get_live()


@router.get("/settings", response_model=PlaneSettings)
async def get_settings():
    """Get current plane-tracker settings."""
    return plane_service.get_settings()


@router.put("/settings", response_model=PlaneSettings)
async def update_settings(request: PlaneSettingsUpdate):
    """Update global plane-tracker settings (geofence, poll interval, ntfy)."""
    return plane_service.update_settings(request.model_dump(exclude_unset=True))


@router.get("/location-profiles", response_model=list[LocationProfile])
async def list_location_profiles():
    """List named locations and indicate the active one."""
    return plane_service.list_location_profiles()


@router.post("/location-profiles", response_model=LocationProfile)
async def add_location_profile(request: LocationProfileCreate):
    """Create a named location and make it active."""
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Profile name must not be empty")
    try:
        return plane_service.add_location_profile(name, request.ntfy_topic)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.put("/location-profiles/{profile_id}", response_model=LocationProfile)
async def update_location_profile(profile_id: int, request: LocationProfileUpdate):
    """Update a location profile's name or coordinates."""
    try:
        profile = plane_service.update_location_profile(
            profile_id, request.model_dump(exclude_unset=True)
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if profile is None:
        raise HTTPException(status_code=404, detail="Location profile not found")
    return profile


@router.put("/location-profiles/{profile_id}/active", response_model=LocationProfile)
async def activate_location_profile(profile_id: int):
    """Make a location profile the single active plane-tracker location."""
    profile = plane_service.activate_location_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Location profile not found")
    return profile


@router.delete("/location-profiles/{profile_id}", response_model=GenericSuccess)
async def delete_location_profile(profile_id: int):
    """Delete a named location profile."""
    return plane_service.delete_location_profile(profile_id)


@router.get("/watchlist", response_model=list[WatchlistEntry])
async def list_watchlist():
    """List watch-list entries."""
    return plane_service.list_watchlist()


@router.post("/watchlist", response_model=WatchlistEntry)
async def add_watchlist_entry(request: WatchlistEntryRequest):
    """Add a watch-list entry (by ICAO hex, callsign prefix, aircraft model, or unresolved)."""
    match_value = request.match_value.strip()
    if request.match_type == "unresolved":
        match_value = "*"
    elif not match_value:
        raise HTTPException(status_code=400, detail="match_value must not be empty")
    return plane_service.add_watchlist_entry(
        request.label, request.match_type, match_value, request.max_altitude_ft
    )


@router.put("/watchlist/{entry_id}", response_model=WatchlistEntry)
async def update_watchlist_entry(entry_id: int, request: WatchlistEntryRequest):
    """Update an existing watch-list filter."""
    match_value = request.match_value.strip()
    if request.match_type == "unresolved":
        match_value = "*"
    elif not match_value:
        raise HTTPException(status_code=400, detail="match_value must not be empty")

    entry = plane_service.update_watchlist_entry(
        entry_id,
        request.label,
        request.match_type,
        match_value,
        request.max_altitude_ft,
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Watch-list entry not found")
    return entry


@router.delete("/watchlist/{entry_id}", response_model=GenericSuccess)
async def delete_watchlist_entry(entry_id: int):
    """Remove a watch-list entry."""
    return plane_service.delete_watchlist_entry(entry_id)

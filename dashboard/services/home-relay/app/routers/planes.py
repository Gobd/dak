"""Plane-tracker endpoints: live nearby aircraft, geofence/watchlist settings.

Polls adsb.fi in the background (see app.services.plane_service) and alerts
via ntfy.sh when a watch-listed aircraft enters the configured geofence.
"""

from fastapi import APIRouter, HTTPException

from app.models.planes import (
    GenericSuccess,
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
    """Update plane-tracker settings (geofence, altitude ceiling, poll interval, ntfy)."""
    return plane_service.update_settings(request.model_dump())


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

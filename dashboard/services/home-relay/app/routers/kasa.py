"""Kasa smart device endpoints."""

from typing import Union

from fastapi import APIRouter, HTTPException, Query

from app.models.kasa import (
    AddScheduleRequest,
    BrightnessRequest,
    BrightnessResponse,
    CountdownRequest,
    CountdownResponse,
    DeleteScheduleRequest,
    KasaDevice,
    ScheduleResponse,
    ToggleByNameErrorResponse,
    ToggleByNameRequest,
    ToggleRequest,
    ToggleResponse,
    UpdateScheduleRequest,
)
from app.services.kasa_service import (
    add_schedule_rule,
    delete_schedule_rule,
    discover_devices,
    get_device_status,
    get_schedule_rules,
    run_async,
    set_brightness,
    set_countdown,
    toggle_device,
    toggle_device_by_name,
    update_schedule_rule,
)

router = APIRouter(prefix="/kasa", tags=["kasa"])


@router.get("/discover", response_model=list[KasaDevice])
@router.post("/discover", response_model=list[KasaDevice])
async def discover():
    """Discover Kasa devices on the network with extended info."""
    try:
        devices = run_async(discover_devices())
        return [KasaDevice(**d) for d in devices]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/toggle", response_model=ToggleResponse)
async def toggle(req: ToggleRequest):
    """Toggle a Kasa device on/off."""
    try:
        result = run_async(toggle_device(req.ip))
        return ToggleResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/toggle-by-name",
    response_model=Union[ToggleResponse, ToggleByNameErrorResponse],
)
async def toggle_by_name(req: ToggleByNameRequest):
    """Toggle a Kasa device by name (for voice commands)."""
    name = req.device or req.name
    if not name:
        raise HTTPException(status_code=400, detail="device name required")

    try:
        result = run_async(toggle_device_by_name(name, state=req.state))
        if "error" in result:
            return ToggleByNameErrorResponse(error=result["error"])
        return ToggleResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=ToggleResponse)
async def status(ip: str = Query(...)):
    """Get status of a specific device with extended info."""
    try:
        result = run_async(get_device_status(ip))
        return ToggleResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/brightness", response_model=BrightnessResponse)
async def brightness(req: BrightnessRequest):
    """Set brightness for dimmable devices (0-100)."""
    if not 0 <= req.brightness <= 100:
        raise HTTPException(status_code=400, detail="Brightness must be 0-100")

    try:
        result = run_async(set_brightness(req.ip, req.brightness))
        return BrightnessResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/countdown", response_model=CountdownResponse)
async def countdown(req: CountdownRequest):
    """Set countdown timer to turn device on/off after delay."""
    if req.action not in ("on", "off"):
        raise HTTPException(status_code=400, detail="Action must be 'on' or 'off'")
    if req.minutes < 1:
        raise HTTPException(status_code=400, detail="Minutes must be at least 1")

    try:
        result = run_async(set_countdown(req.ip, req.minutes, req.action))
        return CountdownResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedule", response_model=ScheduleResponse)
async def schedule(ip: str = Query(...)):
    """Get schedule rules for a device."""
    try:
        result = run_async(get_schedule_rules(ip))
        return ScheduleResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schedule", response_model=ScheduleResponse)
async def add_schedule(req: AddScheduleRequest):
    """Add a new schedule rule to a device."""
    if req.action not in ("on", "off"):
        raise HTTPException(status_code=400, detail="Action must be 'on' or 'off'")
    if not req.days:
        raise HTTPException(status_code=400, detail="At least one day required")

    try:
        result = run_async(add_schedule_rule(req.ip, req.action, req.time, req.days))
        return ScheduleResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/schedule", response_model=ScheduleResponse)
async def update_schedule(req: UpdateScheduleRequest):
    """Update an existing schedule rule."""
    if req.action is not None and req.action not in ("on", "off"):
        raise HTTPException(status_code=400, detail="Action must be 'on' or 'off'")

    try:
        result = run_async(
            update_schedule_rule(
                req.ip,
                req.rule_id,
                enabled=req.enabled,
                action=req.action,
                time=req.time,
                days=req.days,
            )
        )
        return ScheduleResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/schedule", response_model=ScheduleResponse)
async def delete_schedule(req: DeleteScheduleRequest):
    """Delete a schedule rule."""
    try:
        result = run_async(delete_schedule_rule(req.ip, req.rule_id))
        return ScheduleResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

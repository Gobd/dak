"""MQTT/Zigbee2MQTT device management endpoints."""

from fastapi import APIRouter, HTTPException

from app.models.mqtt import (
    AddCustomDeviceRequest,
    BridgeInfo,
    CustomDevice,
    CustomDeviceListResponse,
    DeviceListResponse,
    PermitJoinRequest,
    PermitJoinResponse,
    RemoveCustomDeviceRequest,
    RemoveRequest,
    RemoveResponse,
    RenameRequest,
    RenameResponse,
    ZigbeeDevice,
)
from app.services import mqtt_service

router = APIRouter(prefix="/mqtt", tags=["mqtt"])


@router.get("/devices", response_model=DeviceListResponse)
async def list_devices():
    """List all Zigbee devices."""
    devices = mqtt_service.get_all_devices()
    bridge = mqtt_service.get_bridge_state()

    return DeviceListResponse(
        devices=[ZigbeeDevice(**d) for d in devices if d.get("ieee_address")],
        permit_join=bridge.get("permit_join", False),
        permit_join_timeout=bridge.get("permit_join_timeout"),
    )


@router.get("/bridge", response_model=BridgeInfo)
async def get_bridge_info():
    """Get Zigbee2MQTT bridge information."""
    bridge = mqtt_service.get_bridge_state()
    return BridgeInfo(**bridge)


@router.post("/devices/rename", response_model=RenameResponse)
async def rename_device(request: RenameRequest):
    """Rename a Zigbee device."""
    result = mqtt_service.rename_device(request.old_name, request.new_name)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Rename failed"))

    return RenameResponse(
        success=True,
        old_name=request.old_name,
        new_name=request.new_name,
    )


@router.post("/devices/remove", response_model=RemoveResponse)
async def remove_device(request: RemoveRequest):
    """Remove a Zigbee device from the network."""
    result = mqtt_service.remove_device(request.device, request.force)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Remove failed"))

    return RemoveResponse(
        success=True,
        device=request.device,
    )


@router.post("/permit-join", response_model=PermitJoinResponse)
async def set_permit_join(request: PermitJoinRequest):
    """Enable or disable device pairing mode."""
    result = mqtt_service.permit_join(request.enable, request.time)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Permit join failed"))

    return PermitJoinResponse(
        success=True,
        permit_join=request.enable,
        time=request.time if request.enable else None,
    )


@router.get("/custom-devices", response_model=CustomDeviceListResponse)
async def list_custom_devices():
    """List custom (non-Zigbee) climate sensors."""
    devices = [CustomDevice(**d) for d in mqtt_service.custom_devices]
    return CustomDeviceListResponse(devices=devices)


@router.post("/custom-devices", response_model=CustomDeviceListResponse)
async def add_custom_device(request: AddCustomDeviceRequest):
    """Add a custom (non-Zigbee) climate sensor."""
    try:
        mqtt_service.add_custom_device(request.friendly_name, request.model, request.description)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    devices = [CustomDevice(**d) for d in mqtt_service.custom_devices]
    return CustomDeviceListResponse(devices=devices)


@router.post("/custom-devices/remove", response_model=CustomDeviceListResponse)
async def remove_custom_device(request: RemoveCustomDeviceRequest):
    """Remove a custom (non-Zigbee) climate sensor."""
    mqtt_service.remove_custom_device(request.friendly_name)
    devices = [CustomDevice(**d) for d in mqtt_service.custom_devices]
    return CustomDeviceListResponse(devices=devices)

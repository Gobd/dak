"""Climate sensor endpoints.

Reads data from Zigbee2MQTT sensors via the MQTT service.
"""

from typing import Union

from fastapi import APIRouter

from app.models.sensors import (
    AllSensorsResponse,
    DevicesResponse,
    MqttStatusResponse,
    SensorComparison,
    SensorConfig,
    SensorConfigRequest,
    SensorConfigResponse,
    SensorDevice,
    SensorReadingResponse,
    SensorUnavailableResponse,
)
from app.services.mqtt_service import (
    available_devices,
    mqtt_connected,
    sensor_config,
    sensor_response,
    set_sensor_config,
)

router = APIRouter(prefix="/sensors", tags=["sensors"])


@router.get("/status", response_model=MqttStatusResponse)
async def status():
    """Get MQTT connection status."""
    return MqttStatusResponse(mqtt_connected=mqtt_connected)


@router.get("/devices", response_model=DevicesResponse)
async def devices():
    """List available climate sensors from Zigbee2MQTT."""
    return DevicesResponse(
        devices=[SensorDevice(**d) for d in available_devices],
        config=SensorConfig(**sensor_config),
    )


@router.post("/config", response_model=SensorConfigResponse)
async def config(req: SensorConfigRequest):
    """Set which device is indoor/outdoor."""
    result = set_sensor_config(indoor=req.indoor, outdoor=req.outdoor)
    return SensorConfigResponse(
        success=result["success"],
        config=SensorConfig(**result["config"]),
    )


@router.get(
    "/indoor",
    response_model=Union[SensorReadingResponse, SensorUnavailableResponse],
)
async def indoor():
    """Get indoor sensor reading."""
    return sensor_response("indoor")


@router.get(
    "/outdoor",
    response_model=Union[SensorReadingResponse, SensorUnavailableResponse],
)
async def outdoor():
    """Get outdoor sensor reading."""
    return sensor_response("outdoor")


def _parse_sensor_response(data: dict) -> SensorReadingResponse | SensorUnavailableResponse:
    """Parse sensor response dict into the appropriate Pydantic model."""
    if data.get("available"):
        return SensorReadingResponse(**data)
    return SensorUnavailableResponse(**data)


@router.get("/all", response_model=AllSensorsResponse)
async def all_sensors():
    """Get all sensor readings with comparison."""
    ind_data = sensor_response("indoor")
    out_data = sensor_response("outdoor")

    comparison = None
    if ind_data.get("available") and out_data.get("available"):
        diff = out_data["feels_like"] - ind_data["feels_like"]
        comparison = SensorComparison(
            outside_feels_cooler=diff < -0.5,
            outside_feels_warmer=diff > 0.5,
            difference=round(diff, 1),
        )

    return AllSensorsResponse(
        indoor=_parse_sensor_response(ind_data),
        outdoor=_parse_sensor_response(out_data),
        comparison=comparison,
        config=SensorConfig(**sensor_config),
    )

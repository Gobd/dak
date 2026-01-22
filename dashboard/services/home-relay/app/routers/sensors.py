"""Climate sensor endpoints.

Reads data from Zigbee2MQTT sensors via the MQTT service.
Config is managed via the main /config endpoint, not here.
"""

from typing import Union

from fastapi import APIRouter

from app.models.sensors import (
    AllSensorsResponse,
    DevicesResponse,
    MqttStatusResponse,
    SensorComparison,
    SensorDevice,
    SensorReadingResponse,
    SensorUnavailableResponse,
)
from app.services.mqtt_service import (
    available_devices,
    load_config,
    mqtt_connected,
    sensor_config,
    sensor_response,
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
    )


@router.get(
    "/indoor",
    response_model=Union[SensorReadingResponse, SensorUnavailableResponse],
)
async def indoor():
    """Get indoor sensor reading."""
    load_config()  # Reload config in case it changed via main /config endpoint
    return sensor_response("indoor")


@router.get(
    "/outdoor",
    response_model=Union[SensorReadingResponse, SensorUnavailableResponse],
)
async def outdoor():
    """Get outdoor sensor reading."""
    load_config()  # Reload config in case it changed via main /config endpoint
    return sensor_response("outdoor")


def _parse_sensor_response(data: dict) -> SensorReadingResponse | SensorUnavailableResponse:
    """Parse sensor response dict into the appropriate Pydantic model."""
    if data.get("available"):
        return SensorReadingResponse(**data)
    return SensorUnavailableResponse(**data)


@router.get("/all", response_model=AllSensorsResponse)
async def all_sensors():
    """Get all sensor readings with comparison."""
    load_config()  # Reload config in case it changed via main /config endpoint
    ind_data = sensor_response("indoor")
    out_data = sensor_response("outdoor")

    comparison = None
    if ind_data.get("available") and out_data.get("available"):
        diff = out_data["feels_like"] - ind_data["feels_like"]
        # Adjust threshold based on unit (0.5°C ≈ 1°F)
        threshold = 1.0 if sensor_config.get("unit", "C") == "F" else 0.5
        comparison = SensorComparison(
            outside_feels_cooler=diff < -threshold,
            outside_feels_warmer=diff > threshold,
            difference=round(diff, 1),
        )

    return AllSensorsResponse(
        indoor=_parse_sensor_response(ind_data),
        outdoor=_parse_sensor_response(out_data),
        comparison=comparison,
    )

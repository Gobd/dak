"""Pydantic models for sensor endpoints."""

from typing import Literal

from pydantic import BaseModel


class SensorConfig(BaseModel):
    """Sensor configuration."""

    indoor: str = ""
    outdoor: str = ""


class SensorDevice(BaseModel):
    """Available sensor device from Zigbee2MQTT."""

    friendly_name: str
    model: str
    description: str


class DevicesResponse(BaseModel):
    """List of available sensor devices."""

    devices: list[SensorDevice]
    config: SensorConfig


class MqttStatusResponse(BaseModel):
    """MQTT connection status."""

    mqtt_connected: bool


class SensorConfigRequest(BaseModel):
    """Set sensor config request."""

    indoor: str | None = None
    outdoor: str | None = None


class SensorConfigResponse(BaseModel):
    """Set sensor config response."""

    success: bool
    config: SensorConfig


class SensorReadingResponse(BaseModel):
    """Sensor reading response when available."""

    available: Literal[True]
    temperature: float
    humidity: float
    feels_like: float
    temperature_trend: Literal["rising", "falling", "steady"]
    humidity_trend: Literal["rising", "falling", "steady"]
    battery: int
    age_seconds: int


class SensorUnavailableResponse(BaseModel):
    """Sensor unavailable response."""

    available: Literal[False]
    error: str


class SensorComparison(BaseModel):
    """Indoor vs outdoor comparison."""

    outside_feels_cooler: bool
    outside_feels_warmer: bool
    difference: float


class AllSensorsResponse(BaseModel):
    """All sensors response."""

    indoor: SensorReadingResponse | SensorUnavailableResponse
    outdoor: SensorReadingResponse | SensorUnavailableResponse
    comparison: SensorComparison | None = None
    config: SensorConfig

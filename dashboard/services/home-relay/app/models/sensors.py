"""Pydantic models for sensor endpoints.

Note: Climate config (indoor, outdoor, unit) is managed via the main /config endpoint,
not the sensors API. These models are for sensor data responses only.
"""

from typing import Literal

from pydantic import BaseModel


class SensorDevice(BaseModel):
    """Available sensor device from Zigbee2MQTT."""

    friendly_name: str
    model: str
    description: str


class DevicesResponse(BaseModel):
    """List of available sensor devices."""

    devices: list[SensorDevice]


class MqttStatusResponse(BaseModel):
    """MQTT connection status."""

    mqtt_connected: bool


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
    uv_index: float | None = None
    pm2_5: float | None = None
    pm10: float | None = None
    aqi: int | None = None
    battery_pct: float | None = None
    battery_voltage: float | None = None
    battery_trend: Literal["rising", "falling", "steady"] | None = None
    battery_current_ma: float | None = None


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

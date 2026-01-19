"""
Indoor/outdoor climate sensor routes.
Subscribes to Zigbee2MQTT via MQTT, tracks history for trends.
"""

import json
import logging
import math
import threading
import time
from collections import deque
from dataclasses import dataclass, field

import paho.mqtt.client as mqtt
from flask import Blueprint, jsonify

logger = logging.getLogger(__name__)
bp = Blueprint("sensors", __name__, url_prefix="/sensors")

# Config - update these after pairing sensors
MQTT_HOST = "localhost"
MQTT_PORT = 1883
INDOOR_TOPIC = "zigbee2mqtt/indoor_climate"
OUTDOOR_TOPIC = "zigbee2mqtt/outdoor_climate"
HISTORY_SIZE = 60  # Several hours of history
TREND_WINDOW = 6  # ~30-60 min of readings for trend


@dataclass
class SensorReading:
    temperature: float = 0.0
    humidity: float = 0.0
    battery: int = 100
    timestamp: float = 0.0


@dataclass
class SensorData:
    current: SensorReading = field(default_factory=SensorReading)
    history: deque = field(default_factory=lambda: deque(maxlen=HISTORY_SIZE))


sensors: dict[str, SensorData] = {
    "indoor": SensorData(),
    "outdoor": SensorData(),
}

mqtt_client: mqtt.Client | None = None
mqtt_connected = False


def feels_like(temp_c: float, humidity: float) -> float:
    """Calculate feels-like temperature (heat index for warm, humidity-adjusted for cool)."""
    temp_f = temp_c * 9 / 5 + 32

    if temp_f >= 80 and humidity >= 40:
        # Heat index formula
        hi = (
            -42.379
            + 2.04901523 * temp_f
            + 10.14333127 * humidity
            - 0.22475541 * temp_f * humidity
            - 0.00683783 * temp_f**2
            - 0.05481717 * humidity**2
            + 0.00122874 * temp_f**2 * humidity
            + 0.00085282 * temp_f * humidity**2
            - 0.00000199 * temp_f**2 * humidity**2
        )
        return (hi - 32) * 5 / 9

    # For cooler temps, blend with dew point influence
    if humidity <= 0:
        return temp_c
    a, b = 17.62, 243.12
    gamma = math.log(humidity / 100) + (a * temp_c) / (b + temp_c)
    dew_point = (b * gamma) / (a - gamma)
    return temp_c + (dew_point - temp_c) * 0.1


def get_trend(current: float, history: deque, attr: str) -> str:
    """Calculate trend: 'rising', 'falling', or 'steady'."""
    if len(history) < TREND_WINDOW:
        return "steady"

    recent = list(history)[-TREND_WINDOW:]
    avg = sum(getattr(r, attr) for r in recent) / len(recent)
    diff = current - avg
    threshold = 0.5 if attr == "temperature" else 2.0

    if diff > threshold:
        return "rising"
    if diff < -threshold:
        return "falling"
    return "steady"


def on_connect(client, _userdata, _flags, rc, _properties=None):
    global mqtt_connected
    mqtt_connected = rc == 0
    if mqtt_connected:
        client.subscribe(INDOOR_TOPIC)
        client.subscribe(OUTDOOR_TOPIC)
        logger.info("MQTT connected")


def on_disconnect(_client, _userdata, _rc, _properties=None):
    global mqtt_connected
    mqtt_connected = False


def on_message(_client, _userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        key = (
            "indoor"
            if msg.topic == INDOOR_TOPIC
            else "outdoor"
            if msg.topic == OUTDOOR_TOPIC
            else None
        )
        if not key:
            return

        reading = SensorReading(
            temperature=data.get("temperature", 0),
            humidity=data.get("humidity", 0),
            battery=data.get("battery", 100),
            timestamp=time.time(),
        )
        sensors[key].history.append(reading)
        sensors[key].current = reading
    except Exception:
        logger.exception("Error processing message")


def start_mqtt():
    global mqtt_client
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    mqtt_client.on_connect = on_connect
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.on_message = on_message

    def loop():
        while True:
            try:
                mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
                mqtt_client.loop_forever()
            except Exception as e:
                logger.warning("MQTT reconnecting: %s", e)
                time.sleep(5)

    threading.Thread(target=loop, daemon=True).start()


def sensor_response(key: str) -> dict:
    s = sensors[key]
    c = s.current

    if c.timestamp == 0:
        return {"available": False, "error": "No data yet"}

    return {
        "available": True,
        "temperature": round(c.temperature, 1),
        "humidity": round(c.humidity, 1),
        "feels_like": round(feels_like(c.temperature, c.humidity), 1),
        "temperature_trend": get_trend(c.temperature, s.history, "temperature"),
        "humidity_trend": get_trend(c.humidity, s.history, "humidity"),
        "battery": c.battery,
        "age_seconds": round(time.time() - c.timestamp),
    }


@bp.route("/status")
def status():
    return jsonify({"mqtt_connected": mqtt_connected})


@bp.route("/indoor")
def indoor():
    return jsonify(sensor_response("indoor"))


@bp.route("/outdoor")
def outdoor():
    return jsonify(sensor_response("outdoor"))


@bp.route("/all")
def all_sensors():
    ind = sensor_response("indoor")
    out = sensor_response("outdoor")

    comparison = None
    if ind.get("available") and out.get("available"):
        diff = out["feels_like"] - ind["feels_like"]
        comparison = {
            "outside_feels_cooler": diff < -0.5,
            "outside_feels_warmer": diff > 0.5,
            "difference": round(diff, 1),
        }

    return jsonify({"indoor": ind, "outdoor": out, "comparison": comparison})


start_mqtt()

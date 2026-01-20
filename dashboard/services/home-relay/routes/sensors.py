"""
Indoor/outdoor climate sensor routes.
Subscribes to Zigbee2MQTT via MQTT, tracks history for trends.
Supports dynamic sensor selection from available Zigbee devices.
"""

import json
import logging
import math
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

import paho.mqtt.client as mqtt
from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)
bp = Blueprint("sensors", __name__, url_prefix="/sensors")

# Config
MQTT_HOST = "localhost"
MQTT_PORT = 1883
HISTORY_SIZE = 60  # Several hours of history
TREND_WINDOW = 6  # ~30-60 min of readings for trend
CONFIG_FILE = Path(__file__).parent.parent / "sensor_config.json"


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


# State
sensors: dict[str, SensorData] = {
    "indoor": SensorData(),
    "outdoor": SensorData(),
}
available_devices: list[dict] = []  # Devices from Zigbee2MQTT
sensor_config: dict[str, str] = {"indoor": "", "outdoor": ""}  # friendly_name -> role
mqtt_client: mqtt.Client | None = None
mqtt_connected = False
subscribed_topics: set[str] = set()


def load_config():
    """Load sensor config from file."""
    global sensor_config
    if CONFIG_FILE.exists():
        try:
            sensor_config = json.loads(CONFIG_FILE.read_text())
            logger.info("Loaded sensor config: %s", sensor_config)
        except Exception:
            logger.exception("Failed to load sensor config")


def save_config():
    """Save sensor config to file."""
    try:
        CONFIG_FILE.write_text(json.dumps(sensor_config, indent=2))
        logger.info("Saved sensor config: %s", sensor_config)
    except Exception:
        logger.exception("Failed to save sensor config")


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


def get_topic_for_device(friendly_name: str) -> str:
    """Get MQTT topic for a device."""
    return f"zigbee2mqtt/{friendly_name}"


def update_subscriptions():
    """Subscribe to configured sensor topics."""
    global subscribed_topics
    if not mqtt_client or not mqtt_connected:
        return

    # Determine which topics we need
    needed_topics = set()
    for role in ("indoor", "outdoor"):
        device_name = sensor_config.get(role)
        if device_name:
            needed_topics.add(get_topic_for_device(device_name))

    # Unsubscribe from old topics
    for topic in subscribed_topics - needed_topics:
        mqtt_client.unsubscribe(topic)
        logger.info("Unsubscribed from %s", topic)

    # Subscribe to new topics
    for topic in needed_topics - subscribed_topics:
        mqtt_client.subscribe(topic)
        logger.info("Subscribed to %s", topic)

    subscribed_topics = needed_topics


def on_connect(client, _userdata, _flags, rc, _properties=None):
    global mqtt_connected
    mqtt_connected = rc == 0
    if mqtt_connected:
        # Always subscribe to bridge/devices to get device list
        client.subscribe("zigbee2mqtt/bridge/devices")
        # Subscribe to configured sensors
        update_subscriptions()
        logger.info("MQTT connected")


def on_disconnect(_client, _userdata, _rc, _properties=None):
    global mqtt_connected
    mqtt_connected = False


def on_message(_client, _userdata, msg):
    global available_devices
    try:
        # Handle device list updates
        if msg.topic == "zigbee2mqtt/bridge/devices":
            devices = json.loads(msg.payload.decode())
            # Filter to only devices with temperature/humidity (climate sensors)
            available_devices = [
                {
                    "friendly_name": d.get("friendly_name", ""),
                    "model": d.get("definition", {}).get("model", "Unknown"),
                    "description": d.get("definition", {}).get("description", ""),
                }
                for d in devices
                if d.get("definition", {}).get("exposes")
                and any(
                    e.get("property") == "temperature"
                    for e in d.get("definition", {}).get("exposes", [])
                    if isinstance(e, dict)
                )
            ]
            logger.info("Found %d climate sensors", len(available_devices))
            return

        # Handle sensor data
        data = json.loads(msg.payload.decode())

        # Determine which sensor this is (indoor or outdoor)
        key = None
        for role in ("indoor", "outdoor"):
            device_name = sensor_config.get(role)
            if device_name and msg.topic == get_topic_for_device(device_name):
                key = role
                break

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
    load_config()

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


@bp.route("/devices")
def devices():
    """List available climate sensors from Zigbee2MQTT."""
    return jsonify(
        {
            "devices": available_devices,
            "config": sensor_config,
        }
    )


@bp.route("/config", methods=["POST"])
def set_config():
    """Set which device is indoor/outdoor."""
    global sensor_config
    data = request.get_json()

    # Update config
    if "indoor" in data:
        sensor_config["indoor"] = data["indoor"] or ""
        # Clear old data when changing sensor
        sensors["indoor"] = SensorData()
    if "outdoor" in data:
        sensor_config["outdoor"] = data["outdoor"] or ""
        sensors["outdoor"] = SensorData()

    save_config()
    update_subscriptions()

    return jsonify({"success": True, "config": sensor_config})


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

    return jsonify(
        {
            "indoor": ind,
            "outdoor": out,
            "comparison": comparison,
            "config": sensor_config,
        }
    )


start_mqtt()

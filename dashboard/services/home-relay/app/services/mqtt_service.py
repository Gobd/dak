"""MQTT service for Zigbee2MQTT sensor integration.

Subscribes to Zigbee2MQTT topics and tracks sensor readings with history for trends.
"""

import json
import logging
import math
import threading
import time
from collections import deque
from dataclasses import dataclass, field

import paho.mqtt.client as mqtt

from app.services.config_service import load_config as load_dashboard_config
from app.services.config_service import save_config as save_dashboard_config

logger = logging.getLogger(__name__)

# Config
MQTT_HOST = "localhost"
MQTT_PORT = 1883
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


# State
sensors: dict[str, SensorData] = {
    "indoor": SensorData(),
    "outdoor": SensorData(),
}
available_devices: list[dict] = []  # Climate sensors from Zigbee2MQTT
all_devices: list[dict] = []  # All devices from Zigbee2MQTT
bridge_info: dict = {}  # Bridge state (permit_join, version, etc.)
sensor_config: dict[str, str] = {"indoor": "", "outdoor": "", "unit": "C"}  # C or F
mqtt_client: mqtt.Client | None = None
mqtt_connected = False
subscribed_topics: set[str] = set()

# Pending request callbacks for command/response pattern
_pending_requests: dict[str, threading.Event] = {}
_request_results: dict[str, dict] = {}
_request_lock = threading.Lock()


def _generate_transaction_id() -> str:
    """Generate a unique transaction ID for request tracking."""
    import uuid

    return str(uuid.uuid4())[:8]


def load_config():
    """Load sensor config from dashboard config and update MQTT subscriptions if needed."""
    global sensor_config
    try:
        dashboard = load_dashboard_config()
        climate = dashboard.get("climate", {})
        old_indoor = sensor_config.get("indoor", "")
        old_outdoor = sensor_config.get("outdoor", "")

        sensor_config = {
            "indoor": climate.get("indoor", ""),
            "outdoor": climate.get("outdoor", ""),
            "unit": climate.get("unit", "C"),
        }

        # Update MQTT subscriptions if sensor assignments changed
        if old_indoor != sensor_config["indoor"] or old_outdoor != sensor_config["outdoor"]:
            logger.info("Sensor config changed, updating subscriptions")
            update_subscriptions()

    except Exception:
        logger.exception("Failed to load sensor config")


def save_config():
    """Save sensor config to dashboard config."""
    try:
        dashboard = load_dashboard_config()
        dashboard["climate"] = {
            "indoor": sensor_config.get("indoor", ""),
            "outdoor": sensor_config.get("outdoor", ""),
            "unit": sensor_config.get("unit", "C"),
        }
        save_dashboard_config(dashboard)
        logger.info("Saved sensor config: %s", sensor_config)
    except Exception:
        logger.exception("Failed to save sensor config")


def c_to_f(temp_c: float) -> float:
    """Convert Celsius to Fahrenheit."""
    return temp_c * 9 / 5 + 32


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
        # Subscribe to bridge topics for device management
        client.subscribe("zigbee2mqtt/bridge/devices")
        client.subscribe("zigbee2mqtt/bridge/info")
        client.subscribe("zigbee2mqtt/bridge/state")
        client.subscribe("zigbee2mqtt/bridge/response/#")
        # Subscribe to configured sensors
        update_subscriptions()
        logger.info("MQTT connected")


def on_disconnect(_client, _userdata, _rc, _properties=None):
    global mqtt_connected
    mqtt_connected = False


def on_message(_client, _userdata, msg):
    global available_devices, all_devices, bridge_info
    try:
        # Handle device list updates
        if msg.topic == "zigbee2mqtt/bridge/devices":
            devices = json.loads(msg.payload.decode())

            # Store all devices for device management
            all_devices = [
                {
                    "friendly_name": d.get("friendly_name", ""),
                    "ieee_address": d.get("ieee_address", ""),
                    "type": d.get("type", "Unknown"),
                    "network_address": d.get("network_address", 0),
                    "model": (d.get("definition") or {}).get("model"),
                    "vendor": (d.get("definition") or {}).get("vendor"),
                    "description": (d.get("definition") or {}).get("description"),
                    "power_source": d.get("power_source"),
                    "supported": d.get("supported", True),
                    "interviewing": d.get("interviewing", False),
                    "interview_completed": d.get("interview_completed", True),
                }
                for d in devices
            ]

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
            logger.info(
                "Found %d total devices, %d climate sensors",
                len(all_devices),
                len(available_devices),
            )
            return

        # Handle bridge info
        if msg.topic == "zigbee2mqtt/bridge/info":
            data = json.loads(msg.payload.decode())
            bridge_info = {
                "version": data.get("version"),
                "coordinator": data.get("coordinator"),
                "log_level": data.get("log_level"),
                "permit_join": data.get("permit_join", False),
                "permit_join_timeout": data.get("permit_join_timeout"),
            }
            logger.info("Bridge info updated: permit_join=%s", bridge_info.get("permit_join"))
            return

        # Handle bridge state (online/offline)
        if msg.topic == "zigbee2mqtt/bridge/state":
            data = json.loads(msg.payload.decode())
            state = data.get("state") if isinstance(data, dict) else data
            logger.info("Bridge state: %s", state)
            return

        # Handle bridge response (for command results)
        if msg.topic.startswith("zigbee2mqtt/bridge/response/"):
            data = json.loads(msg.payload.decode())
            # Extract transaction ID from response if present
            transaction = data.get("transaction")
            if transaction and transaction in _pending_requests:
                with _request_lock:
                    _request_results[transaction] = data
                    event = _pending_requests.get(transaction)
                    if event:
                        event.set()
            logger.debug("Bridge response: %s", data)
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
    """Start MQTT client in background thread."""
    global mqtt_client
    load_config()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)  # type: ignore[attr-defined]
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    mqtt_client = client

    def loop():
        logged_failure = False
        while True:
            try:
                client.connect(MQTT_HOST, MQTT_PORT, 60)
                logged_failure = False  # Reset on successful connect
                client.loop_forever()
            except Exception as e:
                if not logged_failure:
                    logger.info("MQTT not available (%s), will retry silently", e)
                    logged_failure = True
                time.sleep(30)  # Longer retry interval when MQTT is down

    threading.Thread(target=loop, daemon=True).start()
    logger.info("Started MQTT client thread")


def sensor_response(key: str) -> dict:
    """Build sensor response dict."""
    s = sensors[key]
    c = s.current

    if c.timestamp == 0:
        return {"available": False, "error": "No data yet"}

    temp = c.temperature
    fl = feels_like(c.temperature, c.humidity)

    # Convert to Fahrenheit if configured
    if sensor_config.get("unit", "C") == "F":
        temp = c_to_f(temp)
        fl = c_to_f(fl)

    return {
        "available": True,
        "temperature": round(temp, 1),
        "humidity": round(c.humidity, 1),
        "feels_like": round(fl, 1),
        "temperature_trend": get_trend(c.temperature, s.history, "temperature"),
        "humidity_trend": get_trend(c.humidity, s.history, "humidity"),
        "battery": c.battery,
        "age_seconds": round(time.time() - c.timestamp),
    }


def set_sensor_config(
    indoor: str | None = None, outdoor: str | None = None, unit: str | None = None
) -> dict:
    """Update sensor configuration."""
    global sensor_config

    if indoor is not None:
        sensor_config["indoor"] = indoor or ""
        # Clear old data when changing sensor
        sensors["indoor"] = SensorData()

    if outdoor is not None:
        sensor_config["outdoor"] = outdoor or ""
        sensors["outdoor"] = SensorData()

    if unit is not None and unit in ("C", "F"):
        sensor_config["unit"] = unit

    save_config()
    update_subscriptions()

    return {"success": True, "config": sensor_config}


def get_all_devices() -> list[dict]:
    """Get all Zigbee devices."""
    return all_devices


def get_bridge_state() -> dict:
    """Get bridge info including permit_join status."""
    return bridge_info


def _send_bridge_request(topic: str, payload: dict, timeout: float = 10.0) -> dict:
    """Send a request to Zigbee2MQTT bridge and wait for response."""
    if not mqtt_client or not mqtt_connected:
        return {"success": False, "error": "MQTT not connected"}

    transaction_id = _generate_transaction_id()
    payload["transaction"] = transaction_id

    event = threading.Event()
    with _request_lock:
        _pending_requests[transaction_id] = event

    try:
        mqtt_client.publish(topic, json.dumps(payload))
        if event.wait(timeout):
            with _request_lock:
                result = _request_results.pop(transaction_id, {})
            return result
        return {"success": False, "error": "Request timed out"}
    finally:
        with _request_lock:
            _pending_requests.pop(transaction_id, None)
            _request_results.pop(transaction_id, None)


def rename_device(old_name: str, new_name: str) -> dict:
    """Rename a Zigbee device."""
    result = _send_bridge_request(
        "zigbee2mqtt/bridge/request/device/rename",
        {"from": old_name, "to": new_name},
    )

    if result.get("status") == "ok":
        return {"success": True, "old_name": old_name, "new_name": new_name}

    return {
        "success": False,
        "old_name": old_name,
        "new_name": new_name,
        "error": result.get("error", "Unknown error"),
    }


def remove_device(device: str, force: bool = False) -> dict:
    """Remove a Zigbee device from the network."""
    payload: dict[str, str | bool] = {"id": device}
    if force:
        payload["force"] = True

    result = _send_bridge_request(
        "zigbee2mqtt/bridge/request/device/remove",
        payload,
    )

    if result.get("status") == "ok":
        return {"success": True, "device": device}

    return {
        "success": False,
        "device": device,
        "error": result.get("error", "Unknown error"),
    }


def permit_join(enable: bool, duration: int = 120) -> dict:
    """Enable or disable device pairing mode."""
    payload: dict[str, bool | int] = {"value": enable}
    if enable and duration:
        payload["time"] = duration

    result = _send_bridge_request(
        "zigbee2mqtt/bridge/request/permit_join",
        payload,
    )

    if result.get("status") == "ok":
        return {
            "success": True,
            "permit_join": enable,
            "time": duration if enable else None,
        }

    return {
        "success": False,
        "permit_join": bridge_info.get("permit_join", False),
        "error": result.get("error", "Unknown error"),
    }

"""Local AHT20 (I2C) sensor poller.

Reads the AHT20 wired directly to the Raspberry Pi's I2C bus and publishes
readings to MQTT under `home-relay/sensors/aht20-indoor`, the same topic shape
used by ESP32/ESPHome custom devices. This lets `mqtt_service` (and anything
else subscribed, e.g. Home Assistant) consume it identically to any other
custom device - no separate code path needed on the read side.

If the sensor isn't wired up (no I2C device, missing Blinka libs, etc.), the
poller logs once and exits quietly - it must never crash the app.
"""

import json
import logging
import threading
import time

from app.services import mqtt_service

logger = logging.getLogger(__name__)

FRIENDLY_NAME = "aht20-indoor"
TOPIC = f"home-relay/sensors/{FRIENDLY_NAME}"
POLL_INTERVAL = 60  # seconds

_available: bool | None = None


def _check_available() -> bool:
    """Check if the AHT20 is reachable on the I2C bus."""
    global _available
    if _available is None:
        try:
            import adafruit_ahtx0  # noqa: F401  # type: ignore[import-not-found]
            import board  # type: ignore[import-not-found]

            board.I2C()
            _available = True
        except (ImportError, NotImplementedError, ValueError, RuntimeError, OSError) as e:
            _available = False
            logger.info("AHT20 not available (%s), skipping local sensor poller", e)
    return _available


def start_aht20_poller() -> None:
    """Start the AHT20 poll/publish loop in a background thread, if the sensor is present."""
    if not _check_available():
        return

    def loop():
        import adafruit_ahtx0  # type: ignore[import-not-found]
        import board  # type: ignore[import-not-found]

        try:
            sensor = adafruit_ahtx0.AHTx0(board.I2C())
        except Exception:
            logger.exception("Failed to initialize AHT20, stopping poller")
            return

        while True:
            try:
                payload = json.dumps(
                    {
                        "temperature": round(sensor.temperature, 2),
                        "humidity": round(sensor.relative_humidity, 2),
                    }
                )
                if mqtt_service.mqtt_client and mqtt_service.mqtt_connected:
                    mqtt_service.mqtt_client.publish(TOPIC, payload)
            except Exception:
                logger.exception("Error reading/publishing AHT20 sensor")
            time.sleep(POLL_INTERVAL)

    threading.Thread(target=loop, daemon=True).start()
    logger.info("Started AHT20 local sensor poller")

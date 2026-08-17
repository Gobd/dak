"""
Home Relay Service - FastAPI Application
Provides HTTP endpoints for Kasa smart devices, Wake-on-LAN, brightness control,
climate sensors, and voice transcription.
"""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

# Configure logging for the app (not just uvicorn)
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(name)s - %(message)s",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)

# Disable uvicorn access logs for cleaner output
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# Import routers
from app.routers import (
    adguard,
    brightness,
    config,
    health,
    kasa,
    models,
    money,
    mqtt,
    notifications,
    planes,
    sensors,
    system_stats,
    transcribe,
    voice,
    voices,
    volume,
    wol,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup and shutdown events."""
    # Start MQTT service for sensors
    from app.services.mqtt_service import start_mqtt

    start_mqtt()

    # Start local AHT20 poller (no-op if sensor isn't wired up on this device)
    from app.services.aht20_service import start_aht20_poller

    start_aht20_poller()

    # Initialize Kasa event loop
    from app.services.kasa_service import get_event_loop

    get_event_loop()

    # Initialize notification service with SSE broadcaster
    from app.services import notification_service
    from app.services.sse_manager import config_sse

    notification_service.init(config_sse.broadcast)

    # Initialize money/spend-tracking service (depends on notification_service)
    from app.services import money_service

    money_service.init()

    # Initialize plane-tracker service (polls adsb.fi, alerts via ntfy)
    from app.services import plane_service

    plane_service.init()

    yield

    # Cleanup on shutdown (if needed)


app = FastAPI(
    title="Home Relay",
    description="Local home automation relay service",
    version="2.0.0",
    lifespan=lifespan,
)


# CORS middleware - explicit origins required when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_private_network_access_headers(request: Request, call_next):
    """Add Private Network Access headers to all responses."""
    try:
        response: Response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error in request %s %s", request.method, request.url.path)
        response = Response("Internal Server Error", status_code=500)

    # Allow Private Network Access (Chrome's CORS-PNA)
    response.headers["Access-Control-Allow-Private-Network"] = "true"

    # For preflight requests, also set the origin header from the request
    if request.method == "OPTIONS":
        origin = request.headers.get("Origin", "*")
        response.headers["Access-Control-Allow-Origin"] = origin

    return response


@app.get("/", response_class=HTMLResponse)
async def root():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kiosk</title>
<style>
  body {
    font-family: system-ui, sans-serif;
    background: #111;
    color: #eee;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    gap: 1rem;
  }
  h1 { font-size: 1.2rem; color: #888; margin-bottom: 0.5rem; }
  a {
    display: block;
    padding: 0.75rem 2rem;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 8px;
    color: #60a5fa;
    text-decoration: none;
    font-size: 1.1rem;
    width: 260px;
    text-align: center;
    transition: background 0.15s;
  }
  a:hover { background: #2a2a2a; border-color: #555; }
</style>
</head>
<body>
<h1>kiosk.home.arpa</h1>
<a href="https://dak.bkemper.me">dak.bkemper.me</a>
<a href="https://home-relay.bkemper.me">home-relay.bkemper.me</a>
<a href="https://ha.bkemper.me">ha.bkemper.me</a>
<a href="https://zigbee2mqtt.bkemper.me">zigbee2mqtt.bkemper.me</a>
<a href="http://boo.home.arpa">boo.home.arpa</a>
</body>
</html>
"""


# Register routers
app.include_router(health.router)
app.include_router(config.router)
app.include_router(volume.router)
app.include_router(wol.router)
app.include_router(brightness.router)
app.include_router(sensors.router)
app.include_router(kasa.router)
app.include_router(mqtt.router)
app.include_router(voice.router)
app.include_router(transcribe.router)
app.include_router(models.router)
app.include_router(voices.router)
app.include_router(adguard.router)
app.include_router(notifications.router)
app.include_router(system_stats.router)
app.include_router(money.router)
app.include_router(planes.router)

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

# Configure logging for the app (not just uvicorn)
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(name)s - %(message)s",
    stream=sys.stdout,
)

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
    mqtt,
    notifications,
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

    # Initialize Kasa event loop
    from app.services.kasa_service import get_event_loop

    get_event_loop()

    # Initialize notification service with SSE broadcaster
    from app.services import notification_service
    from app.services.sse_manager import config_sse

    notification_service.init(config_sse.broadcast)

    yield

    # Cleanup on shutdown (if needed)


app = FastAPI(
    title="Home Relay",
    description="Local home automation relay service",
    version="2.0.0",
    lifespan=lifespan,
)


# CORS middleware - allow all origins with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_private_network_access_headers(request: Request, call_next):
    """Add Private Network Access headers to all responses."""
    response: Response = await call_next(request)

    # Allow Private Network Access (Chrome's CORS-PNA)
    response.headers["Access-Control-Allow-Private-Network"] = "true"

    # For preflight requests, also set the origin header from the request
    if request.method == "OPTIONS":
        origin = request.headers.get("Origin", "*")
        response.headers["Access-Control-Allow-Origin"] = origin

    return response


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

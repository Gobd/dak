#!/usr/bin/env python3
"""
Home Relay Service
Provides HTTP endpoints for Kasa smart devices, Wake-on-LAN, and brightness control
"""

import contextlib
import json
import logging
import queue
import threading
from pathlib import Path

from flask import Flask, Response, jsonify, request

# Disable Flask/Werkzeug access logs
logging.getLogger("werkzeug").setLevel(logging.ERROR)

from routes import brightness_bp, kasa_bp, sensors_bp, voice_bp, volume_bp, wol_bp
from routes.brightness import init_app as init_brightness

app = Flask(__name__)

# Register blueprints
app.register_blueprint(kasa_bp)
app.register_blueprint(wol_bp)
app.register_blueprint(brightness_bp)
app.register_blueprint(sensors_bp)
app.register_blueprint(voice_bp)
app.register_blueprint(volume_bp)

# SSE subscribers
_sse_subscribers = []
_sse_lock = threading.Lock()

# Config path (saved user config only, frontend handles defaults)
CONFIG_DIR = Path.home() / ".config" / "home-relay"
DASHBOARD_CONFIG = CONFIG_DIR / "dashboard.json"


@app.before_request
def handle_preflight():
    """Return 200 for OPTIONS preflight (CORS headers added by after_request)."""
    if request.method == "OPTIONS":
        return "", 200
    return None


@app.after_request
def add_cors_headers(response):
    """Add CORS and Private Network Access headers to all responses."""
    response.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


# === Config Management ===


def _load_config():
    """Load saved config from file, or return empty dict if none exists."""
    if DASHBOARD_CONFIG.exists():
        with contextlib.suppress(Exception), DASHBOARD_CONFIG.open() as f:
            return json.load(f)
    return {}


def _save_config(config):
    """Save full dashboard config to file."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with DASHBOARD_CONFIG.open("w") as f:
        json.dump(config, f, indent=2)


def _notify_config_updated():
    """Notify all SSE subscribers that config has changed."""
    message = json.dumps({"type": "config-updated"})
    with _sse_lock:
        for q in _sse_subscribers:
            with contextlib.suppress(queue.Full):
                q.put_nowait(message)


def _sse_stream():
    """Generate SSE stream."""
    q = queue.Queue(maxsize=10)
    with _sse_lock:
        _sse_subscribers.append(q)
    try:
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
        while True:
            try:
                message = q.get(timeout=30)
                yield f"data: {message}\n\n"
            except queue.Empty:
                yield ": keepalive\n\n"
    finally:
        with _sse_lock:
            _sse_subscribers.remove(q)


# Initialize brightness routes with config loader
init_brightness(_load_config)


# === Config Endpoints ===


@app.route("/config/subscribe", methods=["GET"])
def config_subscribe():
    """SSE endpoint for live config updates."""
    return Response(
        _sse_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/config", methods=["GET"])
def get_config():
    """Get full dashboard configuration."""
    return jsonify(_load_config())


@app.route("/config", methods=["POST"])
def set_config():
    """Save dashboard configuration."""
    data = request.get_json() or {}
    _save_config(data)
    _notify_config_updated()
    return jsonify(data)


@app.route("/config/brightness", methods=["GET"])
def get_brightness_config():
    """Get just the brightness section (for shell script)."""
    config = _load_config()
    return jsonify(config.get("brightness", {}))


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5111, debug=False)

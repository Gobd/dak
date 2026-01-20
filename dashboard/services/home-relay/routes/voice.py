"""
Voice command routes - broadcasts commands via SSE to dashboard.
Dashboard forwards to notes-app iframe via postMessage.
"""

import json
import logging
import queue
import threading
import time

from flask import Blueprint, Response, jsonify, request

logger = logging.getLogger(__name__)
bp = Blueprint("voice", __name__, url_prefix="/voice")

# SSE subscribers for voice commands
subscribers: list[queue.Queue] = []
subscribers_lock = threading.Lock()


def broadcast_command(command: dict):
    """Send command to all SSE subscribers."""
    with subscribers_lock:
        dead = []
        for q in subscribers:
            try:
                q.put_nowait(command)
            except queue.Full:
                dead.append(q)
        for q in dead:
            subscribers.remove(q)


@bp.route("/command", methods=["POST"])
def send_command():
    """
    Receive voice command and broadcast to dashboard.
    Body: { "type": "add-to-list", "item": "cheese", "list": "groceries" }
    """
    data = request.get_json()
    if not data or "type" not in data:
        return jsonify({"error": "Missing command type"}), 400

    logger.info("Voice command: %s", data)
    broadcast_command(data)

    return jsonify({"success": True, "command": data})


@bp.route("/subscribe")
def subscribe():
    """SSE endpoint for dashboard to receive voice commands."""

    def stream():
        q: queue.Queue = queue.Queue(maxsize=10)
        with subscribers_lock:
            subscribers.append(q)

        try:
            # Send keepalive every 30s
            last_keepalive = time.time()
            while True:
                try:
                    cmd = q.get(timeout=1)
                    yield f"data: {json.dumps(cmd)}\n\n"
                except queue.Empty:
                    # Send keepalive to prevent connection timeout
                    if time.time() - last_keepalive > 30:
                        yield ": keepalive\n\n"
                        last_keepalive = time.time()
        finally:
            with subscribers_lock:
                if q in subscribers:
                    subscribers.remove(q)

    return Response(
        stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

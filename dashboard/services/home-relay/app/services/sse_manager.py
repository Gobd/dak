"""SSE subscriber management for config and voice command broadcasts."""

import asyncio
import json
import logging
import queue
import threading
from collections.abc import AsyncGenerator

logger = logging.getLogger(__name__)


class SSEManager:
    """Thread-safe SSE subscriber management.

    Uses queue-based approach for compatibility with sync code
    (MQTT callbacks, Flask-migrated code).
    """

    def __init__(self, name: str):
        self.name = name
        self._subscribers: list[queue.Queue] = []
        self._lock = threading.Lock()

    def broadcast(self, message: dict) -> None:
        """Broadcast message to all subscribers (thread-safe, sync)."""
        encoded = json.dumps(message)
        with self._lock:
            dead_queues = []
            for q in self._subscribers:
                try:
                    q.put_nowait(encoded)
                except queue.Full:
                    dead_queues.append(q)
            # Remove dead queues
            for q in dead_queues:
                self._subscribers.remove(q)
                logger.debug("%s: Removed dead subscriber", self.name)

    async def subscribe(self, initial_message: dict | None = None) -> AsyncGenerator[str, None]:
        """Subscribe and yield SSE events.

        Args:
            initial_message: Optional message to send immediately on connect
        """
        q: queue.Queue = queue.Queue(maxsize=10)

        with self._lock:
            self._subscribers.append(q)
        logger.debug("%s: New subscriber (total: %d)", self.name, len(self._subscribers))

        try:
            # Send initial message if provided
            if initial_message:
                yield f"data: {json.dumps(initial_message)}\n\n"

            # Stream messages with keepalive
            while True:
                try:
                    # Non-blocking check with async sleep
                    message = q.get_nowait()
                    yield f"data: {message}\n\n"
                except queue.Empty:
                    # Send keepalive every 30 seconds (check every 1 second)
                    await asyncio.sleep(1)
                    # Keepalive comment (not a data event)
                    yield ": keepalive\n\n"

        finally:
            with self._lock:
                if q in self._subscribers:
                    self._subscribers.remove(q)
            logger.debug("%s: Subscriber removed (total: %d)", self.name, len(self._subscribers))


# Global SSE managers
config_sse = SSEManager("config")
voice_sse = SSEManager("voice")

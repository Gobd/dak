"""Config management service.

Handles loading, saving, and broadcasting config updates.
Preserves _saveId mechanism to prevent update loops:
- When a client saves config, it sends a _saveId
- The _saveId is stripped before persisting (not saved to file)
- The _saveId is echoed in the SSE notification
- The originating client can ignore the SSE update that matches its saveId
"""

import contextlib
import json
import logging
from pathlib import Path

from app.services.sse_manager import config_sse

logger = logging.getLogger(__name__)

# Config path (saved user config only, frontend handles defaults)
CONFIG_DIR = Path.home() / ".config" / "home-relay"
DASHBOARD_CONFIG = CONFIG_DIR / "dashboard.json"


def load_config() -> dict:
    """Load saved config from file, or return empty dict if none exists."""
    if DASHBOARD_CONFIG.exists():
        with contextlib.suppress(Exception):
            with DASHBOARD_CONFIG.open() as f:
                return json.load(f)
    return {}


def save_config(config: dict) -> dict:
    """Save full dashboard config to file.

    Args:
        config: Config dict, may contain _saveId

    Returns:
        Config dict with _saveId stripped
    """
    # Extract and remove _saveId before persisting
    save_id = config.pop("_saveId", None)

    # Save to file
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with DASHBOARD_CONFIG.open("w") as f:
        json.dump(config, f, indent=2)

    # Notify SSE subscribers, including saveId so originating client can ignore
    notify_config_updated(save_id)

    return config


def notify_config_updated(save_id: str | None = None) -> None:
    """Notify all SSE subscribers that config has changed.

    Args:
        save_id: Optional ID of the save operation, echoed to clients
                 so they can ignore their own updates
    """
    payload = {"type": "config-updated"}
    if save_id:
        payload["saveId"] = save_id
    config_sse.broadcast(payload)

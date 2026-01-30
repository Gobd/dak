"""Notification service with SQLite storage and background scheduler.

Handles persistent notification events from iframed apps (health-tracker, maintenance-tracker, etc.)
and broadcasts them via SSE when they're due.
"""

import json
import logging
import sqlite3
import threading
from contextlib import closing
from datetime import date, datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

# Database path
DB_PATH = Path.home() / ".config" / "home-relay" / "notifications.db"

# SSE broadcaster - set during init
_broadcast = None

# Scheduler thread
_scheduler_thread = None
_scheduler_stop = threading.Event()


def init(broadcast_fn):
    """Initialize notification service with SSE broadcaster."""
    global _broadcast
    _broadcast = broadcast_fn
    _init_db()
    _start_scheduler()
    logger.info("Notification service initialized")


def _get_db():
    """Get database connection."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    """Initialize database tables."""
    with closing(_get_db()) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                due_date TEXT NOT NULL,
                data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(type, name)
            );

            CREATE TABLE IF NOT EXISTS dismissed (
                event_id INTEGER PRIMARY KEY,
                dismissed_until TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS type_preferences (
                type TEXT PRIMARY KEY,
                enabled INTEGER DEFAULT NULL,
                first_seen TEXT DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Migration: convert old schema (NOT NULL enabled, seen column) to new (nullable enabled)
        # Check if we have the old schema by looking for the seen column
        cursor = conn.execute("PRAGMA table_info(type_preferences)")
        columns = {row[1] for row in cursor.fetchall()}
        if "seen" in columns:
            # Old schema - migrate to new
            conn.executescript("""
                CREATE TABLE type_preferences_new (
                    type TEXT PRIMARY KEY,
                    enabled INTEGER DEFAULT NULL,
                    first_seen TEXT DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO type_preferences_new (type, enabled, first_seen)
                SELECT type, CASE WHEN seen = 1 THEN enabled ELSE NULL END, first_seen
                FROM type_preferences;
                DROP TABLE type_preferences;
                ALTER TABLE type_preferences_new RENAME TO type_preferences;
            """)
        conn.commit()


def _check_notifications():
    """Check for due notifications and broadcast them."""
    if not _broadcast:
        return

    now = datetime.now()
    today = now.date()
    tomorrow = today + timedelta(days=1)

    with closing(_get_db()) as conn:
        # Only get notifications for enabled types
        rows = conn.execute("""
            SELECT e.id, e.type, e.name, e.due_date, e.data, d.dismissed_until
            FROM events e
            LEFT JOIN dismissed d ON e.id = d.event_id
            INNER JOIN type_preferences tp ON e.type = tp.type AND tp.enabled = 1
            ORDER BY e.due_date ASC
        """).fetchall()

    due_notifications = []

    for row in rows:
        # Skip if dismissed and not expired
        if row["dismissed_until"]:
            try:
                dismissed_until = datetime.fromisoformat(row["dismissed_until"])
                if now < dismissed_until:
                    continue
            except ValueError:
                pass  # Invalid date, proceed with notification

        due_date = date.fromisoformat(row["due_date"])

        # Determine if we should notify
        should_notify = False
        is_overdue = due_date < today
        is_today = due_date == today
        is_tomorrow = due_date == tomorrow

        # Notify if overdue, due today, or due tomorrow
        if is_overdue or is_today or is_tomorrow:
            should_notify = True

        if should_notify:
            due_notifications.append(
                {
                    "id": row["id"],
                    "type": row["type"],
                    "name": row["name"],
                    "due_date": row["due_date"],
                    "data": json.loads(row["data"]) if row["data"] else None,
                    "is_overdue": is_overdue,
                    "is_today": is_today,
                    "is_tomorrow": is_tomorrow,
                }
            )

    if due_notifications:
        _broadcast({"type": "notifications", "notifications": due_notifications})


def _scheduler_loop():
    """Background scheduler that checks notifications every minute."""
    while not _scheduler_stop.is_set():
        try:
            _check_notifications()
        except Exception:
            logger.exception("Notification check error")
        _scheduler_stop.wait(60)  # Check every minute


def _start_scheduler():
    """Start the background scheduler thread."""
    global _scheduler_thread
    if _scheduler_thread and _scheduler_thread.is_alive():
        return
    _scheduler_stop.clear()
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_thread.start()
    logger.info("Notification scheduler started")


# === Public API ===


def add_event(event_type: str, name: str, due_date: str, data: dict | None = None) -> dict:
    """Add or update a notification event.

    If due_date changes from the existing event, clears any dismissal
    (so recurring items like shots come back after being logged).

    New notification types are registered but disabled by default.
    """
    # Normalize due_date to just the date part
    if "T" in due_date:
        due_date = due_date.split("T")[0]

    with closing(_get_db()) as conn:
        # Ensure type exists in preferences (NULL = unconfigured, requires user to pick)
        conn.execute(
            "INSERT OR IGNORE INTO type_preferences (type, enabled) VALUES (?, NULL)",
            (event_type,),
        )

        # Check if event exists with different due_date
        existing = conn.execute(
            "SELECT id, due_date FROM events WHERE type = ? AND name = ?",
            (event_type, name),
        ).fetchone()

        cursor = conn.execute(
            """
            INSERT INTO events (type, name, due_date, data)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(type, name) DO UPDATE SET
                due_date = excluded.due_date,
                data = excluded.data
            RETURNING id
            """,
            (event_type, name, due_date, json.dumps(data) if data else None),
        )
        row = cursor.fetchone()
        event_id = row["id"]

        # If due_date changed, clear dismissal so notification comes back
        if existing and existing["due_date"] != due_date:
            conn.execute("DELETE FROM dismissed WHERE event_id = ?", (event_id,))

        conn.commit()
        return {"success": True, "id": event_id}


def list_events() -> list[dict]:
    """List all notification events."""
    with closing(_get_db()) as conn:
        rows = conn.execute("""
            SELECT e.*, d.dismissed_until
            FROM events e
            LEFT JOIN dismissed d ON e.id = d.event_id
            ORDER BY e.due_date ASC
        """).fetchall()

    return [
        {
            "id": row["id"],
            "type": row["type"],
            "name": row["name"],
            "due_date": row["due_date"],
            "data": json.loads(row["data"]) if row["data"] else None,
            "created_at": row["created_at"],
            "dismissed_until": row["dismissed_until"],
        }
        for row in rows
    ]


def delete_event(event_id: int) -> dict:
    """Delete a notification event."""
    with closing(_get_db()) as conn:
        conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.execute("DELETE FROM dismissed WHERE event_id = ?", (event_id,))
        conn.commit()
    return {"success": True}


def dismiss_event(
    event_id: int, hours: int | None = 4, permanent: bool = False, until_midnight: bool = False
) -> dict:
    """Dismiss a notification for a specified duration.

    Options:
    - hours: Dismiss for N hours
    - until_midnight: Dismiss until midnight tonight (reappears tomorrow)
    - permanent: Dismiss indefinitely (until due_date changes)

    The dismissal persists even if the source re-registers the same event,
    UNLESS the due_date changes (e.g., after logging a shot).
    """
    if permanent:
        # Set far future dismissal - effectively permanent until due_date changes
        dismissed_until = (datetime.now() + timedelta(days=3650)).isoformat()
    elif until_midnight:
        # Dismiss until midnight tonight
        tomorrow = date.today() + timedelta(days=1)
        dismissed_until = datetime.combine(tomorrow, datetime.min.time()).isoformat()
    else:
        dismissed_until = (datetime.now() + timedelta(hours=hours or 4)).isoformat()

    with closing(_get_db()) as conn:
        conn.execute(
            """
            INSERT INTO dismissed (event_id, dismissed_until)
            VALUES (?, ?)
            ON CONFLICT(event_id) DO UPDATE SET dismissed_until = excluded.dismissed_until
            """,
            (event_id, dismissed_until),
        )
        conn.commit()

    return {"success": True, "dismissed_until": dismissed_until}


def undismiss_event(event_id: int) -> dict:
    """Clear dismissal for an event, making it due again."""
    with closing(_get_db()) as conn:
        conn.execute("DELETE FROM dismissed WHERE event_id = ?", (event_id,))
        conn.commit()
    return {"success": True}


def get_due_notifications() -> list[dict]:
    """Get currently due notifications (for initial load).

    Only returns notifications for enabled types.
    """
    now = datetime.now()
    today = now.date()
    tomorrow = today + timedelta(days=1)

    with closing(_get_db()) as conn:
        # Only get notifications for enabled types
        rows = conn.execute("""
            SELECT e.id, e.type, e.name, e.due_date, e.data, d.dismissed_until
            FROM events e
            LEFT JOIN dismissed d ON e.id = d.event_id
            INNER JOIN type_preferences tp ON e.type = tp.type AND tp.enabled = 1
            ORDER BY e.due_date ASC
        """).fetchall()

    due = []
    for row in rows:
        # Skip if dismissed
        if row["dismissed_until"]:
            try:
                if now < datetime.fromisoformat(row["dismissed_until"]):
                    continue
            except ValueError:
                pass

        due_date = date.fromisoformat(row["due_date"])
        is_overdue = due_date < today
        is_today = due_date == today
        is_tomorrow = due_date == tomorrow

        if is_overdue or is_today or is_tomorrow:
            due.append(
                {
                    "id": row["id"],
                    "type": row["type"],
                    "name": row["name"],
                    "due_date": row["due_date"],
                    "data": json.loads(row["data"]) if row["data"] else None,
                    "is_overdue": is_overdue,
                    "is_today": is_today,
                    "is_tomorrow": is_tomorrow,
                }
            )

    return due


def trigger_check():
    """Manually trigger notification check (for testing)."""
    _check_notifications()
    return {"success": True}


# === Type Preferences ===

# Known notification types (pre-populated so users can configure before first notification)
KNOWN_TYPES = ["shot", "maintenance", "weather"]


def _ensure_known_types():
    """Ensure known types exist in preferences table (unconfigured by default)."""
    with closing(_get_db()) as conn:
        for t in KNOWN_TYPES:
            conn.execute(
                "INSERT OR IGNORE INTO type_preferences (type, enabled) VALUES (?, NULL)",
                (t,),
            )
        conn.commit()


def get_type_preferences() -> list[dict]:
    """Get all notification type preferences."""
    _ensure_known_types()

    with closing(_get_db()) as conn:
        rows = conn.execute("""
            SELECT type, enabled, first_seen
            FROM type_preferences
            ORDER BY type ASC
        """).fetchall()

    return [
        {
            "type": row["type"],
            "enabled": None if row["enabled"] is None else bool(row["enabled"]),
            "first_seen": row["first_seen"],
            "is_known": row["enabled"] is not None,  # Known if explicitly configured (not NULL)
        }
        for row in rows
    ]


def set_type_enabled(event_type: str, enabled: bool) -> dict:
    """Enable or disable notifications for a type."""
    with closing(_get_db()) as conn:
        conn.execute(
            """
            INSERT INTO type_preferences (type, enabled)
            VALUES (?, ?)
            ON CONFLICT(type) DO UPDATE SET enabled = excluded.enabled
            """,
            (event_type, 1 if enabled else 0),
        )
        conn.commit()

    return {"success": True, "type": event_type, "enabled": enabled}


def get_unconfigured_count() -> int:
    """Get count of notification types that are unconfigured (enabled = NULL)."""
    with closing(_get_db()) as conn:
        row = conn.execute("""
            SELECT COUNT(*) as count
            FROM type_preferences
            WHERE enabled IS NULL
        """).fetchone()

    return row["count"] if row else 0


def delete_type_preference(event_type: str) -> dict:
    """Delete a notification type preference and all its events.

    When deleted, if a new notification of this type comes in later,
    it will be re-added as a new unconfigured type.
    """
    with closing(_get_db()) as conn:
        # Get all event IDs for this type to clean up dismissed table
        event_ids = conn.execute("SELECT id FROM events WHERE type = ?", (event_type,)).fetchall()

        # Delete dismissed entries for these events
        for row in event_ids:
            conn.execute("DELETE FROM dismissed WHERE event_id = ?", (row["id"],))

        # Delete all events of this type
        conn.execute("DELETE FROM events WHERE type = ?", (event_type,))

        # Delete the type preference
        conn.execute("DELETE FROM type_preferences WHERE type = ?", (event_type,))

        conn.commit()

    return {"success": True, "type": event_type}

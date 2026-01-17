"""Notification system endpoints with SQLite storage."""

import json
import logging
import sqlite3
import threading
from contextlib import closing
from datetime import date, datetime, timedelta
from pathlib import Path

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

bp = Blueprint("notifications", __name__, url_prefix="/notifications")

# Database path
DB_PATH = Path.home() / ".config" / "home-relay" / "notifications.db"

# SSE broadcaster - set by main app
_broadcast = None

# Scheduler thread
_scheduler_thread = None
_scheduler_stop = threading.Event()


def init_app(broadcast_fn):
    """Initialize with SSE broadcaster from main app."""
    global _broadcast
    _broadcast = broadcast_fn
    _init_db()
    _start_scheduler()


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

            CREATE TABLE IF NOT EXISTS prefs (
                type TEXT PRIMARY KEY,
                remind_day_before INTEGER DEFAULT 1,
                remind_day_of INTEGER DEFAULT 1,
                time_before_start TEXT DEFAULT '17:00',
                time_before_end TEXT DEFAULT '21:00',
                time_day_of_start TEXT DEFAULT '05:00',
                time_day_of_end TEXT DEFAULT '08:00'
            );

            CREATE TABLE IF NOT EXISTS dismissed (
                event_id INTEGER,
                dismissed_until TEXT NOT NULL,
                PRIMARY KEY (event_id)
            );
        """)
        conn.commit()


def _check_notifications():
    """Check for due notifications and broadcast them."""
    if not _broadcast:
        return

    now = datetime.now()
    today = now.date()
    tomorrow = today + timedelta(days=1)
    current_time = now.strftime("%H:%M")

    with closing(_get_db()) as conn:
        # Get all events with their prefs
        rows = conn.execute("""
            SELECT e.id, e.type, e.name, e.due_date, e.data,
                   COALESCE(p.remind_day_before, 1) as remind_day_before,
                   COALESCE(p.remind_day_of, 1) as remind_day_of,
                   COALESCE(p.time_before_start, '17:00') as time_before_start,
                   COALESCE(p.time_before_end, '21:00') as time_before_end,
                   COALESCE(p.time_day_of_start, '05:00') as time_day_of_start,
                   COALESCE(p.time_day_of_end, '08:00') as time_day_of_end,
                   d.dismissed_until
            FROM events e
            LEFT JOIN prefs p ON e.type = p.type
            LEFT JOIN dismissed d ON e.id = d.event_id
        """).fetchall()

    due_notifications = []

    for row in rows:
        # Skip if dismissed and not expired
        if row["dismissed_until"]:
            dismissed_until = datetime.fromisoformat(row["dismissed_until"])
            if now < dismissed_until:
                continue

        due_date = date.fromisoformat(row["due_date"])

        # Check if we should notify
        should_notify = False

        # Day before: due_date is tomorrow
        if (
            row["remind_day_before"]
            and due_date == tomorrow
            and row["time_before_start"] <= current_time <= row["time_before_end"]
        ):
            should_notify = True

        # Day of: due_date is today
        if (
            row["remind_day_of"]
            and due_date == today
            and row["time_day_of_start"] <= current_time <= row["time_day_of_end"]
        ):
            should_notify = True

        # Overdue: due_date is in the past
        if due_date < today and row["time_day_of_start"] <= current_time <= row["time_day_of_end"]:
            should_notify = True

        if should_notify:
            due_notifications.append(
                {
                    "id": row["id"],
                    "type": row["type"],
                    "name": row["name"],
                    "due_date": row["due_date"],
                    "data": json.loads(row["data"]) if row["data"] else None,
                    "is_overdue": due_date < today,
                    "is_today": due_date == today,
                }
            )

    if due_notifications:
        _broadcast(
            {
                "type": "notifications",
                "notifications": due_notifications,
            }
        )


def _scheduler_loop():
    """Background scheduler that checks notifications every minute."""
    while not _scheduler_stop.is_set():
        try:
            _check_notifications()
        except Exception as e:
            logger.exception("Notification check error: %s", e)
        _scheduler_stop.wait(60)  # Check every minute


def _start_scheduler():
    """Start the background scheduler thread."""
    global _scheduler_thread
    if _scheduler_thread and _scheduler_thread.is_alive():
        return
    _scheduler_stop.clear()
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_thread.start()


# === Endpoints ===


@bp.route("", methods=["POST"])
def add_event():
    """Add or update a notification event."""
    data = request.get_json() or {}

    event_type = data.get("type")
    name = data.get("name")
    due_date = data.get("due")

    if not event_type or not name or not due_date:
        return jsonify({"error": "type, name, and due are required"}), 400

    # Normalize due_date to just the date part
    if "T" in due_date:
        due_date = due_date.split("T")[0]

    with closing(_get_db()) as conn:
        conn.execute(
            """
            INSERT INTO events (type, name, due_date, data)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(type, name) DO UPDATE SET
                due_date = excluded.due_date,
                data = excluded.data
        """,
            (event_type, name, due_date, json.dumps(data.get("data"))),
        )
        conn.commit()

    return jsonify({"success": True})


@bp.route("", methods=["GET"])
def list_events():
    """List all notification events."""
    with closing(_get_db()) as conn:
        rows = conn.execute("""
            SELECT e.*, d.dismissed_until
            FROM events e
            LEFT JOIN dismissed d ON e.id = d.event_id
            ORDER BY e.due_date ASC
        """).fetchall()

    events = [
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

    return jsonify(events)


@bp.route("/<int:event_id>", methods=["DELETE"])
def delete_event(event_id):
    """Delete a notification event."""
    with closing(_get_db()) as conn:
        conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.execute("DELETE FROM dismissed WHERE event_id = ?", (event_id,))
        conn.commit()
    return jsonify({"success": True})


@bp.route("/<int:event_id>/dismiss", methods=["POST"])
def dismiss_event(event_id):
    """Dismiss a notification until a specified time."""
    data = request.get_json() or {}
    hours = data.get("hours", 4)  # Default: dismiss for 4 hours

    dismissed_until = (datetime.now() + timedelta(hours=hours)).isoformat()

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

    return jsonify({"success": True, "dismissed_until": dismissed_until})


@bp.route("/check", methods=["POST"])
def trigger_check():
    """Manually trigger notification check (for testing)."""
    _check_notifications()
    return jsonify({"success": True})


# === Preferences Endpoints ===


@bp.route("/prefs", methods=["GET"])
def list_prefs():
    """List all notification preferences."""
    with closing(_get_db()) as conn:
        rows = conn.execute("SELECT * FROM prefs").fetchall()

    prefs = {}
    for row in rows:
        prefs[row["type"]] = {
            "remind_day_before": bool(row["remind_day_before"]),
            "remind_day_of": bool(row["remind_day_of"]),
            "time_before_start": row["time_before_start"],
            "time_before_end": row["time_before_end"],
            "time_day_of_start": row["time_day_of_start"],
            "time_day_of_end": row["time_day_of_end"],
        }

    return jsonify(prefs)


@bp.route("/prefs/<event_type>", methods=["POST"])
def set_prefs(event_type):
    """Set notification preferences for a type."""
    data = request.get_json() or {}

    with closing(_get_db()) as conn:
        conn.execute(
            """
            INSERT INTO prefs (type, remind_day_before, remind_day_of,
                              time_before_start, time_before_end,
                              time_day_of_start, time_day_of_end)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(type) DO UPDATE SET
                remind_day_before = excluded.remind_day_before,
                remind_day_of = excluded.remind_day_of,
                time_before_start = excluded.time_before_start,
                time_before_end = excluded.time_before_end,
                time_day_of_start = excluded.time_day_of_start,
                time_day_of_end = excluded.time_day_of_end
        """,
            (
                event_type,
                int(data.get("remind_day_before", True)),
                int(data.get("remind_day_of", True)),
                data.get("time_before_start", "17:00"),
                data.get("time_before_end", "21:00"),
                data.get("time_day_of_start", "05:00"),
                data.get("time_day_of_end", "08:00"),
            ),
        )
        conn.commit()

    return jsonify({"success": True})


@bp.route("/prefs/<event_type>", methods=["DELETE"])
def delete_prefs(event_type):
    """Delete notification preferences for a type (revert to defaults)."""
    with closing(_get_db()) as conn:
        conn.execute("DELETE FROM prefs WHERE type = ?", (event_type,))
        conn.commit()
    return jsonify({"success": True})

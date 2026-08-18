"""Plane-tracker service: polls adsb.fi, matches a watch list, alerts via ntfy.

Polls `opendata.adsb.fi`'s free public API (readsb/dump1090-fa JSON schema, no
API key required) on an interval, centered on a configured home lat/lon.
`radius_nm` bounds only the adsb.fi *search* area (how far out to look); the
actual alert trigger is projected time-to-arrival (ETA) based on each
aircraft's current distance, heading, and ground speed, so fast inbound
traffic is flagged with more real warning time than slow traffic at the same
distance. Aircraft whose ETA is under the configured `target_warning_minutes`
(and below an optional altitude ceiling) are checked against a user-defined
watch list (by ICAO hex, callsign prefix, aircraft type/model, or unresolved/
anonymous). New matches push a notification via ntfy.sh.

adsb.fi already returns `dst` (nm from the query point) and `dir` (bearing
from home to the aircraft) precomputed, so only the closing-speed/ETA
trigonometry needs to be done locally.
"""

import logging
import math
import sqlite3
import threading
from contextlib import closing
from datetime import datetime, timedelta
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

DB_PATH = Path.home() / ".config" / "home-relay" / "planes_v3.db"

ADSB_PROVIDERS = (
    ("ADSB.lol", "https://api.adsb.lol/v2"),
    ("ADSB.fi", "https://opendata.adsb.fi/api/v2"),
)
DEFAULT_RADIUS_NM = 40.0
DEFAULT_TARGET_WARNING_MINUTES = 5.0
DEFAULT_POLL_INTERVAL_SECONDS = 60
MIN_POLL_INTERVAL_SECONDS = 60
RENOTIFY_AFTER_MINUTES = 30  # re-alert if a matched aircraft is still around after this long
MIN_CLOSING_SPEED_KT = 1.0  # below this, treat as not closing (avoids near-zero-speed noise)
SIGHTING_HISTORY_RETENTION_MINUTES = 15  # bounds sighting_history growth

_scheduler_thread: threading.Thread | None = None
_scheduler_stop = threading.Event()

_last_polled_at: str | None = None
_last_poll_error: str | None = None


def init() -> None:
    """Initialize the plane-tracker DB and start the background poll scheduler."""
    _init_db()
    _start_scheduler()
    logger.info("Plane service initialized")


def _get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    with closing(_get_db()) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                active_location_profile_id INTEGER,
                radius_nm REAL NOT NULL DEFAULT 40.0,
                target_warning_minutes REAL NOT NULL DEFAULT 5.0,
                max_miss_distance_nm REAL NOT NULL DEFAULT 0,
                poll_interval_seconds INTEGER NOT NULL DEFAULT 60,
                ntfy_base_url TEXT NOT NULL DEFAULT 'https://ntfy.sh'
            );

            CREATE TABLE IF NOT EXISTS location_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                lat REAL,
                lon REAL,
                ntfy_topic TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                match_type TEXT NOT NULL,
                match_value TEXT NOT NULL,
                max_altitude_ft INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sightings_cache (
                hex TEXT PRIMARY KEY,
                flight TEXT,
                registration TEXT,
                model TEXT,
                desc TEXT,
                lat REAL,
                lon REAL,
                alt_baro INTEGER,
                ground_speed REAL,
                track REAL,
                distance_nm REAL,
                bearing_deg REAL,
                closing_speed_kt REAL,
                eta_minutes REAL,
                miss_distance_nm REAL,
                in_geofence INTEGER NOT NULL DEFAULT 0,
                matched_watchlist_id INTEGER,
                matched_label TEXT,
                seen_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notified_log (
                hex TEXT NOT NULL,
                watchlist_id INTEGER NOT NULL,
                notified_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (hex, watchlist_id)
            );

            CREATE TABLE IF NOT EXISTS sighting_history (
                hex TEXT NOT NULL,
                distance_nm REAL,
                in_geofence INTEGER NOT NULL DEFAULT 0,
                polled_at TEXT NOT NULL,
                PRIMARY KEY (hex, polled_at)
            );

            CREATE INDEX IF NOT EXISTS idx_sighting_history_hex
                ON sighting_history (hex, polled_at);

            INSERT OR IGNORE INTO settings (id) VALUES (1);
            INSERT OR IGNORE INTO location_profiles (name) VALUES ('Home');
            UPDATE settings
            SET active_location_profile_id = COALESCE(
                active_location_profile_id,
                (SELECT id FROM location_profiles WHERE name = 'Home' COLLATE NOCASE)
            )
            WHERE id = 1;
        """)

        profile_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(location_profiles)")
        }
        if "ntfy_topic" not in profile_columns:
            conn.execute("ALTER TABLE location_profiles ADD COLUMN ntfy_topic TEXT")

        settings_columns = {row["name"] for row in conn.execute("PRAGMA table_info(settings)")}
        if "ntfy_topic" in settings_columns:
            conn.execute(
                """
                UPDATE location_profiles
                SET ntfy_topic = (
                    SELECT ntfy_topic FROM settings WHERE id = 1
                )
                WHERE id = (
                    SELECT active_location_profile_id FROM settings WHERE id = 1
                ) AND ntfy_topic IS NULL
                """
            )
            conn.execute("ALTER TABLE settings DROP COLUMN ntfy_topic")
        conn.commit()


# === Settings ===


def get_settings() -> dict:
    with closing(_get_db()) as conn:
        row = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        return dict(row)


def update_settings(update: dict) -> dict:
    """Patch settings; only keys present and not None are applied."""
    with closing(_get_db()) as conn:
        fields = []
        values = []
        for key in (
            "radius_nm",
            "target_warning_minutes",
            "max_miss_distance_nm",
            "ntfy_base_url",
        ):
            if update.get(key) is not None:
                fields.append(f"{key} = ?")
                values.append(update[key])

        if update.get("poll_interval_seconds") is not None:
            fields.append("poll_interval_seconds = ?")
            values.append(max(update["poll_interval_seconds"], MIN_POLL_INTERVAL_SECONDS))

        if fields:
            conn.execute(f"UPDATE settings SET {', '.join(fields)} WHERE id = 1", values)
            conn.commit()

        row = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        return dict(row)


# === Location profiles ===


def list_location_profiles() -> list[dict]:
    with closing(_get_db()) as conn:
        active_id = conn.execute(
            "SELECT active_location_profile_id FROM settings WHERE id = 1"
        ).fetchone()["active_location_profile_id"]
        rows = conn.execute(
            "SELECT * FROM location_profiles ORDER BY name COLLATE NOCASE"
        ).fetchall()
        return [{**dict(row), "is_active": row["id"] == active_id} for row in rows]


def _get_location_profile(profile_id: int) -> dict | None:
    with closing(_get_db()) as conn:
        active_id = conn.execute(
            "SELECT active_location_profile_id FROM settings WHERE id = 1"
        ).fetchone()["active_location_profile_id"]
        row = conn.execute("SELECT * FROM location_profiles WHERE id = ?", (profile_id,)).fetchone()
        return {**dict(row), "is_active": profile_id == active_id} if row else None


def add_location_profile(name: str, ntfy_topic: str | None = None) -> dict:
    with closing(_get_db()) as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO location_profiles (name, ntfy_topic) VALUES (?, ?)",
                (name.strip(), ntfy_topic.strip() if ntfy_topic else None),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError("A location profile with that name already exists") from exc
        profile_id = cursor.lastrowid
        if profile_id is None:
            raise RuntimeError("SQLite did not return a location profile ID")
        conn.execute(
            "UPDATE settings SET active_location_profile_id = ? WHERE id = 1", (profile_id,)
        )
        _clear_location_state(conn)
        conn.commit()
    _reset_poll_status()
    profile = _get_location_profile(profile_id)
    if profile is None:
        raise RuntimeError("New location profile could not be loaded")
    return profile


def update_location_profile(profile_id: int, update: dict) -> dict | None:
    fields = []
    values = []
    for key in ("name", "lat", "lon", "ntfy_topic"):
        if key in update and (key == "ntfy_topic" or update[key] is not None):
            fields.append(f"{key} = ?")
            value = update[key]
            if isinstance(value, str) and key in ("name", "ntfy_topic"):
                value = value.strip() or None
            values.append(value)

    location_changed_active = False
    with closing(_get_db()) as conn:
        exists = conn.execute(
            "SELECT 1 FROM location_profiles WHERE id = ?", (profile_id,)
        ).fetchone()
        if not exists:
            return None
        if fields:
            values.append(profile_id)
            try:
                conn.execute(
                    f"UPDATE location_profiles SET {', '.join(fields)} WHERE id = ?", values
                )
            except sqlite3.IntegrityError as exc:
                raise ValueError("A location profile with that name already exists") from exc
            active_id = conn.execute(
                "SELECT active_location_profile_id FROM settings WHERE id = 1"
            ).fetchone()["active_location_profile_id"]
            if profile_id == active_id and ("lat" in update or "lon" in update):
                _clear_location_state(conn)
                location_changed_active = True
            conn.commit()
    if location_changed_active:
        _reset_poll_status()
    return _get_location_profile(profile_id)


def activate_location_profile(profile_id: int) -> dict | None:
    with closing(_get_db()) as conn:
        exists = conn.execute(
            "SELECT 1 FROM location_profiles WHERE id = ?", (profile_id,)
        ).fetchone()
        if not exists:
            return None
        conn.execute(
            "UPDATE settings SET active_location_profile_id = ? WHERE id = 1", (profile_id,)
        )
        _clear_location_state(conn)
        conn.commit()
    _reset_poll_status()
    return _get_location_profile(profile_id)


def delete_location_profile(profile_id: int) -> dict:
    with closing(_get_db()) as conn:
        active_id = conn.execute(
            "SELECT active_location_profile_id FROM settings WHERE id = 1"
        ).fetchone()["active_location_profile_id"]
        conn.execute(
            "UPDATE settings SET active_location_profile_id = NULL "
            "WHERE id = 1 AND active_location_profile_id = ?",
            (profile_id,),
        )
        deleted = conn.execute("DELETE FROM location_profiles WHERE id = ?", (profile_id,))
        if deleted.rowcount > 0 and profile_id == active_id:
            _clear_location_state(conn)
        conn.commit()
        if deleted.rowcount > 0 and profile_id == active_id:
            _reset_poll_status()
        return {"success": deleted.rowcount > 0}


def _clear_location_state(conn: sqlite3.Connection) -> None:
    """Discard calculations tied to the previously active coordinates."""
    conn.execute("DELETE FROM sightings_cache")
    conn.execute("DELETE FROM sighting_history")
    conn.execute("DELETE FROM notified_log")


def _reset_poll_status() -> None:
    global _last_polled_at, _last_poll_error
    _last_polled_at = None
    _last_poll_error = None


# === Watch list ===


def list_watchlist() -> list[dict]:
    with closing(_get_db()) as conn:
        rows = conn.execute("SELECT * FROM watchlist ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]


def add_watchlist_entry(
    label: str, match_type: str, match_value: str, max_altitude_ft: int | None = None
) -> dict:
    with closing(_get_db()) as conn:
        cursor = conn.execute(
            """
            INSERT INTO watchlist (label, match_type, match_value, max_altitude_ft)
            VALUES (?, ?, ?, ?)
            """,
            (label, match_type, match_value.strip().upper(), max_altitude_ft),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM watchlist WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)


def update_watchlist_entry(
    entry_id: int,
    label: str,
    match_type: str,
    match_value: str,
    max_altitude_ft: int | None = None,
) -> dict | None:
    with closing(_get_db()) as conn:
        cursor = conn.execute(
            """
            UPDATE watchlist
            SET label = ?, match_type = ?, match_value = ?, max_altitude_ft = ?
            WHERE id = ?
            """,
            (label, match_type, match_value.strip().upper(), max_altitude_ft, entry_id),
        )
        if cursor.rowcount == 0:
            return None
        conn.execute("DELETE FROM notified_log WHERE watchlist_id = ?", (entry_id,))
        conn.commit()
        row = conn.execute("SELECT * FROM watchlist WHERE id = ?", (entry_id,)).fetchone()
        return dict(row)


def delete_watchlist_entry(entry_id: int) -> dict:
    with closing(_get_db()) as conn:
        conn.execute("DELETE FROM watchlist WHERE id = ?", (entry_id,))
        conn.execute("DELETE FROM notified_log WHERE watchlist_id = ?", (entry_id,))
        conn.commit()
        return {"success": True}


# === Live sightings ===


def get_live() -> dict:
    with closing(_get_db()) as conn:
        rows = conn.execute(
            """
            SELECT * FROM sightings_cache
            ORDER BY in_geofence DESC, eta_minutes IS NULL, eta_minutes ASC, distance_nm ASC
            """
        ).fetchall()
        aircraft = [
            {
                **dict(r),
                "in_geofence": bool(r["in_geofence"]),
            }
            for r in rows
        ]
    return {
        "aircraft": aircraft,
        "last_polled_at": _last_polled_at,
        "last_poll_error": _last_poll_error,
    }


def _compute_eta_minutes(
    dst: float | None,
    bearing_deg: float | None,
    track: float | None,
    gs: float | None,
) -> tuple[float | None, float | None]:
    """Compute closing speed (kt) and projected time-to-arrival (minutes) at home.

    `bearing_deg` is the bearing FROM home TO the aircraft (adsb.fi's `dir`).
    Closing speed is the aircraft's ground speed projected onto the bearing
    back toward home; a non-positive result means it's not actually closing
    (receding or tangential), so ETA is undefined in that case.
    Returns (closing_speed_kt, eta_minutes), either/both None when not computable.
    """
    if dst is None or bearing_deg is None or track is None or gs is None:
        return None, None

    bearing_to_home_deg = (bearing_deg + 180) % 360
    angle_diff = math.radians(track - bearing_to_home_deg)
    closing_speed_kt = gs * math.cos(angle_diff)

    if closing_speed_kt < MIN_CLOSING_SPEED_KT:
        return closing_speed_kt, None

    eta_minutes = dst / (closing_speed_kt / 60)
    return closing_speed_kt, eta_minutes


def _compute_miss_distance_nm(
    dst: float | None,
    bearing_deg: float | None,
    track: float | None,
    closing_speed_kt: float | None,
) -> float | None:
    """Predicted closest-approach distance (nm) if the aircraft holds its current track.

    Perpendicular distance from home to the aircraft's projected straight-line path,
    derived from the 2D cross product of its position vector and heading unit vector:
    miss_distance = dst * |sin(bearing_deg - track)|. Only meaningful while actually
    closing (reuses the closing_speed_kt sign already computed by _compute_eta_minutes,
    rather than re-deriving it) - a receding/tangential aircraft isn't "approaching"
    anything, so there's no meaningful closest-approach answer to report.
    """
    if (
        dst is None
        or bearing_deg is None
        or track is None
        or closing_speed_kt is None
        or closing_speed_kt <= 0
    ):
        return None

    return dst * abs(math.sin(math.radians(bearing_deg - track)))


def _is_confirmed_inbound(
    conn: sqlite3.Connection, hex_code: str, distance_nm: float | None, in_geofence: bool
) -> bool:
    """Require in_geofence on this AND the previous poll, with distance actually decreasing.

    Guards against a single-poll false trigger (e.g. a momentary heading blip mid-turn)
    by requiring ground-truth confirmation across two consecutive polls, not just trusting
    the heading-derived ETA math again. First-ever sighting of an aircraft can't confirm yet.
    """
    if not in_geofence or distance_nm is None:
        return False

    prev = conn.execute(
        "SELECT distance_nm, in_geofence FROM sighting_history WHERE hex = ? "
        "ORDER BY polled_at DESC LIMIT 1",
        (hex_code,),
    ).fetchone()
    if prev is None or not prev["in_geofence"] or prev["distance_nm"] is None:
        return False

    return distance_nm < prev["distance_nm"]


def _match_watchlist(aircraft: dict, watchlist: list[dict]) -> dict | None:
    hex_code = (aircraft.get("hex") or "").upper()
    flight = (aircraft.get("flight") or "").strip().upper()
    model = (aircraft.get("t") or "").upper()
    is_unresolved = not model and not aircraft.get("desc")
    altitude = aircraft.get("alt_baro")

    for entry in watchlist:
        altitude_limit = entry.get("max_altitude_ft")
        if (
            altitude_limit is not None
            and isinstance(altitude, (int, float))
            and altitude > altitude_limit
        ):
            continue
        value = entry["match_value"]
        if entry["match_type"] == "icao_hex" and hex_code == value:
            return entry
        if entry["match_type"] == "callsign_prefix" and flight.startswith(value):
            return entry
        if entry["match_type"] == "model" and model == value:
            return entry
        if entry["match_type"] == "unresolved" and is_unresolved:
            return entry
    return None


def _notify_ntfy(
    base_url: str,
    topic: str,
    aircraft: dict,
    label: str,
    eta_minutes: float | None,
    miss_distance_nm: float | None,
) -> None:
    flight = (aircraft.get("flight") or aircraft.get("hex") or "unknown").strip()
    model = aircraft.get("t") or aircraft.get("desc") or "unknown model"
    distance = aircraft.get("dst")
    alt = aircraft.get("alt_baro")
    distance_str = f"{distance:.1f} nm" if isinstance(distance, (int, float)) else "unknown range"
    alt_str = f"{alt} ft" if isinstance(alt, (int, float)) else "unknown alt"
    eta_str = f"ETA {eta_minutes:.1f} min" if eta_minutes is not None else None
    dca_str = f"DCA {miss_distance_nm:.1f} nm" if miss_distance_nm is not None else None

    detail_parts = [distance_str, alt_str, eta_str, dca_str]
    message = f"{flight} ({model}) - " + ", ".join(p for p in detail_parts if p)
    title = f"Plane alert: {label}"

    try:
        httpx.post(
            f"{base_url.rstrip('/')}/{topic}",
            content=message.encode("utf-8"),
            headers={"Title": title, "Priority": "default", "Tags": "airplane"},
            timeout=10,
        )
    except httpx.HTTPError:
        logger.exception("Failed to send ntfy notification for %s", flight)


def _fetch_aircraft(home_lat: float, home_lon: float, radius_nm: float) -> tuple[list[dict], str]:
    """Fetch nearby aircraft, trying each community provider in order."""
    errors = []
    for provider_name, base_url in ADSB_PROVIDERS:
        try:
            response = httpx.get(
                f"{base_url}/lat/{home_lat}/lon/{home_lon}/dist/{radius_nm}",
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()
            aircraft = data.get("ac", data.get("aircraft"))
            if not isinstance(aircraft, list):
                raise ValueError("response did not contain an aircraft list")
            return aircraft, provider_name
        except (httpx.HTTPError, ValueError) as exc:
            errors.append(f"{provider_name}: {exc}")
            logger.warning("%s poll failed: %s", provider_name, exc)

    raise RuntimeError("All aircraft providers failed — " + "; ".join(errors))


def _poll_once() -> None:
    global _last_polled_at, _last_poll_error

    settings = get_settings()
    active_profile_id = settings["active_location_profile_id"]
    profile = _get_location_profile(active_profile_id) if active_profile_id is not None else None
    if profile is None:
        logger.info("Plane tracker location profile not set, skipping poll")
        return
    home_lat = profile["lat"]
    home_lon = profile["lon"]
    if home_lat is None or home_lon is None:
        logger.info("Plane tracker home location not set, skipping poll")
        return

    radius_nm = settings["radius_nm"]
    target_warning_minutes = settings["target_warning_minutes"]
    max_miss_distance_nm = settings["max_miss_distance_nm"]
    watchlist = list_watchlist()

    try:
        aircraft_list, provider_name = _fetch_aircraft(home_lat, home_lon, radius_nm)
    except RuntimeError as exc:
        _last_poll_error = str(exc)
        logger.warning("Aircraft poll failed: %s", exc)
        return

    _last_poll_error = None
    _last_polled_at = datetime.now().isoformat()
    logger.info("Aircraft poll succeeded via %s", provider_name)

    now = datetime.now()
    renotify_cutoff = now - timedelta(minutes=RENOTIFY_AFTER_MINUTES)

    with closing(_get_db()) as conn:
        conn.execute("DELETE FROM sightings_cache")

        seen_hexes = set()
        for ac in aircraft_list:
            hex_code = ac.get("hex")
            if not hex_code:
                continue
            if not isinstance(ac.get("alt_baro"), (int, float)):
                ac["alt_baro"] = None
            seen_hexes.add(hex_code.upper())

            distance_nm = ac.get("dst")
            bearing_deg = ac.get("dir")
            closing_speed_kt, eta_minutes = _compute_eta_minutes(
                distance_nm, bearing_deg, ac.get("track"), ac.get("gs")
            )
            miss_distance_nm = _compute_miss_distance_nm(
                distance_nm, bearing_deg, ac.get("track"), closing_speed_kt
            )
            in_geofence = eta_minutes is not None and eta_minutes <= target_warning_minutes
            if in_geofence and max_miss_distance_nm > 0:
                in_geofence = (
                    miss_distance_nm is not None and miss_distance_nm <= max_miss_distance_nm
                )

            confirmed_inbound = _is_confirmed_inbound(
                conn, hex_code.upper(), distance_nm, in_geofence
            )
            match = _match_watchlist(ac, watchlist) if confirmed_inbound else None

            conn.execute(
                "INSERT INTO sighting_history (hex, distance_nm, in_geofence, polled_at) "
                "VALUES (?, ?, ?, ?)",
                (hex_code.upper(), distance_nm, int(in_geofence), now.isoformat()),
            )

            conn.execute(
                """
                INSERT INTO sightings_cache
                    (hex, flight, registration, model, desc, lat, lon, alt_baro,
                     ground_speed, track, distance_nm, bearing_deg, closing_speed_kt,
                     eta_minutes, miss_distance_nm, in_geofence, matched_watchlist_id,
                     matched_label, seen_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    hex_code.upper(),
                    (ac.get("flight") or "").strip() or None,
                    ac.get("r"),
                    ac.get("t"),
                    ac.get("desc"),
                    ac.get("lat"),
                    ac.get("lon"),
                    ac.get("alt_baro") if isinstance(ac.get("alt_baro"), (int, float)) else None,
                    ac.get("gs"),
                    ac.get("track"),
                    distance_nm,
                    bearing_deg,
                    closing_speed_kt,
                    eta_minutes,
                    miss_distance_nm,
                    int(in_geofence),
                    match["id"] if match else None,
                    match["label"] if match else None,
                    now.isoformat(),
                ),
            )

            if match:
                logged = conn.execute(
                    "SELECT notified_at FROM notified_log WHERE hex = ? AND watchlist_id = ?",
                    (hex_code.upper(), match["id"]),
                ).fetchone()
                already_notified_recently = (
                    logged and datetime.fromisoformat(logged["notified_at"]) > renotify_cutoff
                )

                if not already_notified_recently and profile["ntfy_topic"]:
                    _notify_ntfy(
                        settings["ntfy_base_url"],
                        profile["ntfy_topic"],
                        ac,
                        match["label"],
                        eta_minutes,
                        miss_distance_nm,
                    )
                    conn.execute(
                        """
                        INSERT INTO notified_log (hex, watchlist_id, notified_at)
                        VALUES (?, ?, ?)
                        ON CONFLICT(hex, watchlist_id)
                        DO UPDATE SET notified_at = excluded.notified_at
                        """,
                        (hex_code.upper(), match["id"], now.isoformat()),
                    )

        # Clear notified_log entries for aircraft no longer in view, so a
        # later re-entry alerts again rather than staying suppressed forever.
        stale = conn.execute("SELECT DISTINCT hex FROM notified_log").fetchall()
        for row in stale:
            if row["hex"] not in seen_hexes:
                conn.execute("DELETE FROM notified_log WHERE hex = ?", (row["hex"],))

        # Bound sighting_history growth - only the recent window is needed to
        # confirm inbound tracking across consecutive polls.
        history_cutoff = now - timedelta(minutes=SIGHTING_HISTORY_RETENTION_MINUTES)
        conn.execute(
            "DELETE FROM sighting_history WHERE polled_at < ?", (history_cutoff.isoformat(),)
        )

        conn.commit()


def _scheduler_loop() -> None:
    while not _scheduler_stop.is_set():
        try:
            _poll_once()
        except Exception:
            logger.exception("Unhandled error in plane-tracker poll loop")

        interval = max(get_settings()["poll_interval_seconds"], MIN_POLL_INTERVAL_SECONDS)
        _scheduler_stop.wait(interval)


def _start_scheduler() -> None:
    global _scheduler_thread
    if _scheduler_thread is not None:
        return
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_thread.start()

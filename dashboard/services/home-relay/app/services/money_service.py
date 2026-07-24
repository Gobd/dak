"""Money/spend-tracking service: SimpleFIN sync, transfer detection, budget math.

Tracks spend across linked SimpleFIN accounts (MACU, Chase) against a monthly
budget, computing a linear "ghost" pace so the dashboard widget can show
whether spend is ahead of or behind where it should be for the day of month.

Note on data freshness: SimpleFIN Bridge itself only refreshes from the bank
roughly once every 24h, and transactions can take a few days to appear after
they actually post. This is normal for personal-use bank aggregators (Plaid
behaves the same way at this tier) -- polling more often than a few hours
just re-fetches unchanged data.
"""

import base64
import json
import logging
import sqlite3
import threading
from calendar import monthrange
from contextlib import closing
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx

from app.services import notification_service

logger = logging.getLogger(__name__)

DB_PATH = Path.home() / ".config" / "home-relay" / "money.db"

SYNC_INTERVAL_SECONDS = 4 * 60 * 60  # 4 hours
MIN_MANUAL_SYNC_INTERVAL_SECONDS = 2 * 60 * 60  # 2 hours — rate-limit "Sync now"
TRANSACTION_LOOKBACK_DAYS = 60
TRANSFER_PAIR_WINDOW_DAYS = 3
TRANSFER_PAIR_AMOUNT_TOLERANCE = 0.01

_scheduler_thread: threading.Thread | None = None
_scheduler_stop = threading.Event()

# In-memory cache for linked_accounts to avoid a live SimpleFIN call on every summary read.
_linked_accounts_cache: list[dict] = []
_linked_accounts_cache_time: datetime | None = None
_LINKED_ACCOUNTS_CACHE_TTL = timedelta(hours=4)


def init() -> None:
    """Initialize the money service DB and start the background sync scheduler."""
    _init_db()
    _start_scheduler()
    logger.info("Money service initialized")


def _get_db() -> sqlite3.Connection:
    """Get a database connection."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    """Initialize database tables."""
    with closing(_get_db()) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS link (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                access_url TEXT NOT NULL,
                linked_account_ids TEXT NOT NULL,
                linked_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_synced_at TEXT,
                last_sync_error TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                default_monthly_budget REAL NOT NULL DEFAULT 0,
                paycheck_strings TEXT NOT NULL DEFAULT '[]',
                large_deposit_threshold REAL,
                transfer_keywords TEXT NOT NULL DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS monthly_overrides (
                month TEXT PRIMARY KEY,
                budget REAL NOT NULL,
                set_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions_cache (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                account_name TEXT NOT NULL,
                posted TEXT NOT NULL,
                amount REAL NOT NULL,
                description TEXT NOT NULL,
                payee TEXT NOT NULL,
                pending INTEGER NOT NULL DEFAULT 0,
                excluded INTEGER NOT NULL DEFAULT 0,
                exclude_reason TEXT,
                is_paycheck INTEGER NOT NULL DEFAULT 0,
                notified INTEGER NOT NULL DEFAULT 0,
                manual_override INTEGER NOT NULL DEFAULT 0,
                synced_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_transactions_posted
                ON transactions_cache (posted);

            INSERT OR IGNORE INTO settings (id, default_monthly_budget) VALUES (1, 0);
        """)
        conn.commit()

        existing_columns = {row["name"] for row in conn.execute("PRAGMA table_info(link)")}
        if "last_sync_error" not in existing_columns:
            conn.execute("ALTER TABLE link ADD COLUMN last_sync_error TEXT")
            conn.commit()


# === SimpleFIN link ===


def claim_access_url(setup_token: str) -> str:
    """Decode a SimpleFIN setup token and claim a permanent access URL."""
    try:
        claim_url = base64.b64decode(setup_token).decode("utf-8")
    except Exception as exc:
        raise ValueError("Invalid setup token") from exc

    response = httpx.post(claim_url, timeout=15)
    if response.status_code != 200:
        raise ValueError(f"Failed to claim SimpleFIN access URL: {response.status_code}")

    access_url = response.text.strip()
    if not access_url.startswith("http"):
        raise ValueError("Unexpected response claiming SimpleFIN access URL")

    return access_url


def _fetch_accounts(access_url: str, start_date: datetime | None = None) -> list[dict]:
    """Fetch accounts + transactions from the SimpleFIN access URL."""
    params = {}
    if start_date:
        params["start-date"] = int(start_date.timestamp())

    response = httpx.get(f"{access_url}/accounts", params=params, timeout=30)
    response.raise_for_status()
    return response.json().get("accounts", [])


def link_accounts(setup_token: str) -> list[dict]:
    """Claim an access URL from a setup token, discover accounts, and store the link."""
    access_url = claim_access_url(setup_token)
    accounts = _fetch_accounts(access_url, start_date=datetime.now() - timedelta(days=1))

    account_ids = [a["id"] for a in accounts]

    with closing(_get_db()) as conn:
        conn.execute(
            """
            INSERT INTO link (id, access_url, linked_account_ids)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                access_url = excluded.access_url,
                linked_account_ids = excluded.linked_account_ids
            """,
            (access_url, json.dumps(account_ids)),
        )
        conn.commit()

    try:
        sync_transactions()
    except Exception:
        logger.exception("Initial money sync after link failed")

    return [
        {
            "id": a["id"],
            "name": a["name"],
            "org_name": a.get("org", {}).get("name", "Unknown"),
            "currency": a.get("currency", "USD"),
        }
        for a in accounts
    ]


def unlink() -> dict:
    """Remove the SimpleFIN link and all cached transactions."""
    with closing(_get_db()) as conn:
        conn.execute("DELETE FROM link WHERE id = 1")
        conn.execute("DELETE FROM transactions_cache")
        conn.commit()
    return {"success": True}


def _get_link() -> sqlite3.Row | None:
    with closing(_get_db()) as conn:
        return conn.execute("SELECT * FROM link WHERE id = 1").fetchone()


def get_linked_accounts(force_refresh: bool = False) -> list[dict]:
    """Get info about currently linked accounts (names only, no credentials).

    Results are cached in memory for 4 hours to avoid a live SimpleFIN call on
    every summary read. Falls back to the SQLite transaction cache on error.
    Pass force_refresh=True (e.g. after a sync) to bypass the in-memory cache.
    """
    global _linked_accounts_cache, _linked_accounts_cache_time

    link = _get_link()
    if not link:
        return []

    now = datetime.now()
    cache_valid = (
        not force_refresh
        and _linked_accounts_cache_time is not None
        and now - _linked_accounts_cache_time < _LINKED_ACCOUNTS_CACHE_TTL
    )
    if cache_valid and _linked_accounts_cache:
        return _linked_accounts_cache

    with closing(_get_db()) as conn:
        last_posted_by_account = {
            row["account_id"]: row["last_posted"]
            for row in conn.execute(
                "SELECT account_id, MAX(posted) AS last_posted "
                "FROM transactions_cache GROUP BY account_id"
            ).fetchall()
        }

    try:
        accounts = _fetch_accounts(
            link["access_url"], start_date=datetime.now() - timedelta(days=1)
        )
    except Exception:
        logger.exception("Failed to fetch live account info, falling back to cache")
        with closing(_get_db()) as conn:
            cached_accounts = conn.execute(
                "SELECT DISTINCT account_id, account_name FROM transactions_cache"
            ).fetchall()
        return [
            {
                "id": row["account_id"],
                "name": row["account_name"],
                "org_name": "Unknown",
                "currency": "USD",
                "last_transaction_posted": last_posted_by_account.get(row["account_id"]),
            }
            for row in cached_accounts
        ]

    result = [
        {
            "id": a["id"],
            "name": a["name"],
            "org_name": a.get("org", {}).get("name", "Unknown"),
            "currency": a.get("currency", "USD"),
            "last_transaction_posted": last_posted_by_account.get(a["id"]),
        }
        for a in accounts
    ]
    _linked_accounts_cache = result
    _linked_accounts_cache_time = now
    return result


# === Settings ===


def _get_settings() -> sqlite3.Row:
    with closing(_get_db()) as conn:
        row = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        if row:
            return row
        conn.execute("INSERT INTO settings (id) VALUES (1)")
        conn.commit()
        return conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()


def set_default_budget(amount: float) -> dict:
    """Set the default monthly budget."""
    with closing(_get_db()) as conn:
        conn.execute("UPDATE settings SET default_monthly_budget = ? WHERE id = 1", (amount,))
        conn.commit()
    return {"success": True}


def set_monthly_override(month: str, budget: float) -> dict:
    """Set a one-off budget override for a specific month (YYYY-MM)."""
    with closing(_get_db()) as conn:
        conn.execute(
            """
            INSERT INTO monthly_overrides (month, budget)
            VALUES (?, ?)
            ON CONFLICT(month) DO UPDATE SET budget = excluded.budget
            """,
            (month, budget),
        )
        conn.commit()
    return {"success": True}


def clear_monthly_override(month: str) -> dict:
    """Clear a budget override for a specific month, reverting to the default."""
    with closing(_get_db()) as conn:
        conn.execute("DELETE FROM monthly_overrides WHERE month = ?", (month,))
        conn.commit()
    return {"success": True}


def _get_override_for_month(month: str) -> float | None:
    with closing(_get_db()) as conn:
        row = conn.execute(
            "SELECT budget FROM monthly_overrides WHERE month = ?", (month,)
        ).fetchone()
        return row["budget"] if row else None


def set_deposit_settings(
    paycheck_strings: list[str], large_deposit_threshold: float | None
) -> dict:
    """Configure paycheck-matching strings and the large-deposit alert threshold.

    large_deposit_threshold=None disables large-deposit notifications entirely.
    A threshold of 0 is a valid, distinct value ("notify on any deposit").
    """
    with closing(_get_db()) as conn:
        conn.execute(
            "UPDATE settings SET paycheck_strings = ?, large_deposit_threshold = ? WHERE id = 1",
            (json.dumps(paycheck_strings), large_deposit_threshold),
        )
        conn.commit()
    return {"success": True}


def set_transfer_keywords(transfer_keywords: list[str]) -> dict:
    """Configure transfer/payment keyword matching."""
    with closing(_get_db()) as conn:
        conn.execute(
            "UPDATE settings SET transfer_keywords = ? WHERE id = 1",
            (json.dumps(transfer_keywords),),
        )
        conn.commit()
    return {"success": True}


def get_settings() -> dict:
    """Get current settings, for populating the widget's settings modal."""
    settings = _get_settings()
    current_month = date.today().strftime("%Y-%m")
    return {
        "default_monthly_budget": settings["default_monthly_budget"],
        "current_month_override": _get_override_for_month(current_month),
        "paycheck_strings": json.loads(settings["paycheck_strings"]),
        "large_deposit_threshold": settings["large_deposit_threshold"],
        "transfer_keywords": json.loads(settings["transfer_keywords"]),
        "linked_accounts": get_linked_accounts(),
    }


# === Transaction sync ===


def _upsert_transactions(accounts: list[dict]) -> list[dict]:
    """Upsert transactions from SimpleFIN accounts, returning the newly-inserted rows."""
    new_rows = []
    with closing(_get_db()) as conn:
        for account in accounts:
            for txn in account.get("transactions", []):
                existing = conn.execute(
                    "SELECT id, posted FROM transactions_cache WHERE id = ?", (txn["id"],)
                ).fetchone()
                if existing:
                    if not existing["posted"]:
                        posted = datetime.fromtimestamp(txn["posted"]).isoformat()
                        conn.execute(
                            "UPDATE transactions_cache SET posted = ? WHERE id = ?",
                            (posted, txn["id"]),
                        )
                    continue

                posted = datetime.fromtimestamp(txn["posted"]).isoformat()
                amount = float(txn["amount"])
                row = {
                    "id": txn["id"],
                    "account_id": account["id"],
                    "account_name": account["name"],
                    "posted": posted,
                    "amount": amount,
                    "description": txn.get("description", ""),
                    "payee": txn.get("payee", ""),
                    "pending": bool(txn.get("pending", False)),
                }
                conn.execute(
                    """
                    INSERT INTO transactions_cache
                        (id, account_id, account_name, posted, amount, description, payee, pending)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row["id"],
                        row["account_id"],
                        row["account_name"],
                        row["posted"],
                        row["amount"],
                        row["description"],
                        row["payee"],
                        int(row["pending"]),
                    ),
                )
                new_rows.append(row)
        conn.commit()
    return new_rows


def _mark_excluded(conn: sqlite3.Connection, txn_id: str, reason: str) -> None:
    conn.execute(
        "UPDATE transactions_cache SET excluded = 1, exclude_reason = ? WHERE id = ?",
        (reason, txn_id),
    )


def _detect_transfers(new_rows: list[dict]) -> None:
    """Mark transfer/payment transactions as excluded using two heuristics.

    1. Amount/date pairing: opposite-signed transactions across the linked
       accounts matching |amount| within a small tolerance, posted within a
       few days of each other.
    2. Keyword match: description/payee matches a configured transfer keyword
       (catches payments that don't pair cleanly by amount, e.g. paying more
       or less than the statement balance).
    """
    settings = _get_settings()
    transfer_keywords = [k.lower() for k in json.loads(settings["transfer_keywords"]) if k]

    with closing(_get_db()) as conn:
        for row in new_rows:
            text = f"{row['description']} {row['payee']}".lower()
            if any(kw in text for kw in transfer_keywords):
                _mark_excluded(conn, row["id"], "transfer_keyword")
        conn.commit()

        # Amount/date pairing across all recently-synced, still-included transactions.
        candidates = conn.execute(
            """
            SELECT id, account_id, posted, amount FROM transactions_cache
            WHERE excluded = 0
              AND posted >= ?
            """,
            ((datetime.now() - timedelta(days=TRANSACTION_LOOKBACK_DAYS)).isoformat(),),
        ).fetchall()

        paired: set[str] = set()
        for a in candidates:
            if a["id"] in paired:
                continue
            for b in candidates:
                if (
                    a["id"] == b["id"]
                    or b["id"] in paired
                    or a["account_id"] == b["account_id"]
                    or (a["amount"] > 0) == (b["amount"] > 0)
                ):
                    continue
                if abs(abs(a["amount"]) - abs(b["amount"])) > TRANSFER_PAIR_AMOUNT_TOLERANCE:
                    continue
                a_date = datetime.fromisoformat(a["posted"])
                b_date = datetime.fromisoformat(b["posted"])
                if abs((a_date - b_date).days) > TRANSFER_PAIR_WINDOW_DAYS:
                    continue

                _mark_excluded(conn, a["id"], "transfer_pair")
                _mark_excluded(conn, b["id"], "transfer_pair")
                paired.add(a["id"])
                paired.add(b["id"])
                break
        conn.commit()


def _detect_deposits(new_rows: list[dict]) -> None:
    """Flag paycheck deposits, and notify about unexpectedly large ones."""
    settings = _get_settings()
    paycheck_strings = [s.lower() for s in json.loads(settings["paycheck_strings"]) if s]
    threshold = settings["large_deposit_threshold"]

    with closing(_get_db()) as conn:
        for row in new_rows:
            if row["amount"] <= 0:
                continue

            current = conn.execute(
                "SELECT excluded FROM transactions_cache WHERE id = ?", (row["id"],)
            ).fetchone()
            if current and current["excluded"]:
                continue

            text = f"{row['description']} {row['payee']}".lower()
            is_paycheck = any(s in text for s in paycheck_strings)

            if is_paycheck:
                conn.execute(
                    "UPDATE transactions_cache SET is_paycheck = 1 WHERE id = ?", (row["id"],)
                )
                continue

            if threshold is not None and row["amount"] >= threshold:
                notification_service.add_event(
                    event_type="money",
                    name=f"Unexpected deposit: {row['description'] or row['payee']}",
                    due_date=date.today().isoformat(),
                    data={"amount": row["amount"], "account": row["account_name"]},
                )
                conn.execute(
                    "UPDATE transactions_cache SET notified = 1 WHERE id = ?", (row["id"],)
                )
        conn.commit()


def sync_transactions(force: bool = False) -> dict:
    """Fetch latest transactions from SimpleFIN and run detection on new rows.

    Enforces a minimum interval between manual syncs (MIN_MANUAL_SYNC_INTERVAL_SECONDS)
    to prevent hammering the SimpleFIN API. Pass force=True to bypass (used internally
    by the scheduler, which already manages its own interval).
    """
    link = _get_link()
    if not link:
        return {"success": False, "error": "No linked accounts"}

    if not force and link["last_synced_at"]:
        last_synced = datetime.fromisoformat(link["last_synced_at"])
        seconds_since = (datetime.now() - last_synced).total_seconds()
        if seconds_since < MIN_MANUAL_SYNC_INTERVAL_SECONDS:
            wait_mins = int((MIN_MANUAL_SYNC_INTERVAL_SECONDS - seconds_since) / 60)
            return {
                "success": False,
                "error": f"Synced recently. Next sync available in ~{wait_mins} min.",
                "rate_limited": True,
            }

    try:
        start_date = datetime.now() - timedelta(days=TRANSACTION_LOOKBACK_DAYS)
        accounts = _fetch_accounts(link["access_url"], start_date=start_date)
        new_rows = _upsert_transactions(accounts)

        if new_rows:
            _detect_transfers(new_rows)
            _detect_deposits(new_rows)
    except Exception as exc:
        logger.exception("Money sync failed")
        with closing(_get_db()) as conn:
            conn.execute("UPDATE link SET last_sync_error = ? WHERE id = 1", (str(exc),))
            conn.commit()
        return {"success": False, "error": str(exc)}

    with closing(_get_db()) as conn:
        conn.execute(
            "UPDATE link SET last_synced_at = ?, last_sync_error = NULL WHERE id = 1",
            (datetime.now().isoformat(),),
        )
        conn.commit()

    # Bust the linked-accounts cache so the next summary read reflects fresh data.
    get_linked_accounts(force_refresh=True)

    return {"success": True, "new_transactions": len(new_rows)}


# === Spend summary ===


def get_spend_summary(month: str | None = None) -> dict:
    """Compute spend vs. ghost pace vs. effective budget for a given month.

    month: "YYYY-MM" string. Defaults to the current calendar month.
    For past months, day_of_month equals days_in_month and ghost_to_date equals
    the full budget (i.e. the month is complete).
    """
    settings = _get_settings()
    today = date.today()

    if month:
        try:
            year, mon = int(month[:4]), int(month[5:7])
            month_date = date(year, mon, 1)
        except (ValueError, IndexError):
            month_date = today.replace(day=1)
    else:
        month_date = today.replace(day=1)

    month_str = month_date.strftime("%Y-%m")
    days_in_month = monthrange(month_date.year, month_date.month)[1]
    is_current_month = month_date.year == today.year and month_date.month == today.month
    day_of_month = today.day if is_current_month else days_in_month

    override = _get_override_for_month(month_str)
    monthly_budget = override if override is not None else settings["default_monthly_budget"]

    with closing(_get_db()) as conn:
        row = conn.execute(
            """
            SELECT COALESCE(SUM(-amount), 0) as spent
            FROM transactions_cache
            WHERE amount < 0 AND excluded = 0
              AND posted >= ? AND posted < ?
            """,
            (
                month_date.isoformat(),
                date(
                    month_date.year + (1 if month_date.month == 12 else 0),
                    1 if month_date.month == 12 else month_date.month + 1,
                    1,
                ).isoformat(),
            ),
        ).fetchone()
        spent_to_date = row["spent"]

        link = conn.execute(
            "SELECT last_synced_at, last_sync_error FROM link WHERE id = 1"
        ).fetchone()
        last_synced_at = link["last_synced_at"] if link else None
        last_sync_error = link["last_sync_error"] if link else None

    ghost_to_date = monthly_budget * (day_of_month / days_in_month)
    projected_month_total = (spent_to_date / day_of_month) * days_in_month if day_of_month else 0

    return {
        "monthly_budget": monthly_budget,
        "is_override": override is not None,
        "month_start": month_date.isoformat(),
        "month_str": month_str,
        "days_in_month": days_in_month,
        "day_of_month": day_of_month,
        "is_current_month": is_current_month,
        "spent_to_date": spent_to_date,
        "ghost_to_date": ghost_to_date,
        "projected_month_total": projected_month_total,
        "linked_accounts": get_linked_accounts() if _get_link() else [],
        "last_synced_at": last_synced_at,
        "last_sync_error": last_sync_error,
    }


def get_recent_transactions(limit: int = 50) -> list[dict]:
    """Get recent cached transactions, most recent first."""
    with closing(_get_db()) as conn:
        rows = conn.execute(
            """
            SELECT * FROM transactions_cache
            ORDER BY posted DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [
        {
            "id": r["id"],
            "account_name": r["account_name"],
            "posted": r["posted"],
            "amount": r["amount"],
            "description": r["description"],
            "payee": r["payee"],
            "excluded": bool(r["excluded"]),
            "exclude_reason": r["exclude_reason"],
            "is_paycheck": bool(r["is_paycheck"]),
        }
        for r in rows
    ]


def set_transaction_excluded(txn_id: str, excluded: bool, reason: str | None = None) -> dict:
    """Manually override a transaction's excluded state."""
    with closing(_get_db()) as conn:
        conn.execute(
            """
            UPDATE transactions_cache
            SET excluded = ?, exclude_reason = ?, manual_override = 1
            WHERE id = ?
            """,
            (int(excluded), reason or ("manual" if excluded else None), txn_id),
        )
        conn.commit()
    return {"success": True}


# === Scheduler ===


def _scheduler_loop() -> None:
    """Background scheduler: sync transactions periodically."""
    while not _scheduler_stop.is_set():
        try:
            if _get_link():
                sync_transactions(force=True)
        except Exception:
            logger.exception("Money sync error")
        _scheduler_stop.wait(SYNC_INTERVAL_SECONDS)


def _start_scheduler() -> None:
    """Start the background sync scheduler thread."""
    global _scheduler_thread
    if _scheduler_thread and _scheduler_thread.is_alive():
        return
    _scheduler_stop.clear()
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_thread.start()
    logger.info("Money sync scheduler started")

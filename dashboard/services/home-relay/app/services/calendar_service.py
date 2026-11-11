"""One bounded in-memory snapshot, replaced atomically. No DB, history, or tokens."""

import asyncio
import threading
from datetime import UTC, date, datetime, timedelta

from app.models.calendar import CalendarFeedEvent, CalendarSnapshotRequest, CalendarSnapshotResponse

RETENTION = timedelta(hours=24)
STALE_AFTER = timedelta(minutes=15)


class CalendarCache:
    def __init__(self):
        self._lock = threading.Lock()
        self._snapshot: CalendarSnapshotRequest | None = None
        self._updated_at: datetime | None = None

    @staticmethod
    def _still_relevant(event: CalendarFeedEvent, now: datetime) -> bool:
        # All-day dates are floating local dates. Allow the slowest timezone to finish.
        if event.all_day:
            return date.fromisoformat(event.end) >= (now - timedelta(days=1)).date()
        return datetime.fromisoformat(event.end.replace("Z", "+00:00")) > now - timedelta(days=1)

    def replace(self, snapshot: CalendarSnapshotRequest, now: datetime | None = None) -> None:
        now = now or datetime.now(UTC)
        # Retain today's completed events too, for the clock's optional daily agenda.
        events = [event for event in snapshot.events if self._still_relevant(event, now)]
        with self._lock:
            self._snapshot = snapshot.model_copy(update={"events": events})
            self._updated_at = now

    def read(self, now: datetime | None = None) -> CalendarSnapshotResponse:
        now = now or datetime.now(UTC)
        with self._lock:
            if self._updated_at and now - self._updated_at >= RETENTION:
                self._snapshot = None
                self._updated_at = None
            snapshot = self._snapshot
            updated = self._updated_at
            if not snapshot or not updated:
                return CalendarSnapshotResponse(
                    updated_at=None,
                    expires_at=None,
                    window_start=None,
                    window_end=None,
                    stale=True,
                    events=[],
                    calendars=[],
                )
            # Expired events are physically discarded, even without a new publisher snapshot.
            snapshot.events = [
                event for event in snapshot.events if self._still_relevant(event, now)
            ]
            return CalendarSnapshotResponse(
                updated_at=updated,
                expires_at=updated + RETENTION,
                window_start=snapshot.window_start,
                window_end=snapshot.window_end,
                stale=now - updated > STALE_AFTER,
                events=list(snapshot.events),
                calendars=list(snapshot.calendars),
            )


cache = CalendarCache()


async def cleanup_loop() -> None:
    """Prune once per minute even when nobody reads the feed."""
    while True:
        await asyncio.sleep(60)
        cache.read()

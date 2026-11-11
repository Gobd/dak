import os
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.models.calendar import CalendarFeedEvent, CalendarSnapshotRequest
from app.routers import calendar
from app.services.calendar_service import CalendarCache

# The relay uses the stdlib unittest runner; pytest is not a project dependency.
# ruff: noqa: PT027


class CalendarFeedTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 10, 12, tzinfo=UTC)
        self.cache = CalendarCache()

    def event(self, **changes):
        data = {
            "id": "one",
            "calendar_id": "family",
            "calendar_name": "Family",
            "title": "Lunch",
            "start": "2026-11-10T12:00:00Z",
            "end": "2026-11-10T13:00:00Z",
            "all_day": False,
        }
        return CalendarFeedEvent.model_validate({**data, **changes})

    def snapshot(self, events):
        return CalendarSnapshotRequest(
            window_start=self.now - timedelta(days=2),
            window_end=self.now + timedelta(days=2),
            events=events,
        )

    def test_replacement_does_not_accumulate_history(self):
        for index in range(100):
            self.cache.replace(self.snapshot([self.event(id=str(index))]), self.now)
        feed = self.cache.read(self.now)
        assert [event.id for event in feed.events] == ["99"]
        self.cache.replace(self.snapshot([]), self.now)
        assert self.cache.read(self.now).events == []

    def test_staleness_expiry_and_old_event_pruning(self):
        self.cache.replace(
            self.snapshot(
                [
                    self.event(),
                    self.event(id="old", start="2026-11-08T12:00:00Z", end="2026-11-08T13:00:00Z"),
                ]
            ),
            self.now,
        )
        assert len(self.cache.read(self.now).events) == 1
        assert self.cache.read(self.now + timedelta(minutes=16)).stale
        expired = self.cache.read(self.now + timedelta(hours=24))
        assert expired.events == []
        assert expired.updated_at is None

    def test_today_completed_events_remain_in_daily_agenda(self):
        self.cache.replace(self.snapshot([self.event()]), self.now)
        assert len(self.cache.read(self.now + timedelta(hours=5)).events) == 1

    def test_strict_dates_offsets_lengths_and_count(self):
        with self.assertRaises(ValidationError):
            self.event(start="2026-11-10T12:00:00")
        with self.assertRaises(ValidationError):
            self.event(end="2026-11-10T11:00:00Z")
        with self.assertRaises(ValidationError):
            self.event(title="x" * 161)
        with self.assertRaises(ValidationError):
            self.snapshot([self.event()] * 1001)
        event = self.event(start="2026-11-10", end="2026-11-11", all_day=True)
        assert event.all_day

    def test_read_is_keyless_but_publishing_requires_key_and_bounded_payload(self):
        app = FastAPI()
        app.include_router(calendar.router)
        with (
            patch.dict(os.environ, {"CALENDAR_PUBLISH_KEY": "writer"}),
            patch.object(calendar, "cache", self.cache),
        ):
            client = TestClient(app)
            assert client.get("/calendar/snapshot").status_code == 200
            assert client.put("/calendar/snapshot", json={}).status_code == 401
            assert (
                client.put(
                    "/calendar/snapshot", headers={"Authorization": "Bearer reader"}, json={}
                ).status_code
                == 401
            )
            current = datetime.now(UTC)
            payload = CalendarSnapshotRequest(
                window_start=current - timedelta(days=1),
                window_end=current + timedelta(days=2),
                events=[
                    self.event(
                        start=current.isoformat(), end=(current + timedelta(hours=1)).isoformat()
                    )
                ],
            ).model_dump(mode="json")
            published = client.put(
                "/calendar/snapshot", headers={"Authorization": "Bearer writer"}, json=payload
            )
            assert published.status_code == 200
            response = client.get("/calendar/snapshot")
            assert response.status_code == 200
            assert response.headers["cache-control"] == "no-store"
            assert len(response.json()["events"]) == 1
            assert (
                client.put(
                    "/calendar/snapshot",
                    headers={"Authorization": "Bearer writer"},
                    content=b"x" * (calendar.MAX_BODY_BYTES + 1),
                ).status_code
                == 413
            )
            assert (
                client.put(
                    "/calendar/snapshot", headers={"Authorization": "Bearer writer"}, json={}
                ).status_code
                == 422
            )
        with patch.dict(os.environ, {"CALENDAR_PUBLISH_KEY": ""}):
            assert TestClient(app).put("/calendar/snapshot", json={}).status_code == 503

    def test_reads_ignore_legacy_read_key_and_never_change_snapshot(self):
        app = FastAPI()
        app.include_router(calendar.router)
        with (
            patch.dict(os.environ, {"CALENDAR_READ_KEY": "obsolete-key"}),
            patch.object(calendar, "cache", self.cache),
        ):
            client = TestClient(app)
            for headers in [{}, {"Authorization": "Bearer invalid-old-key"}]:
                response = client.get("/calendar/snapshot", headers=headers)
                assert response.status_code == 200
                assert response.headers["cache-control"] == "no-store"
                assert response.json()["events"] == []
            assert self.cache.read().updated_at is None

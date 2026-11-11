"""Bounded, read-only calendar feed models. No Google tokens are accepted."""

from datetime import date, datetime, timedelta

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_EVENTS = 1000


class CalendarFeedEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=256)
    calendar_id: str = Field(min_length=1, max_length=256)
    calendar_name: str = Field(max_length=160)
    title: str = Field(max_length=160)
    start: str = Field(max_length=40)
    end: str = Field(max_length=40)
    all_day: bool
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")

    @model_validator(mode="after")
    def validate_range(self):
        if self.all_day:
            start = date.fromisoformat(self.start)
            end = date.fromisoformat(self.end)
            if self.start != start.isoformat() or self.end != end.isoformat():
                raise ValueError("All-day events need YYYY-MM-DD dates")
        else:
            start = datetime.fromisoformat(self.start.replace("Z", "+00:00"))
            end = datetime.fromisoformat(self.end.replace("Z", "+00:00"))
            if start.tzinfo is None or end.tzinfo is None:
                raise ValueError("Timed events need explicit timezone offsets")
        if end <= start:
            raise ValueError("Event end must be after start")
        return self


class CalendarFeedCalendar(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=256)
    name: str = Field(max_length=160)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class CalendarSnapshotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    window_start: datetime
    window_end: datetime
    events: list[CalendarFeedEvent] = Field(max_length=MAX_EVENTS)
    calendars: list[CalendarFeedCalendar] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_window(self):
        if self.window_start.tzinfo is None or self.window_end.tzinfo is None:
            raise ValueError("Snapshot window needs timezone offsets")
        duration = (self.window_end - self.window_start).total_seconds()
        if not 0 < duration <= 4 * 86400:
            raise ValueError("Snapshot window must be between zero and four days")
        for event in self.events:
            if event.all_day:
                # Floating all-day dates may differ from UTC by one calendar date.
                first = (self.window_start - timedelta(days=1)).date().isoformat()
                last = (self.window_end + timedelta(days=1)).date().isoformat()
                if event.start >= last or event.end <= first:
                    raise ValueError("All-day event must overlap the snapshot coverage window")
            else:
                start = datetime.fromisoformat(event.start.replace("Z", "+00:00"))
                end = datetime.fromisoformat(event.end.replace("Z", "+00:00"))
                if start >= self.window_end or end <= self.window_start:
                    raise ValueError("Event must overlap the snapshot coverage window")
        return self


class CalendarSnapshotResponse(BaseModel):
    updated_at: datetime | None
    expires_at: datetime | None
    window_start: datetime | None
    window_end: datetime | None
    stale: bool
    events: list[CalendarFeedEvent]
    calendars: list[CalendarFeedCalendar]

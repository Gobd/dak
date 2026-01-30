"""Pydantic models for notification endpoints."""

from typing import Any

from pydantic import BaseModel


class AddEventRequest(BaseModel):
    """Request to add/update a notification event."""

    type: str  # e.g., "shot", "maintenance", "medicine"
    name: str  # e.g., "Testosterone", "Change furnace filter"
    due: str  # ISO date string (YYYY-MM-DD or full ISO datetime)
    data: dict[str, Any] | None = None  # Optional extra data (person, dose, etc.)


class AddEventResponse(BaseModel):
    """Response from adding an event."""

    success: bool
    id: int


class NotificationEvent(BaseModel):
    """A notification event in the database."""

    id: int
    type: str
    name: str
    due_date: str
    data: dict[str, Any] | None
    created_at: str
    dismissed_until: str | None


class DueNotification(BaseModel):
    """A notification that's currently due/overdue."""

    id: int
    type: str
    name: str
    due_date: str
    data: dict[str, Any] | None
    is_overdue: bool
    is_today: bool
    is_tomorrow: bool


class DismissRequest(BaseModel):
    """Request to dismiss a notification."""

    hours: int | None = 4  # How many hours to dismiss for (ignored if permanent/until_midnight)
    permanent: bool = False  # If true, dismiss indefinitely (until due_date changes)
    until_midnight: bool = False  # If true, dismiss until midnight tonight


class DismissResponse(BaseModel):
    """Response from dismissing a notification."""

    success: bool
    dismissed_until: str | None = None  # None if permanently dismissed

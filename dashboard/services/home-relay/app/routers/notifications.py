"""Notification endpoints for persistent reminders from iframed apps."""

from fastapi import APIRouter

from app.models.notifications import (
    AddEventRequest,
    AddEventResponse,
    DismissRequest,
    DismissResponse,
    DueNotification,
    NotificationEvent,
)
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("", response_model=AddEventResponse)
async def add_event(request: AddEventRequest):
    """Add or update a notification event.

    Called by iframed apps (health-tracker, maintenance-tracker, etc.)
    to register upcoming due dates for the dashboard to track.
    """
    result = notification_service.add_event(
        event_type=request.type,
        name=request.name,
        due_date=request.due,
        data=request.data,
    )
    return result


@router.get("", response_model=list[NotificationEvent])
async def list_events():
    """List all notification events."""
    return notification_service.list_events()


@router.get("/due", response_model=list[DueNotification])
async def get_due():
    """Get currently due notifications (for initial load)."""
    return notification_service.get_due_notifications()


@router.delete("/{event_id}")
async def delete_event(event_id: int):
    """Delete a notification event."""
    return notification_service.delete_event(event_id)


@router.post("/{event_id}/dismiss", response_model=DismissResponse)
async def dismiss_event(event_id: int, request: DismissRequest | None = None):
    """Dismiss a notification for a specified number of hours, until midnight, or permanently."""
    if request and request.permanent:
        return notification_service.dismiss_event(event_id, permanent=True)
    if request and request.until_midnight:
        return notification_service.dismiss_event(event_id, until_midnight=True)
    hours = request.hours if request else 4
    return notification_service.dismiss_event(event_id, hours)


@router.post("/check")
async def trigger_check():
    """Manually trigger notification check (for testing)."""
    return notification_service.trigger_check()


@router.get("/preferences")
async def get_preferences():
    """Get notification type preferences (which types are enabled/disabled)."""
    return {
        "types": notification_service.get_type_preferences(),
        "unconfigured_count": notification_service.get_unconfigured_count(),
    }


@router.post("/preferences/{event_type}")
async def set_preference(event_type: str, enabled: bool = True):
    """Enable or disable notifications for a type."""
    return notification_service.set_type_enabled(event_type, enabled)

"""Private calendar snapshots; separate read and publish bearer keys, no OAuth here."""

import hmac
import os
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, Response

from app.models.calendar import CalendarSnapshotRequest, CalendarSnapshotResponse
from app.services.calendar_service import cache

router = APIRouter(prefix="/calendar", tags=["calendar"])
MAX_BODY_BYTES = 1024 * 1024
# The body is parsed manually to bound bytes before JSON allocation. Document its
# normal Pydantic schema so the shared TypeScript client still has a typed body.
SNAPSHOT_SCHEMA = CalendarSnapshotRequest.model_json_schema(
    ref_template="#/components/schemas/{model}"
)
SNAPSHOT_SCHEMA.pop("$defs", None)


def authorize(authorization: str | None, env_name: str) -> None:
    expected = os.environ.get(env_name, "")
    if not expected:
        raise HTTPException(status_code=503, detail=f"Calendar sharing disabled: set {env_name}")
    token = authorization.removeprefix("Bearer ") if authorization else ""
    if (
        not authorization
        or not authorization.startswith("Bearer ")
        or not hmac.compare_digest(token.encode(), expected.encode())
    ):
        raise HTTPException(status_code=401, detail="Invalid calendar key")


@router.put(
    "/snapshot",
    response_model=CalendarSnapshotResponse,
    operation_id="publishCalendarSnapshot",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": SNAPSHOT_SCHEMA}},
        }
    },
)
async def publish_snapshot(
    request: Request,
    response: Response,
    authorization: Annotated[str | None, Header()] = None,
):
    """Replace the single snapshot. Enforce authorization and size before parsing the body."""
    authorize(authorization, "CALENDAR_PUBLISH_KEY")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_BODY_BYTES:
            raise HTTPException(status_code=413, detail="Calendar snapshot exceeds 1 MiB")
    try:
        snapshot = CalendarSnapshotRequest.model_validate_json(data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid calendar snapshot") from exc
    cache.replace(snapshot)
    response.headers["Cache-Control"] = "no-store"
    return cache.read()


@router.get(
    "/snapshot", response_model=CalendarSnapshotResponse, operation_id="getCalendarSnapshot"
)
async def get_snapshot(
    response: Response,
    authorization: Annotated[str | None, Header()] = None,
):
    """Read calendar events only; this key cannot publish or access Google credentials."""
    authorize(authorization, "CALENDAR_READ_KEY")
    response.headers["Cache-Control"] = "no-store"
    return cache.read()

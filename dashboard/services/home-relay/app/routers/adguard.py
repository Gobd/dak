"""AdGuard Home proxy endpoints.

Proxies requests to AdGuard Home API to avoid CORS issues.
Credentials passed per-request (not stored server-side).
"""

import httpx
from fastapi import APIRouter, HTTPException

from app.models.adguard import AdGuardProtectionRequest, AdGuardRequest

router = APIRouter(prefix="/adguard", tags=["adguard"])


@router.post("/status")
async def get_status(request: AdGuardRequest):
    """Get AdGuard Home protection status."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{request.url.rstrip('/')}/control/status",
                auth=(request.username, request.password),
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Connection failed: {e}")


@router.post("/protection")
async def set_protection(request: AdGuardProtectionRequest):
    """Enable or disable AdGuard protection."""
    payload: dict = {"enabled": request.enabled}
    if not request.enabled and request.duration:
        payload["duration"] = request.duration

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{request.url.rstrip('/')}/control/protection",
                auth=(request.username, request.password),
                json=payload,
                timeout=10.0,
            )
            resp.raise_for_status()
            return {"success": True}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Connection failed: {e}")

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


@router.post("/version")
async def get_version(request: AdGuardRequest):
    """Check for AdGuard Home updates."""
    try:
        async with httpx.AsyncClient() as client:
            # Get current version from status endpoint
            status_resp = await client.get(
                f"{request.url.rstrip('/')}/control/status",
                auth=(request.username, request.password),
                timeout=10.0,
            )
            status_resp.raise_for_status()
            current_version = status_resp.json().get("version")

            # Get latest version info (must be GET, not POST)
            version_resp = await client.get(
                f"{request.url.rstrip('/')}/control/version.json",
                auth=(request.username, request.password),
                timeout=10.0,
            )
            version_resp.raise_for_status()
            version_data = version_resp.json()
            new_version = version_data.get("new_version")

            # Only show update available if versions differ
            update_available = bool(
                new_version and current_version and new_version != current_version
            )

            return {
                "current_version": current_version,
                "new_version": new_version,
                "update_available": update_available,
            }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Connection failed: {e}")

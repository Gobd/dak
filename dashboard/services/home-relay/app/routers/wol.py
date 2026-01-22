"""Wake-on-LAN endpoints."""

import subprocess

from fastapi import APIRouter, HTTPException, Query
from getmac import get_mac_address
from wakeonlan import send_magic_packet

from app.models.wol import (
    MacLookupErrorResponse,
    MacLookupResponse,
    PingResponse,
    WakeRequest,
    WakeResponse,
)

router = APIRouter(prefix="/wol", tags=["wol"])


@router.post("/wake", response_model=WakeResponse)
async def wake(req: WakeRequest):
    """Send Wake-on-LAN magic packet."""
    try:
        mac = req.mac.replace("-", ":").upper()
        send_magic_packet(mac)
        return WakeResponse(success=True, mac=mac)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ping", response_model=PingResponse)
async def ping(ip: str = Query(...)):
    """Check if a host is online via ping."""
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "1", ip],
            capture_output=True,
            timeout=3,
        )
        online = result.returncode == 0
        return PingResponse(ip=ip, online=online)
    except Exception:
        return PingResponse(ip=ip, online=False)


@router.get(
    "/mac",
    response_model=MacLookupResponse,
    responses={404: {"model": MacLookupErrorResponse}, 500: {"model": MacLookupErrorResponse}},
)
async def lookup_mac(ip: str = Query(...)):
    """Get MAC address for an IP via ARP table (device must be on same network)."""
    try:
        # Ping first to populate ARP cache
        subprocess.run(
            ["ping", "-c", "1", "-W", "1", ip],
            capture_output=True,
            timeout=3,
        )

        # Use getmac library (cross-platform)
        mac = get_mac_address(ip=ip)

        if mac and mac != "00:00:00:00:00:00":
            mac = mac.upper()
            return MacLookupResponse(ip=ip, mac=mac)
        raise HTTPException(status_code=404, detail="MAC not found in ARP table")

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timeout")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

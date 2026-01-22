"""Wake-on-LAN endpoints."""

import socket
import subprocess

from fastapi import APIRouter, HTTPException, Query
from getmac import get_mac_address
from wakeonlan import send_magic_packet


def resolve_host(host: str) -> str:
    """Resolve hostname to IP address. Returns the input if already an IP."""
    try:
        return socket.gethostbyname(host)
    except socket.gaierror:
        return host  # Return as-is, let downstream handle the error


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
        resolved_ip = resolve_host(ip)
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "1", resolved_ip],
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
    """Get MAC address for an IP/hostname via ARP table (device must be on same network)."""
    try:
        # Resolve hostname to IP if needed
        resolved_ip = resolve_host(ip)

        # Ping first to populate ARP cache
        subprocess.run(
            ["ping", "-c", "1", "-W", "1", resolved_ip],
            capture_output=True,
            timeout=3,
        )

        # Use getmac library (cross-platform)
        mac = get_mac_address(ip=resolved_ip)

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

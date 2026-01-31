"""System stats endpoint for CPU, memory, disk, and uptime."""

import time

import psutil
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["system"])

# Cache for stats (2-second TTL)
_cache: dict | None = None
_cache_time: float = 0
CACHE_TTL = 2.0


class DiskStats(BaseModel):
    path: str
    percent: float
    free_gb: float


class SystemStatsResponse(BaseModel):
    cpu_percent: float
    memory_percent: float
    memory_used_gb: float
    memory_total_gb: float
    disks: list[DiskStats]
    uptime_seconds: int


# Filesystem types to ignore
IGNORED_FSTYPES = frozenset(
    [
        "tmpfs",
        "squashfs",
        "devtmpfs",
        "overlay",
        "aufs",
        "proc",
        "sysfs",
        "devpts",
        "cgroup",
        "cgroup2",
        "securityfs",
        "pstore",
        "debugfs",
        "hugetlbfs",
        "mqueue",
        "fusectl",
        "configfs",
        "tracefs",
        "fuse.lxcfs",
    ]
)


def _get_stats() -> dict:
    """Gather system stats."""
    # CPU (non-blocking, 0 interval returns instant value)
    cpu = psutil.cpu_percent(interval=0)

    # Memory
    mem = psutil.virtual_memory()
    mem_used_gb = (mem.total - mem.available) / (1024**3)
    mem_total_gb = mem.total / (1024**3)

    # Disks (filter out virtual filesystems)
    disks = []
    for part in psutil.disk_partitions(all=False):
        if part.fstype in IGNORED_FSTYPES:
            continue
        # Skip pseudo-devices
        if part.device.startswith("/dev/loop"):
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append(
                DiskStats(
                    path=part.mountpoint,
                    percent=usage.percent,
                    free_gb=usage.free / (1024**3),
                )
            )
        except (PermissionError, OSError):
            # Skip inaccessible mounts
            continue

    # Uptime
    boot_time = psutil.boot_time()
    uptime = int(time.time() - boot_time)

    return {
        "cpu_percent": cpu,
        "memory_percent": mem.percent,
        "memory_used_gb": round(mem_used_gb, 1),
        "memory_total_gb": round(mem_total_gb, 1),
        "disks": disks,
        "uptime_seconds": uptime,
    }


@router.get("/system/stats")
async def get_system_stats() -> SystemStatsResponse:
    """Get current system stats (CPU, memory, disk, uptime)."""
    global _cache, _cache_time

    now = time.time()
    if _cache is None or (now - _cache_time) > CACHE_TTL:
        _cache = _get_stats()
        _cache_time = now

    return SystemStatsResponse(**_cache)

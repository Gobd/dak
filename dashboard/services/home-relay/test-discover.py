#!/usr/bin/env python3
"""Quick test for Kasa device discovery"""

import asyncio
from kasa import Discover

async def main():
    print("Discovering Kasa devices on network...")
    print("(This broadcasts on UDP port 9999, may take a few seconds)\n")

    devices = await Discover.discover(timeout=10)

    if not devices:
        print("No devices found!")
        print("\nTroubleshooting:")
        print("  - Make sure you're on the same network as your Kasa devices")
        print("  - Check that your firewall allows UDP port 9999")
        print("  - Try: sudo python test-discover.py (sometimes needs elevated permissions)")
        return

    print(f"Found {len(devices)} device(s):\n")
    for ip, dev in devices.items():
        await dev.update()
        status = "ON" if dev.is_on else "OFF"
        print(f"  {dev.alias}")
        print(f"    IP: {ip}")
        print(f"    Model: {dev.model}")
        print(f"    Status: {status}")
        print()

if __name__ == '__main__':
    asyncio.run(main())

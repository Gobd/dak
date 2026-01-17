#!/usr/bin/env python3
"""
Home Relay Service
Provides HTTP endpoints for Kasa smart devices and Wake-on-LAN
"""

import asyncio
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from kasa import Discover
from wakeonlan import send_magic_packet

app = Flask(__name__)
CORS(app)

# Cache for discovered devices (refreshed on each discover call)
_device_cache = {}


@app.route('/kasa/discover', methods=['GET'])
def kasa_discover():
    """Discover Kasa devices on the network"""
    try:
        devices = asyncio.run(_discover_devices())
        return jsonify(devices)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


async def _discover_devices():
    """Async device discovery"""
    global _device_cache
    devices = await Discover.discover()
    result = []

    for ip, dev in devices.items():
        await dev.update()
        _device_cache[ip] = dev
        result.append({
            'name': dev.alias,
            'ip': ip,
            'on': dev.is_on,
            'model': dev.model,
            'type': _get_device_type(dev)
        })

    return result


def _get_device_type(dev):
    """Get device type string"""
    if dev.is_plug:
        return 'plug'
    elif dev.is_bulb:
        return 'bulb'
    elif dev.is_strip:
        return 'strip'
    elif dev.is_dimmer:
        return 'dimmer'
    return 'unknown'


@app.route('/kasa/toggle', methods=['POST'])
def kasa_toggle():
    """Toggle a Kasa device on/off"""
    data = request.get_json() or {}
    ip = data.get('ip') or request.args.get('ip')

    if not ip:
        return jsonify({'error': 'ip required'}), 400

    try:
        result = asyncio.run(_toggle_device(ip))
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


async def _toggle_device(ip):
    """Async device toggle"""
    global _device_cache

    # Use cached device or discover fresh
    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        _device_cache[ip] = dev

    await dev.update()

    if dev.is_on:
        await dev.turn_off()
    else:
        await dev.turn_on()

    await dev.update()
    return {'ip': ip, 'on': dev.is_on, 'name': dev.alias}


@app.route('/kasa/status', methods=['GET'])
def kasa_status():
    """Get status of a specific device"""
    ip = request.args.get('ip')

    if not ip:
        return jsonify({'error': 'ip required'}), 400

    try:
        result = asyncio.run(_get_status(ip))
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


async def _get_status(ip):
    """Async get device status"""
    global _device_cache

    if ip in _device_cache:
        dev = _device_cache[ip]
    else:
        dev = await Discover.discover_single(ip)
        _device_cache[ip] = dev

    await dev.update()
    return {'ip': ip, 'on': dev.is_on, 'name': dev.alias}


@app.route('/wol/wake', methods=['POST'])
def wol_wake():
    """Send Wake-on-LAN magic packet"""
    data = request.get_json() or {}
    mac = data.get('mac')

    if not mac:
        return jsonify({'error': 'mac required'}), 400

    try:
        # Clean up MAC address format
        mac = mac.replace('-', ':').upper()
        send_magic_packet(mac)
        return jsonify({'success': True, 'mac': mac})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/wol/ping', methods=['GET'])
def wol_ping():
    """Check if a host is online via ping"""
    import subprocess
    ip = request.args.get('ip')

    if not ip:
        return jsonify({'error': 'ip required'}), 400

    try:
        # Single ping with 1 second timeout
        result = subprocess.run(
            ['ping', '-c', '1', '-W', '1', ip],
            capture_output=True,
            timeout=3
        )
        online = result.returncode == 0
        return jsonify({'ip': ip, 'online': online})
    except Exception:
        return jsonify({'ip': ip, 'online': False})


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5111, debug=False)

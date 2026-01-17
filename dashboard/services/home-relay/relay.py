#!/usr/bin/env python3
"""
Home Relay Service
Provides HTTP endpoints for Kasa smart devices, Wake-on-LAN, and brightness control
"""

import asyncio
import json
import os
import subprocess
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS
from kasa import Discover
from wakeonlan import send_magic_packet

app = Flask(__name__)
CORS(app)


@app.after_request
def add_private_network_header(response):
    """Add Private Network Access header for Chrome's security checks"""
    # Required for HTTPS sites to access localhost services
    response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response

# Config file paths
CONFIG_DIR = Path.home() / '.config' / 'home-relay'
BRIGHTNESS_CONFIG = CONFIG_DIR / 'brightness.json'

# Default brightness config
DEFAULT_BRIGHTNESS_CONFIG = {
    'enabled': False,
    'lat': None,
    'lon': None,
    'location': None,  # Display name
    'dayBrightness': 100,
    'nightBrightness': 1,
    'transitionMins': 60,
}

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
        try:
            await dev.update()
        except Exception:
            # Some devices have timezone issues (e.g., MST7MDT) - skip update
            pass
        _device_cache[ip] = dev
        result.append({
            'name': getattr(dev, 'alias', None) or ip,
            'ip': ip,
            'on': getattr(dev, 'is_on', None),
            'model': getattr(dev, 'model', 'unknown'),
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

    try:
        await dev.update()
    except Exception:
        pass  # Timezone parsing errors

    if dev.is_on:
        await dev.turn_off()
    else:
        await dev.turn_on()

    try:
        await dev.update()
    except Exception:
        pass
    return {'ip': ip, 'on': dev.is_on, 'name': getattr(dev, 'alias', ip)}


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

    try:
        await dev.update()
    except Exception:
        pass  # Timezone parsing errors
    return {'ip': ip, 'on': dev.is_on, 'name': getattr(dev, 'alias', ip)}


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


# === Brightness Control ===

def _load_brightness_config():
    """Load brightness config from file"""
    if BRIGHTNESS_CONFIG.exists():
        try:
            with open(BRIGHTNESS_CONFIG) as f:
                config = json.load(f)
                return {**DEFAULT_BRIGHTNESS_CONFIG, **config}
        except Exception:
            pass
    return DEFAULT_BRIGHTNESS_CONFIG.copy()


def _save_brightness_config(config):
    """Save brightness config to file"""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(BRIGHTNESS_CONFIG, 'w') as f:
        json.dump(config, f, indent=2)


@app.route('/brightness/config', methods=['GET'])
def brightness_get_config():
    """Get brightness configuration"""
    return jsonify(_load_brightness_config())


@app.route('/brightness/config', methods=['POST'])
def brightness_set_config():
    """Set brightness configuration"""
    data = request.get_json() or {}
    config = _load_brightness_config()

    # Update only provided fields
    for key in DEFAULT_BRIGHTNESS_CONFIG:
        if key in data:
            config[key] = data[key]

    _save_brightness_config(config)
    return jsonify(config)


@app.route('/brightness/set', methods=['POST'])
def brightness_set():
    """Manually set brightness level"""
    data = request.get_json() or {}
    level = data.get('level')

    if level is None:
        return jsonify({'error': 'level required'}), 400

    level = max(1, min(100, int(level)))

    try:
        result = subprocess.run(
            ['ddcutil', 'setvcp', '10', str(level), '--noverify'],
            capture_output=True,
            timeout=10
        )
        if result.returncode == 0:
            return jsonify({'success': True, 'level': level})
        return jsonify({'error': result.stderr.decode()}), 500
    except FileNotFoundError:
        return jsonify({'error': 'ddcutil not installed'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/brightness/status', methods=['GET'])
def brightness_status():
    """Get current brightness and sun times"""
    config = _load_brightness_config()
    result = {'config': config, 'current': None, 'sun': None}

    # Get current brightness
    try:
        proc = subprocess.run(
            ['ddcutil', 'getvcp', '10'],
            capture_output=True,
            timeout=10
        )
        if proc.returncode == 0:
            import re
            match = re.search(r'current value\s*=\s*(\d+)', proc.stdout.decode())
            if match:
                result['current'] = int(match.group(1))
    except Exception:
        pass

    return jsonify(result)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5111, debug=False)

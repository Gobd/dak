#!/usr/bin/env python3
"""
Home Relay Service
Provides HTTP endpoints for Kasa smart devices, Wake-on-LAN, and brightness control
"""

import asyncio
import json
import os
import subprocess
import queue
import threading
from pathlib import Path
from flask import Flask, jsonify, request, Response
from kasa import Discover
from wakeonlan import send_magic_packet

app = Flask(__name__)

# SSE subscribers - list of queues for connected clients
_sse_subscribers = []
_sse_lock = threading.Lock()


@app.after_request
def add_cors_headers(response):
    """Add CORS and Private Network Access headers"""
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response

# Config file paths
CONFIG_DIR = Path.home() / '.config' / 'home-relay'
DASHBOARD_CONFIG = CONFIG_DIR / 'dashboard.json'

# Default template location (from repo, deployed to ~/dashboard/)
DEFAULT_TEMPLATE = Path.home() / 'dashboard' / 'config' / 'dashboard.json'


def _get_default_config():
    """Load default config from template file."""
    with open(DEFAULT_TEMPLATE) as f:
        return json.load(f)

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
    # Use shorter timeout (default is 5s which is too slow for browser)
    devices = await Discover.discover(discovery_timeout=1)

    result = []

    for ip, dev in devices.items():
        try:
            await dev.update()
        except Exception:
            pass  # Some devices have timezone issues (e.g., MST7MDT)

        name = getattr(dev, 'alias', None) or ip
        # Skip unrenamed devices (likely not in use)
        if name.startswith('TP-LINK_'):
            continue

        _device_cache[ip] = dev
        result.append({
            'name': name,
            'ip': ip,
            'on': getattr(dev, 'is_on', None),
            'model': getattr(dev, 'model', 'unknown'),
            'type': _get_device_type(dev)
        })

    return result


def _get_device_type(dev):
    """Get device type string"""
    # Use device_type property instead of deprecated is_plug/is_bulb/etc
    device_type = getattr(dev, 'device_type', None)
    if device_type is None:
        return 'unknown'
    # device_type is a Device.Type enum, convert to lowercase string
    return device_type.name.lower() if hasattr(device_type, 'name') else str(device_type).lower()


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


# === Dashboard Configuration ===

def _load_config():
    """Load full dashboard config from file"""
    defaults = _get_default_config()
    if DASHBOARD_CONFIG.exists():
        try:
            with open(DASHBOARD_CONFIG) as f:
                config = json.load(f)
                # Deep merge with defaults
                result = json.loads(json.dumps(defaults))
                for key, value in config.items():
                    if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                        result[key] = {**result[key], **value}
                    else:
                        result[key] = value
                return result
        except Exception:
            pass
    return defaults


def _save_config(config):
    """Save full dashboard config to file"""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(DASHBOARD_CONFIG, 'w') as f:
        json.dump(config, f, indent=2)


def _notify_config_updated():
    """Notify all SSE subscribers that config has changed"""
    message = json.dumps({'type': 'config-updated'})
    with _sse_lock:
        for q in _sse_subscribers:
            try:
                q.put_nowait(message)
            except queue.Full:
                pass  # Skip slow clients


def _sse_stream():
    """Generator for SSE stream"""
    q = queue.Queue(maxsize=10)
    with _sse_lock:
        _sse_subscribers.append(q)
    try:
        # Send initial connection message
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
        while True:
            try:
                message = q.get(timeout=30)
                yield f"data: {message}\n\n"
            except queue.Empty:
                # Send keepalive ping every 30s
                yield f": keepalive\n\n"
    finally:
        with _sse_lock:
            _sse_subscribers.remove(q)


@app.route('/config/subscribe', methods=['GET'])
def config_subscribe():
    """SSE endpoint for live config updates"""
    return Response(
        _sse_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        }
    )


@app.route('/config', methods=['GET'])
def get_config():
    """Get full dashboard configuration"""
    return jsonify(_load_config())


@app.route('/config', methods=['POST'])
def set_config():
    """Save full dashboard configuration"""
    data = request.get_json() or {}
    _save_config(data)
    # Notify all connected clients to refresh
    _notify_config_updated()
    return jsonify(data)


@app.route('/config/brightness', methods=['GET'])
def get_brightness_config():
    """Get just the brightness section (for shell script)"""
    config = _load_config()
    return jsonify(config.get('brightness', {}))


# === Brightness Control ===


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
    full_config = _load_config()
    brightness_config = full_config.get('brightness', {})
    result = {'config': brightness_config, 'current': None, 'sun': None}

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

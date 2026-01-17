"""Wake-on-LAN endpoints."""

import subprocess

from flask import Blueprint, jsonify, request
from getmac import get_mac_address
from wakeonlan import send_magic_packet

bp = Blueprint("wol", __name__, url_prefix="/wol")


@bp.route("/wake", methods=["POST"])
def wake():
    """Send Wake-on-LAN magic packet."""
    data = request.get_json() or {}
    mac = data.get("mac")

    if not mac:
        return jsonify({"error": "mac required"}), 400

    try:
        mac = mac.replace("-", ":").upper()
        send_magic_packet(mac)
        return jsonify({"success": True, "mac": mac})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/ping", methods=["GET"])
def ping():
    """Check if a host is online via ping."""
    ip = request.args.get("ip")

    if not ip:
        return jsonify({"error": "ip required"}), 400

    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "1", ip],
            capture_output=True,
            timeout=3,
        )
        online = result.returncode == 0
        return jsonify({"ip": ip, "online": online})
    except Exception:
        return jsonify({"ip": ip, "online": False})


@bp.route("/mac", methods=["GET"])
def lookup_mac():
    """Get MAC address for an IP via ARP table (device must be on same network)."""
    ip = request.args.get("ip")

    if not ip:
        return jsonify({"error": "ip required"}), 400

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
            return jsonify({"ip": ip, "mac": mac})
        return jsonify({"ip": ip, "mac": None, "error": "MAC not found in ARP table"}), 404

    except subprocess.TimeoutExpired:
        return jsonify({"ip": ip, "mac": None, "error": "Timeout"}), 504
    except Exception as e:
        return jsonify({"ip": ip, "mac": None, "error": str(e)}), 500

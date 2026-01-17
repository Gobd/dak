"""Wake-on-LAN endpoints."""

import subprocess

from flask import Blueprint, jsonify, request
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

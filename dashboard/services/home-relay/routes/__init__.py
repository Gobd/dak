"""Route blueprints for home-relay service."""

from .brightness import bp as brightness_bp
from .kasa import bp as kasa_bp
from .notifications import bp as notifications_bp
from .wol import bp as wol_bp

__all__ = ["brightness_bp", "kasa_bp", "notifications_bp", "wol_bp"]

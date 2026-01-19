"""Route blueprints for home-relay service."""

from .brightness import bp as brightness_bp
from .kasa import bp as kasa_bp
from .sensors import bp as sensors_bp
from .voice import bp as voice_bp
from .wol import bp as wol_bp

__all__ = ["brightness_bp", "kasa_bp", "sensors_bp", "voice_bp", "wol_bp"]

"""Route blueprints for home-relay service."""

from .brightness import bp as brightness_bp
from .kasa import bp as kasa_bp
from .models import bp as models_bp
from .sensors import bp as sensors_bp
from .transcribe import bp as transcribe_bp
from .transcribe import init_websocket as init_voice_websocket
from .voice import bp as voice_bp
from .voices import bp as voices_bp
from .volume import bp as volume_bp
from .wol import bp as wol_bp

__all__ = [
    "brightness_bp",
    "init_voice_websocket",
    "kasa_bp",
    "models_bp",
    "sensors_bp",
    "transcribe_bp",
    "voice_bp",
    "voices_bp",
    "volume_bp",
    "wol_bp",
]

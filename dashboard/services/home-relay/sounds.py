"""Shared audio feedback utilities."""

import subprocess
from pathlib import Path

SOUNDS_DIR = Path(__file__).parent / "sounds"


def play_sound(sound_name: str):
    """
    Play a feedback sound (non-blocking).

    Args:
        sound_name: One of 'wake', 'success', 'error'

    """
    sounds = {
        "wake": SOUNDS_DIR / "wake.wav",
        "success": SOUNDS_DIR / "success.wav",
        "error": SOUNDS_DIR / "error.wav",
    }
    path = sounds.get(sound_name)
    if path and path.exists():
        subprocess.Popen(
            ["aplay", "-q", str(path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

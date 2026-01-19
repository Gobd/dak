#!/usr/bin/env python3
"""
Voice control service - wake word detection + command processing.
Runs as separate process, sends commands to home-relay via HTTP.

Usage:
    python voice_control.py

Configuration is fetched from home-relay (Settings > Voice Control in dashboard UI).
"""

import json
import logging
import re
import struct
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import pyaudio
import requests
from openwakeword.model import Model as WakeWordModel
from vosk import KaldiRecognizer
from vosk import Model as VoskModel

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="[voice] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Audio config
SAMPLE_RATE = 16000
CHUNK_SIZE = 1280  # 80ms chunks for wake word
COMMAND_DURATION = 4  # Seconds to record after wake word
HOME_RELAY_URL = "http://localhost:5111"
WAKE_THRESHOLD = 0.5  # Confidence threshold for wake word detection

# Paths
BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
VOSK_MODEL_PATH = MODELS_DIR / "vosk-model-small-en-us"
SOUNDS_DIR = BASE_DIR / "sounds"


# =============================================================================
# COMMAND REGISTRY - Add new commands here
# =============================================================================


@dataclass
class VoiceCommand:
    """A registered voice command."""

    name: str
    patterns: list[re.Pattern]
    handler: callable
    help_text: str
    examples: list[str]


# Global command registry
COMMANDS: list[VoiceCommand] = []


def command(name: str, patterns: list[str], help_text: str, examples: list[str]):
    """Register a voice command with patterns and handler."""

    def decorator(func):
        COMMANDS.append(
            VoiceCommand(
                name=name,
                patterns=[re.compile(p, re.IGNORECASE) for p in patterns],
                handler=func,
                help_text=help_text,
                examples=examples,
            )
        )
        return func

    return decorator


def parse_command(text: str) -> tuple[VoiceCommand, dict] | None:
    """Match text against registered commands."""
    for cmd in COMMANDS:
        for pattern in cmd.patterns:
            match = pattern.search(text)
            if match:
                return cmd, match.groupdict()
    return None


# =============================================================================
# COMMANDS - Add your voice commands here
# =============================================================================


@command(
    name="add_to_list",
    patterns=[
        r"add (?P<item>.+?) to (?P<list>[\w\s]+?)(?:\s+list)?$",
        r"put (?P<item>.+?) on (?P<list>[\w\s]+?)(?:\s+list)?$",
    ],
    help_text="Add item to a list (groceries, shopping, etc)",
    examples=[
        "add cheese to groceries",
        "add milk to shopping list",
        "put eggs on grocery list",
    ],
)
def cmd_add_to_list(params: dict) -> dict:
    """Add an item to a note/list."""
    item = params["item"].strip()
    list_name = params["list"].strip()

    response = requests.post(
        f"{HOME_RELAY_URL}/voice/command",
        json={"type": "add-to-list", "item": item, "list": list_name},
        timeout=5,
    )
    return {
        "success": response.ok,
        "message": f"Added '{item}' to {list_name}" if response.ok else "Failed",
    }


@command(
    name="climate_check",
    patterns=[
        r"(is it|what'?s?) (warmer|cooler|hotter|colder) (outside|inside)",
        r"how (warm|cold|hot) is it (outside|inside)",
        r"(compare|check) (indoor|outdoor|inside|outside) temperature",
    ],
    help_text="Compare indoor vs outdoor temperature",
    examples=["is it warmer outside", "how hot is it inside"],
)
def cmd_climate_check(_params: dict) -> dict:
    """Check indoor/outdoor temperature comparison."""
    response = requests.get(f"{HOME_RELAY_URL}/sensors/all", timeout=5)
    if not response.ok:
        return {"success": False, "message": "Sensor data unavailable"}

    data = response.json()
    comparison = data.get("comparison")

    if not comparison:
        return {"success": False, "message": "Comparison data unavailable"}

    diff = comparison.get("difference", 0)
    if comparison.get("outside_feels_cooler"):
        msg = f"Outside feels {abs(diff)} degrees cooler"
    elif comparison.get("outside_feels_warmer"):
        msg = f"Outside feels {diff} degrees warmer"
    else:
        msg = "Inside and outside feel about the same"

    return {"success": True, "message": msg, "speak": msg}


@command(
    name="device_control",
    patterns=[
        r"turn (?P<action>on|off) (?:the )?(?P<device>.+)",
        r"(?P<device>.+) (?P<action>on|off)$",
    ],
    help_text="Turn Kasa smart devices on or off",
    examples=["turn on the lamp", "turn off bedroom light", "lamp on"],
)
def cmd_device_control(params: dict) -> dict:
    """Control Kasa smart devices."""
    device = params["device"].strip()
    action = params["action"].lower()

    response = requests.post(
        f"{HOME_RELAY_URL}/kasa/toggle-by-name",
        json={"device": device, "state": action == "on"},
        timeout=10,
    )

    if response.ok:
        data = response.json()
        if "error" in data:
            return {"success": False, "message": data["error"]}
        return {"success": True, "message": f"Turned {action} {device}"}
    return {"success": False, "message": f"Failed to control {device}"}


@command(
    name="timer",
    patterns=[
        r"(?:start|set) (?:a )?(?P<duration>\d+) ?(?P<unit>second|minute|hour)s?"
        r"(?: timer)?(?: (?:called|named|for) (?P<name>.+))?",
        r"timer (?:for )?(?P<duration>\d+) ?(?P<unit>second|minute|hour)s?"
        r"(?: (?:called|named|for) (?P<name>.+))?",
    ],
    help_text="Start a countdown timer",
    examples=[
        "start 10 minute timer called water",
        "set a 2 hour timer for laundry",
        "timer 30 seconds",
    ],
)
def cmd_timer(params: dict) -> dict:
    """Start a countdown timer."""
    duration = int(params["duration"])
    unit = params["unit"].lower()
    name = (params.get("name") or "Timer").strip()

    # Convert to seconds
    multipliers = {"second": 1, "minute": 60, "hour": 3600}
    seconds = duration * multipliers.get(unit, 60)

    response = requests.post(
        f"{HOME_RELAY_URL}/voice/command",
        json={"type": "timer", "seconds": seconds, "name": name},
        timeout=5,
    )

    unit_display = unit + ("s" if duration != 1 else "")
    return {
        "success": response.ok,
        "message": f"Started {duration} {unit_display} timer: {name}" if response.ok else "Failed",
    }


@command(
    name="stop_timer",
    patterns=[
        r"(?:stop|cancel|dismiss|clear)(?: the)?(?: (?P<name>.+))? timer",
        r"timer (?:stop|cancel|dismiss|off)",
    ],
    help_text="Stop or cancel a timer",
    examples=["stop timer", "cancel water timer", "dismiss timer"],
)
def cmd_stop_timer(params: dict) -> dict:
    """Stop or cancel a timer."""
    name = (params.get("name") or "").strip() or None

    response = requests.post(
        f"{HOME_RELAY_URL}/voice/command",
        json={"type": "stop-timer", "name": name},
        timeout=5,
    )
    return {
        "success": response.ok,
        "message": "Timer stopped" if response.ok else "Failed to stop timer",
    }


@command(
    name="help",
    patterns=[
        r"(what can you do|help|commands|what can i say)",
    ],
    help_text="List available voice commands",
    examples=["what can you do", "help"],
)
def cmd_help(_params: dict) -> dict:
    """List available commands."""
    lines = ["You can say:"]
    lines.extend(f"  - {cmd.examples[0]}" for cmd in COMMANDS if cmd.name != "help")
    return {"success": True, "message": "\n".join(lines)}


# =============================================================================
# AUDIO FEEDBACK
# =============================================================================


def play_sound(sound_name: str):
    """Play a feedback sound (non-blocking)."""
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


# =============================================================================
# VOICE CONTROL SERVICE
# =============================================================================


class VoiceControl:
    """Main voice control service."""

    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.running = False
        self.wake_model = None
        self.vosk_model = None
        self.wake_word = "hey_jarvis"  # Default, overridden by config

    def fetch_config(self) -> bool:
        """Fetch voice config from home-relay. Returns True if voice is enabled."""
        try:
            response = requests.get(f"{HOME_RELAY_URL}/config", timeout=5)
            if not response.ok:
                logger.warning("Failed to fetch config, using defaults")
                return True  # Assume enabled if can't fetch

            config = response.json()
            global_settings = config.get("globalSettings", {})

            # Check if voice is enabled
            if not global_settings.get("voiceEnabled", False):
                logger.info("Voice control is disabled in settings")
                return False

            # Get wake word
            self.wake_word = global_settings.get("wakeWord", "hey_jarvis")
            logger.info("Voice enabled, wake word: %s", self.wake_word)
            return True

        except Exception:
            logger.exception("Error fetching config")
            return True  # Assume enabled if can't fetch

    def load_models(self):
        """Load wake word and STT models."""
        # Use built-in wake word model (no custom training)
        logger.info("Loading wake word model for '%s'...", self.wake_word)
        self.wake_model = WakeWordModel(inference_framework="onnx")
        available_models = list(self.wake_model.models.keys())
        logger.info("Available wake words: %s", available_models)

        if self.wake_word not in available_models:
            logger.warning(
                "Wake word '%s' not available, using first available: %s",
                self.wake_word,
                available_models[0] if available_models else "none",
            )

        logger.info("Loading Vosk model from %s...", VOSK_MODEL_PATH)
        if not VOSK_MODEL_PATH.exists():
            msg = f"Vosk model not found at {VOSK_MODEL_PATH}. Run voice-setup.sh first."
            raise FileNotFoundError(msg)
        self.vosk_model = VoskModel(str(VOSK_MODEL_PATH))

        logger.info("Models loaded successfully")

    def check_microphone(self) -> bool:
        """Check if a microphone is available."""
        try:
            info = self.audio.get_default_input_device_info()
            logger.info("Found microphone: %s", info.get("name", "unknown"))
            return True
        except OSError:
            logger.info("No microphone detected")
            return False

    def start(self):
        """Start listening for wake word."""
        # Check for microphone first
        if not self.check_microphone():
            logger.info("Exiting - no microphone available")
            return

        # Check config
        if not self.fetch_config():
            logger.info("Exiting - voice control disabled")
            return

        self.load_models()
        self.running = True

        self.stream = self.audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_SIZE,
        )

        logger.info("Listening for wake word '%s'...", self.wake_word)

        while self.running:
            try:
                audio_chunk = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)

                # Convert to array for wake word detection
                audio_array = struct.unpack(f"{CHUNK_SIZE}h", audio_chunk)
                prediction = self.wake_model.predict(audio_array)

                # Check all wake words in model
                for wake_word, score in prediction.items():
                    if score > WAKE_THRESHOLD:
                        logger.info("Wake word '%s' detected (score: %.2f)", wake_word, score)
                        play_sound("wake")
                        self._handle_command()
                        break

            except Exception:
                logger.exception("Error in wake word loop")
                time.sleep(0.1)

    def _handle_command(self):
        """Record and process command after wake word."""
        logger.info("Recording command for %d seconds...", COMMAND_DURATION)

        # Record audio
        frames = []
        num_chunks = int(SAMPLE_RATE / CHUNK_SIZE * COMMAND_DURATION)
        for _ in range(num_chunks):
            data = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)
            frames.append(data)

        # Transcribe with Vosk
        recognizer = KaldiRecognizer(self.vosk_model, SAMPLE_RATE)
        for frame in frames:
            recognizer.AcceptWaveform(frame)

        result = json.loads(recognizer.FinalResult())
        text = result.get("text", "").strip()

        logger.info("Transcribed: '%s'", text)

        if text:
            self._execute_command(text)
        else:
            logger.info("No speech detected")
            play_sound("error")

    def _execute_command(self, text: str):
        """Parse and execute a voice command."""
        result = parse_command(text)

        if result is None:
            logger.warning("Unknown command: %s", text)
            play_sound("error")
            return

        cmd, params = result
        logger.info("Matched command '%s' with params: %s", cmd.name, params)

        try:
            response = cmd.handler(params)
            if response.get("success"):
                logger.info("Command succeeded: %s", response.get("message"))
                play_sound("success")
            else:
                logger.warning("Command failed: %s", response.get("message"))
                play_sound("error")
        except Exception:
            logger.exception("Error executing command")
            play_sound("error")

    def stop(self):
        """Stop listening."""
        self.running = False
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.audio.terminate()


def main():
    """Entry point."""
    vc = VoiceControl()
    try:
        vc.start()
    except KeyboardInterrupt:
        logger.info("Stopping...")
    finally:
        vc.stop()


if __name__ == "__main__":
    main()

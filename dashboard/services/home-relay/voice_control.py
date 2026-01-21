#!/usr/bin/env python3
"""
Voice control service - wake word detection.
Runs as separate process, records audio after wake word and sends to relay for
transcription and command execution.

Usage:
    python voice_control.py

Configuration is fetched from home-relay (Settings > Voice Control in dashboard UI).
"""

import logging
import struct
import time

import httpx
import pyaudio  # type: ignore[import-not-found]
from openwakeword.model import Model as WakeWordModel  # type: ignore[import-not-found]

from sounds import play_sound

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


# =============================================================================
# VOICE CONTROL SERVICE
# =============================================================================


class VoiceControl:
    """Main voice control service - wake word detection only."""

    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.running = False
        self.wake_model = None
        self.wake_word = "hey_jarvis"  # Default, overridden by config

    def fetch_config(self) -> bool:
        """Fetch voice config from home-relay. Returns True if voice is enabled."""
        try:
            response = httpx.get(f"{HOME_RELAY_URL}/config", timeout=5)
            if not response.is_success:
                logger.warning("Failed to fetch config, defaulting to disabled")
                return False

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
            return False

    def load_models(self):
        """Load wake word model."""
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

        logger.info("Wake word model loaded")

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
                assert self.stream is not None
                assert self.wake_model is not None
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
        """Record and send audio to relay for transcription and execution."""
        logger.info("Recording command for %d seconds...", COMMAND_DURATION)
        assert self.stream is not None

        # Record raw PCM audio
        frames = []
        num_chunks = int(SAMPLE_RATE / CHUNK_SIZE * COMMAND_DURATION)
        for _ in range(num_chunks):
            data = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)
            frames.append(data)

        audio_data = b"".join(frames)

        # Send to relay for transcription and execution
        logger.info("Sending audio to relay for transcription...")
        try:
            response = httpx.post(
                f"{HOME_RELAY_URL}/voice/transcribe-and-execute",
                content=audio_data,
                headers={"Content-Type": "audio/raw"},
                timeout=10,
            )

            if response.is_success:
                result = response.json()
                text = result.get("text", "")
                logger.info("Transcribed: '%s'", text)

                if result.get("error"):
                    logger.warning("Command error: %s", result["error"])
                    # Sound already played by relay
                elif result.get("command"):
                    logger.info(
                        "Command '%s' executed: %s",
                        result["command"],
                        result.get("result", {}).get("message", ""),
                    )
                    # Sound already played by relay
            else:
                logger.warning("Relay returned error: %s", response.status_code)
                play_sound("error")

        except Exception:
            logger.exception("Error sending to relay")
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

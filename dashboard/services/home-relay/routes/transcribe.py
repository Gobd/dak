"""
Voice transcription routes - Vosk STT and command execution.
Provides both REST and WebSocket interfaces for speech-to-text.
"""

import json
import logging
import subprocess
import time
from pathlib import Path

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)
bp = Blueprint("transcribe", __name__, url_prefix="/voice")

# Vosk model setup
MODELS_DIR = Path(__file__).parent.parent / "models"
SOUNDS_DIR = Path(__file__).parent.parent / "sounds"

# Model directory names by ID
MODEL_DIRS = {
    "small": "vosk-model-small-en-us",
    "medium": "vosk-model-en-us-lgraph",
    "large": "vosk-model-en-us",
}

_vosk_model = None
_vosk_model_id = None
_vosk_available = None


def _check_vosk_available():
    """Check if Vosk is available on this system."""
    global _vosk_available
    if _vosk_available is None:
        try:
            import vosk  # noqa: F401

            _vosk_available = True
        except ImportError:
            _vosk_available = False
            logger.info("Vosk not available (only installed on Linux)")
    return _vosk_available


def _get_vosk_model(model_id: str = "small"):
    """Lazy-load Vosk model by ID. Defaults to 'small' model."""
    global _vosk_model, _vosk_model_id

    # If model already loaded and matches requested ID, return it
    if _vosk_model is not None and _vosk_model_id == model_id:
        return _vosk_model

    if not _check_vosk_available():
        return None

    # Get model directory name
    model_dir = MODEL_DIRS.get(model_id, MODEL_DIRS["small"])
    model_path = MODELS_DIR / model_dir

    if not model_path.exists():
        logger.warning("Vosk model '%s' not found at %s", model_id, model_path)
        return None

    from vosk import Model as VoskModel

    logger.info("Loading Vosk model '%s' from %s...", model_id, model_path)
    _vosk_model = VoskModel(str(model_path))
    _vosk_model_id = model_id
    logger.info("Vosk model loaded")
    return _vosk_model


def _get_configured_model_id() -> str:
    """Get the configured voice model ID from dashboard config."""
    import contextlib

    config_path = Path.home() / ".config" / "home-relay" / "dashboard.json"
    if config_path.exists():
        with contextlib.suppress(Exception):
            config = json.loads(config_path.read_text())
            return config.get("globalSettings", {}).get("voiceModel", "small")
    return "small"


def _transcribe_audio(audio_data: bytes, sample_rate: int = 16000) -> str:
    """Transcribe raw PCM audio to text using configured model."""
    model_id = _get_configured_model_id()
    model = _get_vosk_model(model_id)
    if not model:
        return ""

    from vosk import KaldiRecognizer

    recognizer = KaldiRecognizer(model, sample_rate)
    recognizer.AcceptWaveform(audio_data)
    result = json.loads(recognizer.FinalResult())
    return result.get("text", "").strip()


def _play_sound(sound_name: str):
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


@bp.route("/transcribe", methods=["POST"])
def transcribe():
    """
    Transcribe audio to text.

    Accepts raw PCM audio (16kHz, mono, 16-bit).
    Returns: { "text": "transcribed text" }
    """
    if not _check_vosk_available():
        return jsonify({"error": "Vosk not available on this platform"}), 503

    model = _get_vosk_model()
    if not model:
        return jsonify({"error": "Vosk model not installed"}), 503

    audio_data = request.data
    if not audio_data:
        return jsonify({"error": "No audio data"}), 400

    text = _transcribe_audio(audio_data)
    return jsonify({"text": text})


@bp.route("/transcribe-and-execute", methods=["POST"])
def transcribe_and_execute():
    """
    Transcribe audio and execute matching command.

    Accepts raw PCM audio (16kHz, mono, 16-bit).
    Returns: { "text": "...", "command": "...", "result": {...} }
    """
    from commands import parse_command

    if not _check_vosk_available():
        return jsonify({"error": "Vosk not available on this platform"}), 503

    model = _get_vosk_model()
    if not model:
        return jsonify({"error": "Vosk model not installed"}), 503

    audio_data = request.data
    if not audio_data:
        return jsonify({"error": "No audio data"}), 400

    text = _transcribe_audio(audio_data)
    if not text:
        _play_sound("error")
        return jsonify({"text": "", "error": "No speech detected"})

    result = parse_command(text)
    if not result:
        _play_sound("error")
        return jsonify({"text": text, "error": "Unknown command"})

    cmd, params = result
    try:
        response = cmd.handler(params)
        if response.get("success"):
            _play_sound("success")
            # Speak response if TTS text provided
            if response.get("speak"):
                from routes.voices import speak

                speak(response["speak"])
            # Broadcast result to dashboard for modal display
            if response.get("speak") or response.get("message"):
                from routes.voice import broadcast_command

                broadcast_command(
                    {
                        "type": "voice-result",
                        "command": cmd.name,
                        "text": response.get("speak") or response.get("message"),
                    }
                )
        else:
            _play_sound("error")
        return jsonify({"text": text, "command": cmd.name, "result": response})
    except Exception as e:
        _play_sound("error")
        return jsonify({"text": text, "command": cmd.name, "error": str(e)}), 500


def init_websocket(sock):
    """Initialize WebSocket route for audio streaming."""

    @sock.route("/voice/stream")
    def stream_transcribe(ws):
        """
        WebSocket endpoint for streaming audio transcription.

        Client sends:
        - Binary audio chunks (raw PCM: 16kHz, mono, int16)
        - Text "STOP" to end early

        Server sends:
        - JSON { "type": "result", "text": "...", "command": "...", "result": {...} }
        """
        from commands import parse_command

        logger.info("Voice stream connected")

        if not _check_vosk_available():
            ws.send(json.dumps({"type": "error", "error": "Vosk not available"}))
            return

        model_id = _get_configured_model_id()
        model = _get_vosk_model(model_id)
        if not model:
            ws.send(json.dumps({"type": "error", "error": "Speech model not downloaded"}))
            return

        from vosk import KaldiRecognizer

        # Use 16kHz for Vosk - client sends raw PCM at this rate
        recognizer = KaldiRecognizer(model, 16000)

        # Collect raw PCM audio chunks
        audio_chunks = []
        start = time.time()
        max_duration = 10  # Max recording time

        while time.time() - start < max_duration:
            try:
                data = ws.receive(timeout=0.1)
                if data is None:
                    continue
                if isinstance(data, str):
                    if data == "STOP":
                        logger.info("Client stopped recording")
                        break
                    continue
                # Collect raw PCM chunks
                audio_chunks.append(data)
            except Exception:
                break

        if not audio_chunks:
            ws.send(json.dumps({"type": "result", "text": "", "error": "No audio received"}))
            return

        # Combine PCM chunks and transcribe
        pcm_data = b"".join(audio_chunks)
        recognizer.AcceptWaveform(pcm_data)
        result = json.loads(recognizer.FinalResult())
        text = result.get("text", "").strip()

        logger.info("Transcribed: '%s'", text)

        if not text:
            _play_sound("error")
            ws.send(json.dumps({"type": "result", "text": "", "error": "No speech detected"}))
            return

        # Parse and execute command
        cmd_result = parse_command(text)
        if not cmd_result:
            _play_sound("error")
            ws.send(json.dumps({"type": "result", "text": text, "error": "Unknown command"}))
            return

        cmd, params = cmd_result
        try:
            response = cmd.handler(params)
            if response.get("success"):
                _play_sound("success")
                # Speak response if TTS text provided
                if response.get("speak"):
                    from routes.voices import speak

                    speak(response["speak"])
                # Broadcast result to dashboard for modal display
                if response.get("speak") or response.get("message"):
                    from routes.voice import broadcast_command

                    broadcast_command(
                        {
                            "type": "voice-result",
                            "command": cmd.name,
                            "text": response.get("speak") or response.get("message"),
                        }
                    )
            else:
                _play_sound("error")
            result_msg = {"type": "result", "text": text, "command": cmd.name, "result": response}
            ws.send(json.dumps(result_msg))
        except Exception as e:
            _play_sound("error")
            ws.send(json.dumps({"type": "result", "text": text, "error": str(e)}))

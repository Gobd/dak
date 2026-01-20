"""Voice transcription endpoints - Vosk STT and command execution.

Provides both REST and WebSocket interfaces for speech-to-text.
"""

import json
import logging
import time
from pathlib import Path
from typing import Union

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect

from app.models.voice import (
    CommandResult,
    TranscribeAndExecuteResponse,
    TranscriptionErrorResponse,
    TranscriptionResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["transcribe"])

# Vosk model setup
MODELS_DIR = Path(__file__).parent.parent.parent / "models"

# Model directory names by ID
MODEL_DIRS = {
    "small": "vosk-model-small-en-us",
    "medium": "vosk-model-en-us-lgraph",
    "large": "vosk-model-en-us",
}

_vosk_model = None
_vosk_model_id = None
_vosk_available = None


def _check_vosk_available() -> bool:
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


def _play_sound(sound_name: str) -> None:
    """Play a feedback sound (non-blocking)."""
    try:
        # Import from the old location (will be kept for compatibility)
        import sys

        sys.path.insert(0, str(Path(__file__).parent.parent.parent))
        from sounds import play_sound

        play_sound(sound_name)
    except Exception:
        logger.debug("Could not play sound %s", sound_name)


@router.post(
    "/transcribe",
    response_model=Union[TranscriptionResponse, TranscriptionErrorResponse],
)
async def transcribe(request: Request):
    """Transcribe audio to text.

    Accepts raw PCM audio (16kHz, mono, 16-bit).
    Returns: { "text": "transcribed text" }
    """
    if not _check_vosk_available():
        raise HTTPException(status_code=503, detail="Vosk not available on this platform")

    model = _get_vosk_model()
    if not model:
        raise HTTPException(status_code=503, detail="Vosk model not installed")

    audio_data = await request.body()
    if not audio_data:
        raise HTTPException(status_code=400, detail="No audio data")

    text = _transcribe_audio(audio_data)
    return TranscriptionResponse(text=text)


@router.post("/transcribe-and-execute", response_model=TranscribeAndExecuteResponse)
async def transcribe_and_execute(request: Request):
    """Transcribe audio and execute matching command.

    Accepts raw PCM audio (16kHz, mono, 16-bit).
    Returns: { "text": "...", "command": "...", "result": {...} }
    """
    # Import commands module from old location
    import sys

    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from commands import parse_command

    if not _check_vosk_available():
        raise HTTPException(status_code=503, detail="Vosk not available on this platform")

    model = _get_vosk_model()
    if not model:
        raise HTTPException(status_code=503, detail="Vosk model not installed")

    audio_data = await request.body()
    if not audio_data:
        raise HTTPException(status_code=400, detail="No audio data")

    text = _transcribe_audio(audio_data)
    if not text:
        _play_sound("error")
        return TranscribeAndExecuteResponse(text="", error="No speech detected")

    result = parse_command(text)
    if not result:
        _play_sound("error")
        return TranscribeAndExecuteResponse(text=text, error="Unknown command")

    cmd, params = result
    try:
        response = cmd.handler(params)
        if response.get("success"):
            _play_sound("success")
            # Speak response if TTS text provided
            if response.get("speak"):
                try:
                    from app.routers.voices import speak

                    speak(response["speak"])
                except Exception:
                    pass
            # Broadcast result to dashboard for modal display
            if response.get("speak") or response.get("message"):
                from app.routers.voice import broadcast_command

                broadcast_command(
                    {
                        "type": "voice-result",
                        "command": cmd.name,
                        "text": response.get("speak") or response.get("message"),
                    }
                )
        else:
            _play_sound("error")
        return TranscribeAndExecuteResponse(
            text=text,
            command=cmd.name,
            result=CommandResult(**response),
        )
    except Exception as e:
        _play_sound("error")
        return TranscribeAndExecuteResponse(text=text, command=cmd.name, error=str(e))


@router.websocket("/stream")
async def stream_transcribe(websocket: WebSocket):
    """WebSocket endpoint for streaming audio transcription.

    Client sends:
    - Binary audio chunks (raw PCM: 16kHz, mono, int16)
    - Text "STOP" to end early

    Server sends:
    - JSON { "type": "result", "text": "...", "command": "...", "result": {...} }
    """
    await websocket.accept()

    # Import commands module from old location
    import sys

    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from commands import parse_command

    logger.info("Voice stream connected")

    if not _check_vosk_available():
        await websocket.send_json({"type": "error", "error": "Vosk not available"})
        await websocket.close()
        return

    model_id = _get_configured_model_id()
    model = _get_vosk_model(model_id)
    if not model:
        await websocket.send_json({"type": "error", "error": "Speech model not downloaded"})
        await websocket.close()
        return

    from vosk import KaldiRecognizer

    # Use 16kHz for Vosk - client sends raw PCM at this rate
    recognizer = KaldiRecognizer(model, 16000)

    # Collect raw PCM audio chunks
    audio_chunks = []
    start = time.time()
    max_duration = 10  # Max recording time

    try:
        while time.time() - start < max_duration:
            try:
                # Receive with timeout
                data = await websocket.receive()

                if "bytes" in data:
                    audio_chunks.append(data["bytes"])
                elif "text" in data:
                    if data["text"] == "STOP":
                        logger.info("Client stopped recording")
                        break
            except WebSocketDisconnect:
                break
            except Exception:
                break

        if not audio_chunks:
            await websocket.send_json({"type": "result", "text": "", "error": "No audio received"})
            return

        # Combine PCM chunks and transcribe
        pcm_data = b"".join(audio_chunks)
        recognizer.AcceptWaveform(pcm_data)
        result = json.loads(recognizer.FinalResult())
        text = result.get("text", "").strip()

        logger.info("Transcribed: '%s'", text)

        if not text:
            _play_sound("error")
            await websocket.send_json({"type": "result", "text": "", "error": "No speech detected"})
            return

        # Parse and execute command
        cmd_result = parse_command(text)
        if not cmd_result:
            _play_sound("error")
            await websocket.send_json({"type": "result", "text": text, "error": "Unknown command"})
            return

        cmd, params = cmd_result
        try:
            response = cmd.handler(params)
            if response.get("success"):
                _play_sound("success")
                # Speak response if TTS text provided
                if response.get("speak"):
                    try:
                        from app.routers.voices import speak

                        speak(response["speak"])
                    except Exception:
                        pass
                # Broadcast result to dashboard for modal display
                if response.get("speak") or response.get("message"):
                    from app.routers.voice import broadcast_command

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
            await websocket.send_json(result_msg)
        except Exception as e:
            _play_sound("error")
            await websocket.send_json({"type": "result", "text": text, "error": str(e)})

    except WebSocketDisconnect:
        logger.info("Voice stream disconnected")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

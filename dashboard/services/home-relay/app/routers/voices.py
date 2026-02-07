"""Piper TTS voice management - list, download, and speak."""

import json
import logging
import subprocess
import threading
from pathlib import Path
from typing import Union

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.models import AlreadyDownloadedResponse, DeleteResponse
from app.models.voices import SpeakRequest, SpeakResponse, TTSStatusResponse, VoiceInfo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice/tts", tags=["tts"])

# Voice storage directory
VOICES_DIR = Path(__file__).parent.parent.parent / "voices"
PIPER_DIR = Path(__file__).parent.parent.parent / "piper"

# Available Piper voices (English US)
PIPER_VOICES = {
    "amy": {
        "id": "amy",
        "name": "Amy",
        "description": "Female, clear",
        "size": "63MB",
        "quality": "medium",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium",
        "files": ["en_US-amy-medium.onnx", "en_US-amy-medium.onnx.json"],
    },
    "danny": {
        "id": "danny",
        "name": "Danny",
        "description": "Male, casual",
        "size": "63MB",
        "quality": "low",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/danny/low",
        "files": ["en_US-danny-low.onnx", "en_US-danny-low.onnx.json"],
    },
    "lessac": {
        "id": "lessac",
        "name": "Lessac",
        "description": "Male, professional",
        "size": "63MB",
        "quality": "medium",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium",
        "files": ["en_US-lessac-medium.onnx", "en_US-lessac-medium.onnx.json"],
    },
    "ryan": {
        "id": "ryan",
        "name": "Ryan",
        "description": "Male, warm",
        "size": "63MB",
        "quality": "medium",
        "base_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium",
        "files": ["en_US-ryan-medium.onnx", "en_US-ryan-medium.onnx.json"],
    },
}

# Track download progress
_download_progress: dict[str, dict] = {}
_download_lock = threading.Lock()


def _is_piper_installed() -> bool:
    """Check if Piper binary is installed."""
    piper_bin = PIPER_DIR / "piper"
    return piper_bin.exists() and piper_bin.is_file()


async def _install_piper() -> bool:
    """Download and install Piper binary. Returns True on success."""
    import platform

    if _is_piper_installed():
        return True

    PIPER_DIR.mkdir(parents=True, exist_ok=True)

    arch = platform.machine()
    if arch == "aarch64":
        url = "https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_arm64.tar.gz"
    elif arch == "x86_64":
        url = "https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz"
    else:
        logger.warning("Unsupported architecture for Piper: %s", arch)
        return False

    logger.info("Downloading Piper TTS binary...")
    try:
        import tarfile
        import tempfile

        async with httpx.AsyncClient() as client:
            with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
                stream = client.stream("GET", url, follow_redirects=True, timeout=120)
                async with stream as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes(chunk_size=1024 * 1024):
                        tmp.write(chunk)
                tmp_path = tmp.name

        with tarfile.open(tmp_path, "r:gz") as tar:
            # Extract with strip of 1 component (piper/ prefix)
            for member in tar.getmembers():
                if member.name.startswith("piper/"):
                    member.name = member.name[6:]  # Strip "piper/" prefix
                    if member.name:  # Skip empty name (the directory itself)
                        tar.extract(member, PIPER_DIR)

        Path(tmp_path).unlink()  # noqa: ASYNC240
        logger.info("Piper TTS installed successfully")
        return True
    except Exception:
        logger.exception("Failed to install Piper")
        return False


def _is_voice_downloaded(voice_id: str) -> bool:
    """Check if a voice is already downloaded."""
    voice = PIPER_VOICES.get(voice_id)
    if not voice:
        return False
    # Check if both .onnx and .onnx.json files exist
    return all((VOICES_DIR / filename).exists() for filename in voice["files"])


def _get_voice_info(voice_id: str) -> dict | None:
    """Get voice info with download status."""
    voice = PIPER_VOICES.get(voice_id)
    if not voice:
        return None

    with _download_lock:
        progress = _download_progress.get(voice_id, {})

    return {
        "id": voice["id"],
        "name": voice["name"],
        "description": voice["description"],
        "size": voice["size"],
        "downloaded": _is_voice_downloaded(voice_id),
        "downloading": progress.get("downloading", False),
        "progress": progress.get("progress", 0),
    }


def _get_configured_voice_id() -> str:
    """Get the configured TTS voice ID from dashboard config."""
    import contextlib

    config_path = Path.home() / ".config" / "home-relay" / "dashboard.json"
    if config_path.exists():
        with contextlib.suppress(Exception):
            config = json.loads(config_path.read_text())
            return config.get("globalSettings", {}).get("ttsVoice", "amy")
    return "amy"


def speak(text: str) -> bool:
    """Speak text using Piper TTS. Returns True on success."""
    if not _is_piper_installed():
        logger.warning("Piper not installed, cannot speak")
        return False

    voice_id = _get_configured_voice_id()
    if not _is_voice_downloaded(voice_id):
        logger.warning("Voice '%s' not downloaded, cannot speak", voice_id)
        return False

    voice = PIPER_VOICES[voice_id]
    model_file = VOICES_DIR / voice["files"][0]  # .onnx file
    piper_bin = PIPER_DIR / "piper"

    try:
        # Pipe text to piper, output to aplay
        process = subprocess.Popen(
            [str(piper_bin), "--model", str(model_file), "--output-raw"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        aplay = subprocess.Popen(
            ["aplay", "-q", "-r", "22050", "-f", "S16_LE", "-t", "raw", "-"],
            stdin=process.stdout,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if process.stdin:
            process.stdin.write(text.encode())
            process.stdin.close()
        aplay.wait()
        return True
    except Exception:
        logger.exception("Failed to speak")
        return False


@router.get("/status", response_model=TTSStatusResponse)
async def tts_status():
    """Get TTS status - is Piper installed, what voice is selected."""
    return TTSStatusResponse(
        installed=_is_piper_installed(),
        selectedVoice=_get_configured_voice_id(),
        voiceReady=_is_voice_downloaded(_get_configured_voice_id()),
    )


@router.get("/voices", response_model=list[VoiceInfo])
async def list_voices():
    """List all available voices with download status."""
    voices = [_get_voice_info(voice_id) for voice_id in PIPER_VOICES]
    return voices


@router.get("/voices/{voice_id}", response_model=VoiceInfo)
async def get_voice(voice_id: str):
    """Get info for a specific voice."""
    info = _get_voice_info(voice_id)
    if not info:
        raise HTTPException(status_code=404, detail="Voice not found")
    return info


@router.post(
    "/voices/{voice_id}/download",
    response_model=Union[AlreadyDownloadedResponse, None],
)
async def download_voice(voice_id: str):
    """Start downloading a voice. Returns SSE stream with progress updates."""
    voice = PIPER_VOICES.get(voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")

    if _is_voice_downloaded(voice_id):
        return AlreadyDownloadedResponse()

    with _download_lock:
        if _download_progress.get(voice_id, {}).get("downloading"):
            raise HTTPException(status_code=409, detail="Download already in progress")

    async def generate():
        """SSE generator for download progress."""
        try:
            with _download_lock:
                _download_progress[voice_id] = {"downloading": True, "progress": 0}

            yield f"data: {json.dumps({'status': 'starting', 'progress': 0})}\n\n"

            # Install Piper binary if not present
            if not _is_piper_installed():
                msg = {"status": "installing_piper", "progress": 0}
                yield f"data: {json.dumps(msg)}\n\n"
                if not await _install_piper():
                    msg = {"status": "error", "error": "Failed to install Piper"}
                    yield f"data: {json.dumps(msg)}\n\n"
                    return

            # Ensure voices directory exists
            VOICES_DIR.mkdir(parents=True, exist_ok=True)

            # Download each file
            total_files = len(voice["files"])
            async with httpx.AsyncClient() as client:
                for i, filename in enumerate(voice["files"]):
                    url = f"{voice['base_url']}/{filename}"
                    file_path = VOICES_DIR / filename

                    logger.info("Downloading voice file %s from %s", filename, url)

                    stream = client.stream("GET", url, follow_redirects=True, timeout=300)
                    async with stream as response:
                        response.raise_for_status()
                        total = int(response.headers.get("content-length", 0))
                        downloaded = 0

                        with file_path.open("wb") as f:
                            async for chunk in response.aiter_bytes(chunk_size=1024 * 1024):
                                f.write(chunk)
                                downloaded += len(chunk)
                                file_progress = (downloaded / total) if total else 0
                                overall = int(((i + file_progress) / total_files) * 100)

                                with _download_lock:
                                    _download_progress[voice_id]["progress"] = overall

                                msg = {"status": "downloading", "progress": overall}
                                yield f"data: {json.dumps(msg)}\n\n"

            logger.info("Voice %s installed successfully", voice_id)
            yield f"data: {json.dumps({'status': 'complete', 'progress': 100})}\n\n"

        except Exception as e:
            logger.exception("Failed to download voice %s", voice_id)
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

            # Clean up partial download
            for filename in voice["files"]:
                file_path = VOICES_DIR / filename
                if file_path.exists():
                    file_path.unlink()

        finally:
            with _download_lock:
                _download_progress.pop(voice_id, None)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/voices/{voice_id}", response_model=DeleteResponse)
async def delete_voice(voice_id: str):
    """Delete a downloaded voice."""
    voice = PIPER_VOICES.get(voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")

    if not _is_voice_downloaded(voice_id):
        raise HTTPException(status_code=404, detail="Voice not downloaded")

    for filename in voice["files"]:
        file_path = VOICES_DIR / filename
        if file_path.exists():
            file_path.unlink()

    logger.info("Deleted voice %s", voice_id)
    return DeleteResponse(status="deleted")


@router.post("/speak", response_model=SpeakResponse)
async def speak_endpoint(req: SpeakRequest):
    """Speak text using TTS."""
    if not req.text:
        raise HTTPException(status_code=400, detail="No text provided")

    success = speak(req.text)
    return SpeakResponse(success=success)

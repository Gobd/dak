"""Vosk model management routes - list, download, and manage speech models."""

import json
import logging
import shutil
import threading
import zipfile
from pathlib import Path

import httpx
from flask import Blueprint, Response, jsonify

logger = logging.getLogger(__name__)
bp = Blueprint("models", __name__, url_prefix="/voice/models")

# Model storage directory
MODELS_DIR = Path(__file__).parent.parent / "models"

# Available Vosk models
VOSK_MODELS = {
    "small": {
        "id": "small",
        "name": "Standard",
        "size": "40MB",
        "description": "Fast, basic accuracy",
        "url": "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
        "dir_name": "vosk-model-small-en-us-0.15",
        "final_name": "vosk-model-small-en-us",
    },
    "medium": {
        "id": "medium",
        "name": "Better",
        "size": "128MB",
        "description": "Balanced speed and accuracy",
        "url": "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip",
        "dir_name": "vosk-model-en-us-0.22-lgraph",
        "final_name": "vosk-model-en-us-lgraph",
    },
    "large": {
        "id": "large",
        "name": "Best",
        "size": "1.8GB",
        "description": "Highest accuracy, slower",
        "url": "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip",
        "dir_name": "vosk-model-en-us-0.22",
        "final_name": "vosk-model-en-us",
    },
}

# Track download progress
_download_progress: dict[str, dict] = {}
_download_lock = threading.Lock()


def _is_model_downloaded(model_id: str) -> bool:
    """Check if a model is already downloaded."""
    model = VOSK_MODELS.get(model_id)
    if not model:
        return False
    model_path = MODELS_DIR / model["final_name"]
    return model_path.exists() and model_path.is_dir()


def _get_model_info(model_id: str) -> dict | None:
    """Get model info with download status."""
    model = VOSK_MODELS.get(model_id)
    if not model:
        return None

    with _download_lock:
        progress = _download_progress.get(model_id, {})

    return {
        "id": model["id"],
        "name": model["name"],
        "size": model["size"],
        "description": model["description"],
        "downloaded": _is_model_downloaded(model_id),
        "downloading": progress.get("downloading", False),
        "progress": progress.get("progress", 0),
    }


@bp.route("", methods=["GET"])
def list_models():
    """List all available models with download status."""
    models = [_get_model_info(model_id) for model_id in VOSK_MODELS]
    return jsonify(models)


@bp.route("/<model_id>", methods=["GET"])
def get_model(model_id: str):
    """Get info for a specific model."""
    info = _get_model_info(model_id)
    if not info:
        return jsonify({"error": "Model not found"}), 404
    return jsonify(info)


@bp.route("/<model_id>/download", methods=["POST"])
def download_model(model_id: str):
    """Start downloading a model. Returns SSE stream with progress updates."""
    model = VOSK_MODELS.get(model_id)
    if not model:
        return jsonify({"error": "Model not found"}), 404

    if _is_model_downloaded(model_id):
        return jsonify({"status": "already_downloaded"})

    with _download_lock:
        if _download_progress.get(model_id, {}).get("downloading"):
            return jsonify({"error": "Download already in progress"}), 409

    def generate():
        """SSE generator for download progress."""
        try:
            with _download_lock:
                _download_progress[model_id] = {"downloading": True, "progress": 0}

            yield f"data: {json.dumps({'status': 'starting', 'progress': 0})}\n\n"

            # Ensure models directory exists
            MODELS_DIR.mkdir(parents=True, exist_ok=True)

            # Download the model
            url = model["url"]
            zip_path = MODELS_DIR / f"{model_id}.zip"

            logger.info("Downloading model %s from %s", model_id, url)

            with httpx.stream("GET", url, follow_redirects=True, timeout=300) as response:
                response.raise_for_status()
                total = int(response.headers.get("content-length", 0))
                downloaded = 0

                with zip_path.open("wb") as f:
                    for chunk in response.iter_bytes(chunk_size=1024 * 1024):  # 1MB chunks
                        f.write(chunk)
                        downloaded += len(chunk)
                        progress = int((downloaded / total) * 100) if total else 0

                        with _download_lock:
                            _download_progress[model_id]["progress"] = progress

                        msg = {"status": "downloading", "progress": progress}
                        yield f"data: {json.dumps(msg)}\n\n"

            yield f"data: {json.dumps({'status': 'extracting', 'progress': 100})}\n\n"

            # Extract the zip
            logger.info("Extracting model %s", model_id)
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(MODELS_DIR)

            # Rename to final name if different
            extracted_path = MODELS_DIR / model["dir_name"]
            final_path = MODELS_DIR / model["final_name"]

            if extracted_path.exists() and extracted_path != final_path:
                if final_path.exists():
                    shutil.rmtree(final_path)
                extracted_path.rename(final_path)

            # Clean up zip file
            zip_path.unlink()

            logger.info("Model %s installed successfully", model_id)
            yield f"data: {json.dumps({'status': 'complete', 'progress': 100})}\n\n"

        except Exception as e:
            logger.exception("Failed to download model %s", model_id)
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

            # Clean up partial download
            zip_path = MODELS_DIR / f"{model_id}.zip"
            if zip_path.exists():
                zip_path.unlink()

        finally:
            with _download_lock:
                _download_progress.pop(model_id, None)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@bp.route("/<model_id>", methods=["DELETE"])
def delete_model(model_id: str):
    """Delete a downloaded model."""
    model = VOSK_MODELS.get(model_id)
    if not model:
        return jsonify({"error": "Model not found"}), 404

    model_path = MODELS_DIR / model["final_name"]
    if not model_path.exists():
        return jsonify({"error": "Model not downloaded"}), 404

    shutil.rmtree(model_path)
    logger.info("Deleted model %s", model_id)

    return jsonify({"status": "deleted"})

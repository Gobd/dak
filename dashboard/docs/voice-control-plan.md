# Voice Control Plan

Fully local voice control for the kiosk RPi. Two components:

1. **Vosk in Chrome keyboard extension** - faster STT for typing
2. **Wake word voice commands** - "hey kiosk add cheese to groceries"

## Hardware

| Item                          | Status   | Notes                                              |
| ----------------------------- | -------- | -------------------------------------------------- |
| ReSpeaker XVF3800 4-Mic Array | ✅ Have  | Far-field, noise cancellation, beamforming         |
| Raspberry Pi (kiosk)          | ✅ Have  | Running Chromium + home-relay                      |
| Speaker for audio feedback    | ❓ Need? | USB speaker (~$10) or HDMI if monitor has speakers |

### Speaker Options (if needed)

| Option           | Price | Link                                           |
| ---------------- | ----- | ---------------------------------------------- |
| HDMI audio       | Free  | Use monitor speakers if available              |
| USB Mini Speaker | ~$10  | [Amazon](https://www.amazon.com/dp/B075M7FHM1) |
| 3.5mm Speaker    | ~$8   | If RPi has audio jack                          |

Test if you already have audio:

```bash
aplay /usr/share/sounds/alsa/Front_Center.wav
```

---

## Part 1: Vosk in Chrome Virtual Keyboard

Replace Whisper with Vosk in `/Users/bkemper/Developer/chrome-virtual-keyboard` for faster STT on RPi.

### Why Switch

|              | Whisper (current) | Vosk (proposed)          |
| ------------ | ----------------- | ------------------------ |
| Speed on RPi | Painfully slow    | Fast                     |
| Accuracy     | Excellent         | Good (fine for commands) |
| Model size   | 41-488MB          | ~50MB                    |

### Install vosk-browser

```bash
cd /Users/bkemper/Developer/chrome-virtual-keyboard
pnpm add vosk-browser
```

Download English model (~50MB):

- https://alphacephei.com/vosk/models
- `vosk-model-small-en-us-0.15` (recommended for RPi)

### New VoiceInput.js (Vosk version)

Replace the Whisper-based `src/voice/VoiceInput.js`:

```js
/**
 * VoiceInput.js - Vosk-based speech-to-text
 * Faster than Whisper on RPi, slightly less accurate
 */

import { createModel, KaldiRecognizer } from 'vosk-browser';

class VoiceInput {
  constructor() {
    this.model = null;
    this.recognizer = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.processor = null;
    this.isRecording = false;
    this.isModelLoaded = false;
    this.onResult = null;
    this.onPartialResult = null;
    this.onStatusChange = null;
  }

  async loadModel(modelPath = 'models/vosk-model-small-en-us') {
    if (this.isModelLoaded) return;

    this._setStatus('loading');

    try {
      this.model = await createModel(modelPath);
      this.isModelLoaded = true;
      this._setStatus('ready');
    } catch (error) {
      this._setStatus('error');
      throw new Error(`Failed to load Vosk model: ${error.message}`);
    }
  }

  async startRecording() {
    if (!this.isModelLoaded) {
      await this.loadModel();
    }

    if (this.isRecording) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create recognizer
      this.recognizer = new KaldiRecognizer(this.model, 16000);

      this.recognizer.on('result', (message) => {
        const text = message.result?.text?.trim();
        if (text && this.onResult) {
          this.onResult(text);
        }
      });

      this.recognizer.on('partialresult', (message) => {
        const partial = message.result?.partial?.trim();
        if (partial && this.onPartialResult) {
          this.onPartialResult(partial);
        }
      });

      // Process audio
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event) => {
        if (this.isRecording && this.recognizer) {
          const audioData = event.inputBuffer.getChannelData(0);
          // Convert Float32Array to Int16Array for Vosk
          const int16Data = new Int16Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
          }
          this.recognizer.acceptWaveform(int16Data);
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isRecording = true;
      this._setStatus('recording');
    } catch (error) {
      this._setStatus('error');
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  async stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;

    // Get final result
    if (this.recognizer) {
      this.recognizer.retrieveFinalResult();
    }

    // Cleanup
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.recognizer) {
      this.recognizer.remove();
      this.recognizer = null;
    }

    this._setStatus('ready');
  }

  _setStatus(status) {
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  destroy() {
    this.stopRecording();
    if (this.model) {
      this.model.terminate();
      this.model = null;
    }
    this.isModelLoaded = false;
  }
}

export default VoiceInput;
```

### Model Placement

Place the Vosk model in the extension:

```
chrome-virtual-keyboard/
  models/
    vosk-model-small-en-us/
      am/
      conf/
      graph/
      ...
```

Update `manifest.json` to include model files as web-accessible resources.

### Usage (same API as before)

```js
const voice = new VoiceInput();

voice.onResult = (text) => {
  console.log('Final:', text);
  // Insert text as keystrokes
};

voice.onPartialResult = (text) => {
  console.log('Partial:', text);
  // Show preview
};

await voice.startRecording();
// ... user speaks ...
await voice.stopRecording();
```

---

## Part 2: Wake Word Voice Commands

Always-listening "hey kiosk" that triggers actions like "add cheese to groceries".

### Architecture

```
ReSpeaker XVF3800 (4-mic array, noise cancellation)
    ↓ clean audio
OpenWakeWord (always listening, ~5% CPU)
    ↓ "hey kiosk" detected
Record 5 seconds of audio
    ↓
Vosk STT (transcribe command)
    ↓
Parse intent: "add cheese to groceries"
    ↓
home-relay → Supabase → notes-app
```

### Dependencies

```bash
# On RPi
pip install openwakeword vosk pyaudio
```

### New file: `services/home-relay/voice_control.py`

```python
"""
Voice control service - wake word + command processing
Runs as separate process, communicates with home-relay via HTTP
"""

import json
import queue
import struct
import threading
import time
from pathlib import Path

import pyaudio
import requests
from openwakeword.model import Model as WakeWordModel
from vosk import Model as VoskModel, KaldiRecognizer

# Configuration
WAKE_WORD = "hey_kiosk"  # Custom trained or use built-in
SAMPLE_RATE = 16000
CHUNK_SIZE = 1280  # 80ms chunks for wake word
COMMAND_DURATION = 5  # seconds to record after wake word
HOME_RELAY_URL = "http://localhost:5111"

# Paths
VOSK_MODEL_PATH = Path(__file__).parent / "models" / "vosk-model-small-en-us"
WAKE_WORD_MODEL_PATH = Path(__file__).parent / "models" / "hey_kiosk.onnx"


class VoiceControl:
    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.running = False

        # Load models
        print("[voice] Loading wake word model...")
        self.wake_model = WakeWordModel(
            wakeword_models=[str(WAKE_WORD_MODEL_PATH)],
            inference_framework="onnx"
        )

        print("[voice] Loading Vosk model...")
        self.vosk_model = VoskModel(str(VOSK_MODEL_PATH))

        print("[voice] Models loaded")

    def start(self):
        """Start listening for wake word."""
        self.running = True

        self.stream = self.audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_SIZE
        )

        print("[voice] Listening for wake word...")

        while self.running:
            try:
                audio_chunk = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)

                # Check for wake word
                audio_array = struct.unpack(f'{CHUNK_SIZE}h', audio_chunk)
                prediction = self.wake_model.predict(audio_array)

                # Check if wake word detected (threshold ~0.5)
                if prediction.get(WAKE_WORD, 0) > 0.5:
                    print("[voice] Wake word detected!")
                    self._handle_command()

            except Exception as e:
                print(f"[voice] Error: {e}")
                time.sleep(0.1)

    def _handle_command(self):
        """Record and process command after wake word."""
        print("[voice] Recording command...")

        # Record for COMMAND_DURATION seconds
        frames = []
        for _ in range(0, int(SAMPLE_RATE / CHUNK_SIZE * COMMAND_DURATION)):
            data = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)
            frames.append(data)

        # Transcribe with Vosk
        recognizer = KaldiRecognizer(self.vosk_model, SAMPLE_RATE)

        for frame in frames:
            recognizer.AcceptWaveform(frame)

        result = json.loads(recognizer.FinalResult())
        text = result.get("text", "").strip()

        print(f"[voice] Transcribed: {text}")

        if text:
            self._execute_command(text)

    def _execute_command(self, text: str):
        """Parse and execute voice command."""
        text_lower = text.lower()

        # Parse "add X to Y" pattern
        if "add" in text_lower and "to" in text_lower:
            try:
                # Extract item and list name
                parts = text_lower.split("add", 1)[1]
                item_part, list_part = parts.split("to", 1)
                item = item_part.strip()
                list_name = list_part.strip()

                print(f"[voice] Adding '{item}' to '{list_name}'")

                # Call home-relay endpoint
                response = requests.post(
                    f"{HOME_RELAY_URL}/voice/add-to-list",
                    json={"item": item, "list": list_name}
                )

                if response.ok:
                    print(f"[voice] Success!")
                    # TODO: Play confirmation sound
                else:
                    print(f"[voice] Failed: {response.text}")

            except Exception as e:
                print(f"[voice] Parse error: {e}")
        else:
            print(f"[voice] Unknown command: {text}")

    def stop(self):
        """Stop listening."""
        self.running = False
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.audio.terminate()


def main():
    vc = VoiceControl()
    try:
        vc.start()
    except KeyboardInterrupt:
        print("\n[voice] Stopping...")
        vc.stop()


if __name__ == "__main__":
    main()
```

### New file: `services/home-relay/routes/voice.py`

```python
"""
Voice command routes - handles parsed voice commands
"""

from flask import Blueprint, jsonify, request

from lib.supabase import get_supabase_client

voice_bp = Blueprint("voice", __name__, url_prefix="/voice")


@voice_bp.route("/add-to-list", methods=["POST"])
def add_to_list():
    """
    Add item to a note/list.
    Body: { "item": "cheese", "list": "groceries" }
    """
    data = request.get_json()
    item = data.get("item")
    list_name = data.get("list")

    if not item or not list_name:
        return jsonify({"error": "Missing item or list"}), 400

    try:
        supabase = get_supabase_client()

        # Find note where first line matches list name (case-insensitive)
        # This is a simple approach - could be smarter with fuzzy matching
        result = supabase.table("notes") \
            .select("id, content") \
            .is_("trashed_at", None) \
            .execute()

        target_note = None
        for note in result.data:
            content = note.get("content", "") or ""
            first_line = content.split("\n")[0].strip().lower()
            # Strip markdown heading markers
            first_line = first_line.lstrip("#").strip()

            if list_name.lower() in first_line:
                target_note = note
                break

        if not target_note:
            return jsonify({"error": f"List '{list_name}' not found"}), 404

        # Append item as checkbox
        new_content = target_note["content"].rstrip() + f"\n- [ ] {item}"

        # Update note
        supabase.table("notes") \
            .update({"content": new_content}) \
            .eq("id", target_note["id"]) \
            .execute()

        return jsonify({
            "success": True,
            "item": item,
            "list": list_name,
            "note_id": target_note["id"]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@voice_bp.route("/status", methods=["GET"])
def status():
    """Check voice control status."""
    # Could check if voice_control.py process is running
    return jsonify({"status": "ok"})
```

### New file: `services/home-relay/lib/supabase.py`

```python
"""
Supabase client for home-relay
"""

import os
from functools import lru_cache

from supabase import create_client, Client


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """Get cached Supabase client."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")  # Use service key for server-side

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

    return create_client(url, key)
```

### Update: `services/home-relay/relay.py`

```python
# Add import
from routes.voice import voice_bp

# Register blueprint
app.register_blueprint(voice_bp)
```

### Update: `services/home-relay/pyproject.toml`

```toml
dependencies = [
    # ... existing ...
    "supabase>=2.0.0",
    "openwakeword>=0.5.0",
    "vosk>=0.3.45",
    "pyaudio>=0.2.14",
]
```

### Systemd Service: `voice-control.service`

```ini
[Unit]
Description=Voice Control Service
After=network.target home-relay.service
Requires=home-relay.service

[Service]
Type=simple
User=kiosk
WorkingDirectory=/home/kiosk/dashboard/services/home-relay
ExecStart=/home/kiosk/.local/bin/uv run python voice_control.py
Restart=on-failure
RestartSec=5
Environment=SUPABASE_URL=your-supabase-url
Environment=SUPABASE_SERVICE_KEY=your-service-key

[Install]
WantedBy=multi-user.target
```

---

## Training Custom Wake Word "hey kiosk"

### Option A: OpenWakeWord (recommended)

1. Record ~50-100 samples of yourself saying "hey kiosk"
2. Use OpenWakeWord training notebook: https://github.com/dscripka/openWakeWord
3. Export to ONNX format

### Option B: Use similar built-in wake word

OpenWakeWord has pre-trained models like "hey jarvis", "alexa", etc. Could use one temporarily while training custom.

---

## Setup Script: `scripts/voice-setup.sh`

```bash
#!/bin/bash
# Voice control setup for kiosk
# Run after main kiosk-setup.sh

set -e

echo "=== Installing voice control dependencies ==="

# System deps for PyAudio
sudo apt-get update
sudo apt-get install -y portaudio19-dev python3-pyaudio

# Python deps
cd ~/dashboard/services/home-relay
uv add openwakeword vosk pyaudio supabase

echo "=== Downloading Vosk model ==="
mkdir -p models
cd models
if [ ! -d "vosk-model-small-en-us-0.15" ]; then
  wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
  unzip vosk-model-small-en-us-0.15.zip
  mv vosk-model-small-en-us-0.15 vosk-model-small-en-us
  rm vosk-model-small-en-us-0.15.zip
fi

echo "=== Installing voice control service ==="
sudo cp ~/dashboard/services/home-relay/voice-control.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable voice-control

echo ""
echo "=== Voice control setup complete ==="
echo ""
echo "Next steps:"
echo "1. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in voice-control.service"
echo "2. Train or download 'hey kiosk' wake word model"
echo "3. Place model at ~/dashboard/services/home-relay/models/hey_kiosk.onnx"
echo "4. sudo systemctl start voice-control"
echo ""
echo "Test with: 'hey kiosk add cheese to groceries'"
```

---

## Testing

```bash
# Test Vosk manually
python -c "
from vosk import Model, KaldiRecognizer
import pyaudio
import json

model = Model('models/vosk-model-small-en-us')
rec = KaldiRecognizer(model, 16000)

p = pyaudio.PyAudio()
stream = p.open(format=pyaudio.paInt16, channels=1, rate=16000, input=True, frames_per_buffer=8000)
stream.start_stream()

print('Say something...')
while True:
    data = stream.read(4000, exception_on_overflow=False)
    if rec.AcceptWaveform(data):
        result = json.loads(rec.Result())
        print('Result:', result.get('text', ''))
"

# Test voice command endpoint
curl -X POST http://localhost:5111/voice/add-to-list \
  -H "Content-Type: application/json" \
  -d '{"item": "cheese", "list": "groceries"}'
```

---

## Summary

| Component        | Location                                          | Purpose                          |
| ---------------- | ------------------------------------------------- | -------------------------------- |
| Vosk in keyboard | `chrome-virtual-keyboard/src/voice/VoiceInput.js` | Faster STT for typing            |
| OpenWakeWord     | `home-relay/voice_control.py`                     | Always listening for "hey kiosk" |
| Vosk STT         | `home-relay/voice_control.py`                     | Transcribe commands after wake   |
| Voice routes     | `home-relay/routes/voice.py`                      | Execute parsed commands          |
| Supabase client  | `home-relay/lib/supabase.py`                      | Add items to notes-app           |

**Flow:**

```
"Hey kiosk add cheese to groceries"
    ↓
ReSpeaker mic (clean audio)
    ↓
OpenWakeWord (detects "hey kiosk")
    ↓
Vosk (transcribes "add cheese to groceries")
    ↓
home-relay parses command
    ↓
Supabase → notes-app (appends "- [ ] cheese")
```

---

## Extensible Command System

No AI needed - just pattern matching for pre-coded phrases. Easy to add new commands.

### Command Registry

**Update `voice_control.py` with command patterns:**

```python
"""
Voice commands - add new patterns here
Each command has:
  - patterns: list of regex patterns to match
  - handler: function to execute
  - help: description for help widget
"""

import re
from dataclasses import dataclass
from typing import Callable, List, Optional

@dataclass
class VoiceCommand:
    name: str
    patterns: List[str]
    handler: Callable[[dict], dict]
    help_text: str
    examples: List[str]


# Global command registry
COMMANDS: List[VoiceCommand] = []


def register_command(name: str, patterns: List[str], help_text: str, examples: List[str]):
    """Decorator to register a voice command."""
    def decorator(func):
        COMMANDS.append(VoiceCommand(
            name=name,
            patterns=[re.compile(p, re.IGNORECASE) for p in patterns],
            handler=func,
            help_text=help_text,
            examples=examples
        ))
        return func
    return decorator


def parse_command(text: str) -> Optional[tuple[VoiceCommand, dict]]:
    """Match text against registered commands."""
    for cmd in COMMANDS:
        for pattern in cmd.patterns:
            match = pattern.search(text)
            if match:
                return cmd, match.groupdict()
    return None


# ============== COMMANDS ==============

@register_command(
    name="add_to_list",
    patterns=[
        r"add (?P<item>.+?) to (?P<list>\w+)",
        r"put (?P<item>.+?) on (?P<list>\w+)",
    ],
    help_text="Add item to a list",
    examples=["add cheese to groceries", "put milk on shopping"]
)
def cmd_add_to_list(params: dict) -> dict:
    item = params["item"]
    list_name = params["list"]
    # Call home-relay endpoint
    response = requests.post(f"{HOME_RELAY_URL}/voice/add-to-list",
                            json={"item": item, "list": list_name})
    return {"success": response.ok, "message": f"Added {item} to {list_name}"}


@register_command(
    name="climate_compare",
    patterns=[
        r"(is it|what's?) (warmer|cooler|hotter|colder) (outside|inside)",
        r"(warmer|cooler|hotter|colder) (outside|inside)",
        r"how (warm|cold|hot) is it (outside|inside)",
        r"(outside|inside) temperature",
    ],
    help_text="Compare indoor vs outdoor temperature",
    examples=["is it warmer outside", "what's the temperature inside"]
)
def cmd_climate_compare(params: dict) -> dict:
    response = requests.get(f"{HOME_RELAY_URL}/sensors/all")
    if not response.ok:
        return {"success": False, "message": "Sensor data unavailable"}

    data = response.json()
    indoor = data.get("indoor", {})
    outdoor = data.get("outdoor", {})
    comparison = data.get("comparison", {})

    if comparison.get("outside_feels_cooler"):
        msg = f"Outside is {abs(comparison['difference'])} degrees cooler"
    elif comparison.get("outside_feels_warmer"):
        msg = f"Outside is {comparison['difference']} degrees warmer"
    else:
        msg = "Inside and outside feel about the same"

    return {"success": True, "message": msg, "speak": msg}


@register_command(
    name="turn_on_off",
    patterns=[
        r"turn (?P<action>on|off) (the )?(?P<device>.+)",
        r"(?P<device>.+) (?P<action>on|off)",
    ],
    help_text="Turn Kasa devices on/off",
    examples=["turn on the lamp", "turn off bedroom light"]
)
def cmd_turn_on_off(params: dict) -> dict:
    device = params["device"]
    action = params["action"]
    # Would call Kasa endpoints
    response = requests.post(f"{HOME_RELAY_URL}/kasa/toggle",
                            json={"device": device, "state": action == "on"})
    return {"success": response.ok, "message": f"Turned {action} {device}"}


@register_command(
    name="weather",
    patterns=[
        r"what's the weather",
        r"weather (today|tomorrow|forecast)",
        r"is it (going to )?(rain|snow)",
    ],
    help_text="Get weather info",
    examples=["what's the weather", "is it going to rain"]
)
def cmd_weather(params: dict) -> dict:
    # Could fetch from weather widget data
    return {"success": True, "message": "Weather feature coming soon"}


@register_command(
    name="help",
    patterns=[
        r"(what can you do|help|commands|what can i (say|ask))",
    ],
    help_text="List available commands",
    examples=["what can you do", "help"]
)
def cmd_help(params: dict) -> dict:
    help_lines = ["You can say:"]
    for cmd in COMMANDS:
        if cmd.name != "help":
            help_lines.append(f"  • {cmd.examples[0]}")
    return {"success": True, "message": "\n".join(help_lines)}


# ============== EXECUTE ==============

def execute_command(text: str) -> dict:
    """Parse and execute a voice command."""
    result = parse_command(text)

    if result is None:
        return {"success": False, "message": f"Unknown command: {text}"}

    cmd, params = result
    print(f"[voice] Matched command: {cmd.name} with params: {params}")

    try:
        return cmd.handler(params)
    except Exception as e:
        return {"success": False, "message": str(e)}
```

### Available Commands

| Command     | Examples                  | Action                            |
| ----------- | ------------------------- | --------------------------------- |
| Add to list | "add cheese to groceries" | Appends `- [ ] item` to note      |
| Climate     | "is it warmer outside"    | Returns indoor/outdoor comparison |
| Devices     | "turn on the lamp"        | Toggles Kasa device               |
| Weather     | "what's the weather"      | Gets forecast                     |
| Help        | "what can you do"         | Lists commands                    |

Easy to add more - just add a `@register_command` decorated function.

---

## Help Widget for Dashboard

Show available voice commands on the main screen.

### New file: `src/components/widgets/VoiceHelp.tsx`

```tsx
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { useConfigStore } from '../../stores/config-store';
import type { Panel } from '../../types';

interface VoiceCommand {
  name: string;
  help_text: string;
  examples: string[];
}

export default function VoiceHelp({ panel }: { panel: Panel }) {
  const relayUrl = useConfigStore((s) => s.relayUrl);

  const { data } = useWidgetQuery<{ commands: VoiceCommand[] }>(
    ['voice-commands'],
    async () => {
      const res = await fetch(`${relayUrl}/voice/commands`);
      return res.json();
    },
    { enabled: !!relayUrl, staleTime: Infinity }
  );

  const commands = data?.commands || [];

  return (
    <div className="p-3 h-full">
      <div className="text-sm font-medium text-gray-400 mb-2">🎤 Say "Hey Kiosk" then...</div>
      <div className="space-y-1 text-xs">
        {commands.map((cmd) => (
          <div key={cmd.name} className="text-gray-300">
            "{cmd.examples[0]}"
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Mini version for calendar header

```tsx
// Single line hint
export function VoiceHelpMini() {
  return <div className="text-xs text-gray-500 px-2">🎤 "Hey Kiosk, add X to groceries"</div>;
}
```

### API endpoint for commands list

**Add to `routes/voice.py`:**

```python
@voice_bp.route("/commands", methods=["GET"])
def list_commands():
    """List available voice commands for help widget."""
    from voice_control import COMMANDS

    return jsonify({
        "commands": [
            {
                "name": cmd.name,
                "help_text": cmd.help_text,
                "examples": cmd.examples
            }
            for cmd in COMMANDS
            if cmd.name != "help"  # Don't show meta command
        ]
    })
```

---

## Audio Feedback (Optional)

Play sounds when wake word detected or command executed.

```python
# In voice_control.py
import subprocess

def play_sound(sound_name: str):
    """Play feedback sound."""
    sounds = {
        "wake": "/home/kiosk/dashboard/sounds/wake.wav",
        "success": "/home/kiosk/dashboard/sounds/success.wav",
        "error": "/home/kiosk/dashboard/sounds/error.wav",
    }
    path = sounds.get(sound_name)
    if path:
        subprocess.Popen(["aplay", "-q", path])

# Usage:
# Wake word detected → play_sound("wake")
# Command success → play_sound("success")
```

---

## Future Command Ideas

| Command    | Pattern                   | Action                        |
| ---------- | ------------------------- | ----------------------------- |
| Timer      | "set timer for 5 minutes" | Dashboard countdown           |
| Brightness | "dim the screen"          | Adjust display brightness     |
| Screen     | "show weather screen"     | Switch dashboard screens      |
| Reminder   | "remind me to X at Y"     | Add timed notification        |
| Music      | "play music"              | Control media (if integrated) |

Just add more `@register_command` decorated functions!

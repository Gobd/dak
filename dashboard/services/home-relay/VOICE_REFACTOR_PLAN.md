# Voice Refactor Plan

## Goal

Decouple Vosk (speech-to-text) from openwakeword so users can have:
- **Button only**: Push-to-talk in dashboard, no always-on mic
- **Wake word only**: Hands-free with openwakeword
- **Both**: Wake word + button

## Architecture

```
┌─────────────────────────────────────────────┐
│  relay.py                                   │
│  - POST /voice/transcribe (Vosk STT)        │
│  - POST /voice/transcribe-and-execute       │
│  - POST /voice/command (execute parsed cmd) │
│  - All other routes (kasa, wol, etc)        │
└─────────────────────────────────────────────┘
        ▲                           ▲
        │                           │
   [Dashboard]              [voice_control.py]
   Push-to-talk              Wake word mode
   button                    (optional service)
```

## Backend Changes

### 1. Add Vosk to relay.py

Move Vosk model loading into relay.py (or a new `routes/transcribe.py`):

```python
from vosk import Model as VoskModel, KaldiRecognizer

VOSK_MODEL_PATH = Path(__file__).parent / "models" / "vosk-model-small-en-us"
vosk_model = None

def get_vosk_model():
    global vosk_model
    if vosk_model is None and VOSK_MODEL_PATH.exists():
        vosk_model = VoskModel(str(VOSK_MODEL_PATH))
    return vosk_model
```

### 2. New endpoint: POST /voice/transcribe

Accepts audio, returns transcription:

```python
@bp.route("/transcribe", methods=["POST"])
def transcribe():
    audio_data = request.data  # Raw PCM or WAV

    model = get_vosk_model()
    if not model:
        return jsonify({"error": "Vosk model not installed"}), 503

    recognizer = KaldiRecognizer(model, 16000)
    recognizer.AcceptWaveform(audio_data)
    result = json.loads(recognizer.FinalResult())

    return jsonify({"text": result.get("text", "")})
```

### 3. New endpoint: POST /voice/transcribe-and-execute

Transcribe + run through command parser:

```python
@bp.route("/transcribe-and-execute", methods=["POST"])
def transcribe_and_execute():
    # Transcribe
    text = _transcribe(request.data)

    # Parse command (reuse existing logic from voice_control.py)
    result = parse_command(text)
    if not result:
        return jsonify({"text": text, "error": "Unknown command"})

    cmd, params = result
    response = cmd.handler(params)

    return jsonify({
        "text": text,
        "command": cmd.name,
        "result": response
    })
```

### 4. Audio streaming via WebSocket

Stream audio in real-time for faster response. Server detects silence and stops early.

**Backend**: New WebSocket endpoint `/voice/stream`

```python
# routes/transcribe.py
from flask_sock import Sock

sock = Sock(app)

@sock.route("/voice/stream")
def stream_transcribe(ws):
    recognizer = KaldiRecognizer(get_vosk_model(), 16000)
    start = time.time()
    MAX_DURATION = 6

    while time.time() - start < MAX_DURATION:
        data = ws.receive(timeout=0.1)
        if data is None:
            continue
        if data == b"STOP":  # User tapped stop
            break
        if recognizer.AcceptWaveform(data):
            break  # Silence detected

    result = json.loads(recognizer.FinalResult())
    text = result.get("text", "")

    # Execute command
    cmd_result = execute_command(text) if text else None

    ws.send(json.dumps({
        "text": text,
        "command": cmd_result
    }))
```

**Frontend**: Toggle button, stream PCM chunks

```typescript
function PushToTalk() {
  const [recording, setRecording] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const toggle = async () => {
    if (recording) {
      // Stop recording
      wsRef.current?.send("STOP");
      processorRef.current?.disconnect();
      setRecording(false);
      return;
    }

    // Start recording - browser gives us whatever sample rate it wants (usually 44.1k/48k)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const nativeSampleRate = audioCtx.sampleRate;

    const ws = new WebSocket("ws://localhost:5111/voice/stream");
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const result = JSON.parse(e.data);
      // Handle result, show feedback
      setRecording(false);
      source.disconnect();
      stream.getTracks().forEach(t => t.stop());
    };

    // Use AudioWorklet for processing (ScriptProcessor is deprecated)
    await audioCtx.audioWorklet.addModule('/audio-processor.js');
    const processor = new AudioWorkletNode(audioCtx, 'audio-processor');
    processorRef.current = processor;

    processor.port.onmessage = (e) => {
      const float32 = e.data;
      // Resample from native rate to 16kHz
      const resampled = resample(float32, nativeSampleRate, 16000);
      // Convert to int16
      const int16 = new Int16Array(resampled.length);
      for (let i = 0; i < resampled.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, resampled[i] * 32768));
      }
      ws.send(int16.buffer);
    };

    source.connect(processor);
    setRecording(true);
  };

  return (
    <button onClick={toggle}>
      {recording ? "Stop" : "🎤"}
    </button>
  );
}

// Simple linear interpolation resampler
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const low = Math.floor(srcIdx);
    const high = Math.min(low + 1, input.length - 1);
    const frac = srcIdx - low;
    output[i] = input[low] * (1 - frac) + input[high] * frac;
  }
  return output;
}
```

**Benefits**:
- Toggle mode: tap to start, tap to stop
- Streams audio chunks in real-time
- Server stops on silence detection OR 6 second max OR user tap
- No waiting for full recording before processing

### 5. Simplify voice_control.py

After wake word detection, POST audio to relay instead of running Vosk locally:

```python
def _handle_command(self):
    # Record audio
    frames = self._record_audio(COMMAND_DURATION)
    audio_data = b"".join(frames)

    # Send to relay for transcription + execution
    response = requests.post(
        f"{HOME_RELAY_URL}/voice/transcribe-and-execute",
        data=audio_data,
        headers={"Content-Type": "audio/raw"},
        timeout=10,
    )

    if response.ok:
        result = response.json()
        if result.get("result", {}).get("success"):
            play_sound("success")
        else:
            play_sound("error")
```

## Frontend Changes

### 1. Mic button component

```typescript
function PushToTalk() {
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      // Convert to WAV or send as-is if backend handles conversion
      const response = await fetch("/voice/transcribe-and-execute", {
        method: "POST",
        body: blob,
      });
      const result = await response.json();
      // Show feedback
    };

    mediaRecorder.current.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  return (
    <button
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
    >
      {recording ? "Listening..." : "🎤"}
    </button>
  );
}
```

### 2. Settings toggle

Add to dashboard settings:
- "Enable push-to-talk button" (shows/hides mic button)
- Existing "Enable wake word" (controls voice_control.py service)

## Dependencies

### pyproject.toml changes
```toml
dependencies = [
    # ... existing ...
    "vosk>=0.3.45",      # Speech-to-text (moved from voice group)
    "flask-sock>=0.7.0", # WebSocket support for streaming
    "httpx>=0.27.0",     # HTTP client (replaces requests)
]
```

No ffmpeg, no pydub - browser streams raw PCM, Vosk reads it directly.

## Migration Steps

1. Add Vosk to main relay dependencies
2. Create `/voice/transcribe` and `/voice/transcribe-and-execute` endpoints
3. Add command parser to relay (extract from voice_control.py)
4. Add push-to-talk button to dashboard
5. Update voice_control.py to use relay's transcribe endpoint
6. Test both modes independently

## Files to Modify

- `services/home-relay/pyproject.toml` - add vosk to main deps, replace requests with httpx
- `services/home-relay/relay.py` - or new `routes/transcribe.py`
- `services/home-relay/voice_control.py` - simplify to just wake word + POST, use httpx
- `services/home-relay/commands.py` - extract command registry (shared)
- `scripts/kiosk-setup.sh` - remove wget from packages (line 58), change wget to curl for Vosk download (line 252)
- Dashboard: new PushToTalk component

## Code Style Preferences

- Use `httpx` instead of `requests` for HTTP client
- Use `curl` instead of `wget` in shell scripts

## Setup Script

The main setup is in `scripts/kiosk-setup.sh` (lines 237-288). It installs everything
unconditionally - this is good. Just need to add `ffmpeg` for push-to-talk audio conversion.

### What gets installed

Everything - no choices during setup:

| Component | Installed |
|-----------|-----------|
| Vosk model (~50MB) | ✅ |
| openwakeword | ✅ |
| pyaudio | ✅ |
| voice-control.service | ✅ |

Note: No ffmpeg needed - browser streams raw PCM directly to server via WebSocket.

### Dashboard settings

| Feature | Default | Toggle needed? |
|---------|---------|----------------|
| Push-to-talk | **Always on** | No - mic button always available |
| Wake word | Off | Yes - opt-in (always-listening is invasive) |

Push-to-talk just works after setup. Wake word requires enabling in Settings because
it's constantly listening on the Pi's microphone.

### Service behavior pattern

Keep the current pattern where services are always installed/enabled, but check dashboard
settings on startup and exit if disabled:

```python
# voice_control.py - current pattern (keep this)
def fetch_config(self) -> bool:
    config = requests.get(f"{HOME_RELAY_URL}/config").json()
    if not config.get("globalSettings", {}).get("voiceEnabled", False):
        logger.info("Voice control is disabled in settings")
        return False  # Exit immediately
    return True
```

This is nice because:
- Systemd always starts the service (simple setup)
- User controls it via dashboard toggle (no SSH needed)
- Service restarts every few seconds (RestartSec=5), checks config, exits if disabled
- When user enables toggle, service picks it up on next restart cycle

Same pattern should apply to push-to-talk - always available in relay, but button only
shows in dashboard if "pushToTalkEnabled" is true in settings.

### Changes to kiosk-setup.sh

Keep the current approach: **install everything unconditionally**. Users control what's
active via dashboard toggles, not by installing/uninstalling deps.

The existing voice setup (lines 237-288) stays mostly the same. Just:
- Remove `wget` from packages (line 58)
- Change `wget` to `curl` for Vosk download (line 252)

No ffmpeg needed - browser handles WAV encoding.

### Why install everything

- **Simple setup**: One path, no questions, no confusion
- **Easy toggling**: User can enable/disable voice features anytime without SSH
- **Disk space is cheap**: Full voice deps are ~100MB total (Vosk model + libs)
- **No partial states**: Avoids "I enabled push-to-talk but it says Vosk not installed"

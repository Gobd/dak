/**
 * AudioWorklet processor for capturing and resampling microphone audio.
 * Converts from browser's native sample rate to 16kHz mono int16 PCM for Vosk.
 */

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  /**
   * Simple linear interpolation resampler.
   */
  resample(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
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

  /**
   * Convert float32 samples to int16 PCM.
   */
  floatToInt16(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputChannel = input[0];

    // Accumulate samples into buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];

      // When buffer is full, process and send
      if (this.bufferIndex >= this.bufferSize) {
        // Resample from native rate (usually 44100 or 48000) to 16000
        const resampled = this.resample(this.buffer, sampleRate, 16000);

        // Convert to int16 PCM
        const pcm = this.floatToInt16(resampled);

        // Send to main thread
        this.port.postMessage(pcm.buffer, [pcm.buffer]);

        // Reset buffer
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);

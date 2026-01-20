/**
 * Relay Client Wrapper
 *
 * Provides typed access to home-relay SSE and WebSocket endpoints
 * that aren't handled by the auto-generated OpenAPI client.
 *
 * For REST endpoints, use the generated client from ./generated/sdk.gen
 */

// Re-export generated client for convenience
export * from './generated/sdk.gen';
export * from './generated/types.gen';

const RELAY_BASE_URL = 'http://relay:5111';

/**
 * Config update SSE event
 */
export interface ConfigUpdateEvent {
  type: 'config-updated' | 'connected';
  saveId?: string;
}

/**
 * Voice command SSE event
 */
export interface VoiceCommandEvent {
  type: string;
  item?: string;
  list?: string;
  text?: string;
  command?: string;
  [key: string]: unknown;
}

/**
 * Subscribe to config updates via SSE.
 * Returns an EventSource that emits ConfigUpdateEvent messages.
 */
export function subscribeToConfig(
  onMessage: (event: ConfigUpdateEvent) => void,
  onError?: (error: Event) => void
): EventSource {
  const source = new EventSource(`${RELAY_BASE_URL}/config/subscribe`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as ConfigUpdateEvent;
      onMessage(data);
    } catch {
      console.error('Failed to parse config event:', event.data);
    }
  };

  if (onError) {
    source.onerror = onError;
  }

  return source;
}

/**
 * Subscribe to voice commands via SSE.
 * Returns an EventSource that emits VoiceCommandEvent messages.
 */
export function subscribeToVoiceCommands(
  onMessage: (event: VoiceCommandEvent) => void,
  onError?: (error: Event) => void
): EventSource {
  const source = new EventSource(`${RELAY_BASE_URL}/voice/subscribe`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as VoiceCommandEvent;
      onMessage(data);
    } catch {
      console.error('Failed to parse voice event:', event.data);
    }
  };

  if (onError) {
    source.onerror = onError;
  }

  return source;
}

/**
 * WebSocket message from voice stream
 */
export interface VoiceStreamResult {
  type: 'result' | 'error';
  text?: string;
  command?: string;
  result?: {
    success: boolean;
    message?: string;
    speak?: string;
  };
  error?: string;
}

/**
 * Create a voice transcription WebSocket connection.
 *
 * Usage:
 *   const ws = createVoiceStream(
 *     (result) => console.log('Transcription:', result),
 *     () => console.log('Connected'),
 *     (error) => console.error('Error:', error)
 *   );
 *
 *   // Send raw PCM audio chunks (16kHz, mono, 16-bit)
 *   ws.send(audioBuffer);
 *
 *   // Stop early
 *   ws.send('STOP');
 */
export function createVoiceStream(
  onResult: (result: VoiceStreamResult) => void,
  onOpen?: () => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket {
  const ws = new WebSocket(`ws://relay:5111/voice/stream`);

  ws.onopen = () => {
    onOpen?.();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as VoiceStreamResult;
      onResult(data);
    } catch {
      console.error('Failed to parse voice stream message:', event.data);
    }
  };

  ws.onerror = (error) => {
    onError?.(error);
  };

  ws.onclose = () => {
    onClose?.();
  };

  return ws;
}

/**
 * Subscribe to model download progress via SSE.
 * Returns a function to abort the download.
 */
export function subscribeToModelDownload(
  modelId: string,
  onProgress: (status: string, progress: number, error?: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
): () => void {
  const controller = new AbortController();

  fetch(`${RELAY_BASE_URL}/voice/models/${modelId}/download`, {
    method: 'POST',
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        onError?.(text);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onProgress(data.status, data.progress, data.error);
              if (data.status === 'complete') {
                onComplete?.();
              } else if (data.status === 'error') {
                onError?.(data.error);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        onError?.(error.message);
      }
    });

  return () => controller.abort();
}

/**
 * Subscribe to voice download progress via SSE.
 * Returns a function to abort the download.
 */
export function subscribeToVoiceDownload(
  voiceId: string,
  onProgress: (status: string, progress: number, error?: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
): () => void {
  const controller = new AbortController();

  fetch(`${RELAY_BASE_URL}/voice/tts/voices/${voiceId}/download`, {
    method: 'POST',
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        onError?.(text);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onProgress(data.status, data.progress, data.error);
              if (data.status === 'complete') {
                onComplete?.();
              } else if (data.status === 'error') {
                onError?.(data.error);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        onError?.(error.message);
      }
    });

  return () => controller.abort();
}

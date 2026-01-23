/**
 * Push-to-Talk widget - single button for voice input.
 * Streams raw PCM audio to relay server while button is held.
 * Uses AudioWorklet for audio processing (no deprecated APIs).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getRelayUrl, useConfigStore } from '../../stores/config-store';
import { useVoiceResponseStore } from '../../stores/voice-response-store';
import { client, healthHealthGet } from '@dak/api-client';

const DEFAULT_MAX_DURATION = 10; // seconds

async function checkRelayHealth(url: string): Promise<boolean> {
  try {
    client.setConfig({ baseUrl: url });
    await healthHealthGet({ throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

export default function Ptt() {
  const relayUrl = getRelayUrl();
  const maxDuration =
    useConfigStore((s) => s.globalSettings?.maxRecordingDuration) ?? DEFAULT_MAX_DURATION;
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Check relay health
  const { data: relayUp } = useQuery({
    queryKey: ['relay-health', relayUrl],
    queryFn: () => checkRelayHealth(relayUrl!),
    enabled: !!relayUrl,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const showResponse = useVoiceResponseStore((s) => s.showResponse);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('STOP');
      wsRef.current.close();
    }
    wsRef.current = null;

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setTimeLeft(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (!relayUrl) {
      setError('No relay URL configured');
      return;
    }

    setError(null);

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Load AudioWorklet processor
      await audioContext.audioWorklet.addModule('/audio-processor.js');

      // Connect WebSocket to relay
      const wsUrl = relayUrl.replace(/^http/, 'ws') + '/voice/stream';
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        // Create audio processing chain
        const source = audioContext.createMediaStreamSource(stream);

        // Create AudioWorklet node
        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
        workletNodeRef.current = workletNode;

        // Receive processed PCM from worklet and send to WebSocket
        workletNode.port.onmessage = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        // Connect: mic -> worklet
        source.connect(workletNode);

        setIsRecording(true);
        startTimeRef.current = Date.now();
        setTimeLeft(maxDuration);

        // Start countdown timer
        timerRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const remaining = Math.max(0, maxDuration - elapsed);
          setTimeLeft(Math.ceil(remaining));

          if (remaining <= 0) {
            stopRecording();
          }
        }, 100);
      };

      ws.onmessage = (event) => {
        // Handle response from voice server
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'result') {
            // Stop recording when we get a result
            stopRecording();
            if (data.text) {
              window.dispatchEvent(
                new CustomEvent('voice-command', {
                  detail: { text: data.text, command: data.command, result: data.result },
                }),
              );
            }
            // Show response modal if result has speak text
            const speakText = data.result?.speak || data.result?.message;
            if (speakText) {
              showResponse(speakText, data.command);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        setError('Connection failed');
        stopRecording();
      };

      ws.onclose = () => {
        stopRecording();
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone access denied';
      setError(message);
      stopRecording();
    }
  }, [relayUrl, maxDuration, stopRecording, showResponse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const relayOffline = !!relayUrl && relayUp === false;

  return (
    <div className="h-full flex flex-col items-center justify-center p-2">
      {/* Main PTT button */}
      <button
        onClick={handleClick}
        disabled={!relayUrl || relayOffline}
        className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
          isRecording
            ? 'bg-danger scale-110 shadow-lg shadow-red-500/50'
            : relayUrl && !relayOffline
              ? 'bg-accent hover:bg-accent active:scale-95'
              : 'bg-border cursor-not-allowed'
        }`}
      >
        {isRecording ? (
          <Mic className="w-8 h-8 text-text animate-pulse" />
        ) : (
          <Mic className="w-8 h-8 text-text" />
        )}

        {/* Relay offline indicator */}
        {relayOffline && <AlertCircle size={14} className="absolute -top-1 -right-1 text-danger" />}

        {/* Countdown ring */}
        {isRecording && (
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="white"
              strokeWidth="3"
              opacity="0.3"
            />
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeDasharray={`${(timeLeft / maxDuration) * 188.5} 188.5`}
            />
          </svg>
        )}
      </button>

      {/* Status text - only show errors or countdown */}
      {(error || isRecording) && (
        <div className="mt-2 text-xs text-center">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : (
            <span className="text-danger">{timeLeft}s</span>
          )}
        </div>
      )}
    </div>
  );
}

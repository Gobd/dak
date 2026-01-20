/**
 * Push-to-Talk widget - single button for voice input.
 * Streams audio to relay server while button is held.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Settings } from 'lucide-react';
import { Modal, Button, Roller } from '@dak/ui';
import { getRelayUrl, useConfigStore } from '../../stores/config-store';
import type { WidgetComponentProps } from './index';

const MAX_DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30];

interface PttConfig {
  maxDuration: number; // seconds
}

export default function Ptt({ panel, dark }: WidgetComponentProps) {
  const relayUrl = getRelayUrl();
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWidgetData = useConfigStore((s) => s.getWidgetData);
  const updateWidgetData = useConfigStore((s) => s.updateWidgetData);
  const config = getWidgetData<PttConfig>(panel.id) ?? { maxDuration: 6 };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
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
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Connect WebSocket to relay
      const wsUrl = relayUrl.replace(/^http/, 'ws') + '/voice/stream';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Start MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        mediaRecorder.start(100); // Send chunks every 100ms
        setIsRecording(true);
        startTimeRef.current = Date.now();
        setTimeLeft(config.maxDuration);

        // Start countdown timer
        timerRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const remaining = Math.max(0, config.maxDuration - elapsed);
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
          if (data.type === 'result' && data.text) {
            // Dispatch voice command event
            window.dispatchEvent(
              new CustomEvent('voice-command', {
                detail: { text: data.text, confidence: data.confidence },
              })
            );
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
        if (isRecording) {
          stopRecording();
        }
      };
    } catch {
      setError('Microphone access denied');
      stopRecording();
    }
  }, [relayUrl, config.maxDuration, stopRecording, isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!isRecording) {
      startRecording();
    }
  };

  const handlePointerUp = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  const updateConfig = (updates: Partial<PttConfig>) => {
    updateWidgetData(panel.id, { ...config, ...updates });
  };

  return (
    <div
      className={`h-full flex flex-col items-center justify-center p-2 ${
        dark ? 'bg-black text-white' : 'bg-white text-neutral-900'
      }`}
    >
      {/* Main PTT button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        disabled={!relayUrl}
        className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all touch-none select-none ${
          isRecording
            ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/50'
            : relayUrl
              ? 'bg-blue-600 hover:bg-blue-500 active:scale-95'
              : 'bg-neutral-400 cursor-not-allowed'
        }`}
      >
        {isRecording ? (
          <Mic className="w-8 h-8 text-white animate-pulse" />
        ) : (
          <MicOff className="w-8 h-8 text-white" />
        )}

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
              strokeDasharray={`${(timeLeft / config.maxDuration) * 188.5} 188.5`}
            />
          </svg>
        )}
      </button>

      {/* Status text */}
      <div className="mt-2 text-xs text-center">
        {error ? (
          <span className="text-red-500">{error}</span>
        ) : isRecording ? (
          <span className="text-red-500">{timeLeft}s</span>
        ) : !relayUrl ? (
          <span className="text-neutral-500">No relay</span>
        ) : (
          <span className="text-neutral-500">Hold to talk</span>
        )}
      </div>

      {/* Settings button */}
      <button
        onClick={() => setShowSettings(true)}
        className={`absolute top-2 right-2 p-1 rounded transition-colors ${
          dark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-200'
        }`}
        title="Settings"
      >
        <Settings size={12} className="text-neutral-400" />
      </button>

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Push-to-Talk Settings"
        actions={
          <Button onClick={() => setShowSettings(false)} variant="primary">
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Max Recording Duration
            </label>
            <div className={`${dark ? 'bg-neutral-700' : 'bg-neutral-100'} rounded`}>
              <Roller
                items={MAX_DURATION_OPTIONS}
                value={config.maxDuration}
                onChange={(v) => updateConfig({ maxDuration: v })}
                format={(v) => `${v} seconds`}
              />
            </div>
            <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>
              Recording stops automatically after this time
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

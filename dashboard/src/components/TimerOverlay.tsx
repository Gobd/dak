/**
 * Timer overlay - shows active timers from voice commands.
 * Timers persist in localStorage and play a sound when done.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Bell, BellOff } from 'lucide-react';

interface Timer {
  id: string;
  name: string;
  endTime: number; // Unix timestamp
  duration: number; // Original duration in seconds
  dismissed?: boolean; // Timer finished and was dismissed (for cleanup)
}

const STORAGE_KEY = 'dashboard-timers';

// Load timers from localStorage
function loadTimers(): Timer[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save timers to localStorage
function saveTimers(timers: Timer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
}

// Format remaining time as MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TimerOverlay() {
  const [timers, setTimers] = useState<Timer[]>(loadTimers);
  const [now, setNow] = useState(() => Date.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevAlertingRef = useRef<Set<string>>(new Set());

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Save timers when they change
  useEffect(() => {
    saveTimers(timers);
  }, [timers]);

  // Compute which timers are alerting (expired but not dismissed)
  const alertingTimerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const timer of timers) {
      if (timer.endTime <= now && !timer.dismissed) {
        ids.add(timer.id);
      }
    }
    return ids;
  }, [timers, now]);

  // Play/stop alarm based on alerting timers
  useEffect(() => {
    const wasAlerting = prevAlertingRef.current.size > 0;
    const isAlerting = alertingTimerIds.size > 0;

    // Check for newly alerting timers
    for (const id of alertingTimerIds) {
      if (!prevAlertingRef.current.has(id)) {
        // New timer just started alerting - play sound
        if (audioRef.current) {
          audioRef.current.loop = true;
          audioRef.current.play().catch(() => {});
        }
        break;
      }
    }

    // Stop alarm if no more alerting timers
    if (wasAlerting && !isAlerting && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    prevAlertingRef.current = alertingTimerIds;
  }, [alertingTimerIds]);

  // Handle voice commands
  const handleVoiceCommand = useCallback((event: MessageEvent) => {
    const data = event.data;
    if (!data?.type) return;

    if (data.type === 'timer') {
      const newTimer: Timer = {
        id: `timer-${Date.now()}`,
        name: data.name || 'Timer',
        endTime: Date.now() + data.seconds * 1000,
        duration: data.seconds,
      };
      setTimers((prev) => [...prev, newTimer]);
    }

    if (data.type === 'stop-timer') {
      if (data.name) {
        // Stop specific timer by name
        setTimers((prev) =>
          prev.filter((t) => !t.name.toLowerCase().includes(data.name.toLowerCase()))
        );
      } else {
        // Stop all alerting timers, or the most recent one
        setTimers((prev) => {
          const alerting = prev.filter((t) => t.endTime <= Date.now() && !t.dismissed);
          if (alerting.length > 0) {
            const alertingIds = new Set(alerting.map((t) => t.id));
            return prev.filter((t) => !alertingIds.has(t.id));
          }
          // Cancel most recent timer
          return prev.length > 0 ? prev.slice(0, -1) : prev;
        });
      }
      // Stop alarm
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, []);

  // Listen for voice commands via window message
  useEffect(() => {
    window.addEventListener('message', handleVoiceCommand);
    return () => window.removeEventListener('message', handleVoiceCommand);
  }, [handleVoiceCommand]);

  // Also expose for direct SSE handling via custom event
  useEffect(() => {
    const handleTimerEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; seconds?: number; name?: string }>;
      handleVoiceCommand({ data: customEvent.detail } as MessageEvent);
    };
    window.addEventListener('voice-timer', handleTimerEvent);
    return () => window.removeEventListener('voice-timer', handleTimerEvent);
  }, [handleVoiceCommand]);

  const dismissTimer = useCallback((id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
    // Stop alarm if this was the last alerting timer
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  if (timers.length === 0) return null;

  return (
    <>
      {/* Hidden audio element for alarm */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQgAVKrgx3JNAhRKruTDaDwCHUux4cRtPQIfSLDhxG09Ah9IsOHEbT0CH0iw4cRtPQIfSLDhxG09Ah9IsOHEbT0CH0iw4cRtPQ=="
      />

      {/* Timer display */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {timers.map((timer) => {
          const remaining = Math.max(0, Math.floor((timer.endTime - now) / 1000));
          const isAlerting = alertingTimerIds.has(timer.id);
          const progress = remaining / timer.duration;

          return (
            <div
              key={timer.id}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[200px]
                ${isAlerting ? 'bg-red-500 text-white animate-pulse' : 'bg-neutral-800 text-white'}
              `}
            >
              {isAlerting ? (
                <Bell className="w-5 h-5 animate-bounce" />
              ) : (
                <div className="w-5 h-5 relative">
                  <svg className="w-5 h-5 -rotate-90">
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      opacity="0.3"
                    />
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${progress * 50.27} 50.27`}
                    />
                  </svg>
                </div>
              )}

              <div className="flex-1">
                <div className="font-medium text-sm">{timer.name}</div>
                <div
                  className={`text-lg font-mono ${isAlerting ? 'text-white' : 'text-neutral-300'}`}
                >
                  {isAlerting ? "Time's up!" : formatTime(remaining)}
                </div>
              </div>

              <button
                onClick={() => dismissTimer(timer.id)}
                className={`
                  p-1.5 rounded-full transition-colors
                  ${isAlerting ? 'hover:bg-red-600 text-white' : 'hover:bg-neutral-700 text-neutral-400'}
                `}
                title={isAlerting ? 'Dismiss' : 'Cancel'}
              >
                {isAlerting ? <BellOff className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

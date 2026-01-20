/**
 * Timer widget - create and manage countdown timers.
 * Supports voice control and touch UI with roller-based time picking.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bell, BellOff, Plus, Minus, Timer as TimerIcon, Trash2 } from 'lucide-react';
import { Roller, ConfirmModal } from '@dak/ui';
import type { WidgetComponentProps } from './index';

// Time picker options
const HOURS = Array.from({ length: 13 }, (_, i) => i); // 0-12 hours
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0-59 minutes
const ADJUST_MINUTES = Array.from({ length: 60 }, (_, i) => i + 1); // 1-60 for adjustment

interface TimerData {
  id: string;
  name: string;
  endTime: number; // Unix timestamp
  duration: number; // Original duration in seconds
  dismissed?: boolean;
}

const STORAGE_KEY = 'dashboard-timers';

function loadTimers(): TimerData[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTimers(timers: TimerData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
}

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Timer({ panel, dark }: WidgetComponentProps) {
  const [timers, setTimers] = useState<TimerData[]>(loadTimers);
  const [now, setNow] = useState(() => Date.now());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createHours, setCreateHours] = useState(0);
  const [createMins, setCreateMins] = useState(5);
  const [createName, setCreateName] = useState('');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustMinutes, setAdjustMinutes] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevAlertingRef = useRef<Set<string>>(new Set());

  const timerToDelete = timers.find((t) => t.id === deleteId);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Save timers when they change
  useEffect(() => {
    saveTimers(timers);
  }, [timers]);

  // Compute alerting timers
  const alertingTimerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const timer of timers) {
      if (timer.endTime <= now && !timer.dismissed) {
        ids.add(timer.id);
      }
    }
    return ids;
  }, [timers, now]);

  // Play/stop alarm
  useEffect(() => {
    const wasAlerting = prevAlertingRef.current.size > 0;
    const isAlerting = alertingTimerIds.size > 0;

    for (const id of alertingTimerIds) {
      if (!prevAlertingRef.current.has(id)) {
        if (audioRef.current) {
          audioRef.current.loop = true;
          audioRef.current.play().catch(() => {});
        }
        break;
      }
    }

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
      const newTimer: TimerData = {
        id: `timer-${Date.now()}`,
        name: data.name || 'Timer',
        endTime: Date.now() + data.seconds * 1000,
        duration: data.seconds,
      };
      setTimers((prev) => [...prev, newTimer]);
    }

    if (data.type === 'adjust-timer') {
      const deltaSeconds = data.seconds as number;
      const name = data.name as string | undefined;

      setTimers((prev) => {
        if (name) {
          // Adjust specific timer by name
          return prev.map((t) =>
            t.name.toLowerCase().includes(name.toLowerCase())
              ? { ...t, endTime: Math.max(Date.now() + 1000, t.endTime + deltaSeconds * 1000) }
              : t
          );
        }
        // No name - only adjust if exactly 1 timer
        if (prev.length === 1) {
          return prev.map((t) => ({
            ...t,
            endTime: Math.max(Date.now() + 1000, t.endTime + deltaSeconds * 1000),
          }));
        }
        // Multiple timers - do nothing, need to specify name
        return prev;
      });
    }

    if (data.type === 'stop-timer') {
      if (data.name) {
        // Cancel specific timer by name
        setTimers((prev) =>
          prev.filter((t) => !t.name.toLowerCase().includes(data.name.toLowerCase()))
        );
      } else {
        // No name given - only cancel if exactly 1 timer, or dismiss alerting timers
        setTimers((prev) => {
          const alerting = prev.filter((t) => t.endTime <= Date.now() && !t.dismissed);
          if (alerting.length > 0) {
            // Dismiss all alerting timers
            const alertingIds = new Set(alerting.map((t) => t.id));
            return prev.filter((t) => !alertingIds.has(t.id));
          }
          // Only cancel if exactly 1 timer exists
          if (prev.length === 1) {
            return [];
          }
          // Multiple timers - do nothing, need to specify name
          return prev;
        });
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleVoiceCommand);
    return () => window.removeEventListener('message', handleVoiceCommand);
  }, [handleVoiceCommand]);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const adjustTime = useCallback((id: string, deltaSeconds: number) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, endTime: Math.max(Date.now() + 1000, t.endTime + deltaSeconds * 1000) }
          : t
      )
    );
  }, []);

  const startEditing = useCallback((timer: TimerData) => {
    setEditingId(timer.id);
    setEditName(timer.name);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId && editName.trim()) {
      setTimers((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, name: editName.trim() } : t))
      );
    }
    setEditingId(null);
    setEditName('');
  }, [editingId, editName]);

  const createTimer = useCallback(() => {
    const totalMinutes = createHours * 60 + createMins;
    if (totalMinutes === 0) return;
    const seconds = totalMinutes * 60;
    const newTimer: TimerData = {
      id: `timer-${Date.now()}`,
      name: createName.trim() || 'Timer',
      endTime: Date.now() + seconds * 1000,
      duration: seconds,
    };
    setTimers((prev) => [...prev, newTimer]);
    setShowCreate(false);
    setCreateName('');
    setCreateHours(0);
    setCreateMins(5);
  }, [createHours, createMins, createName]);

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Hidden audio */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQgAVKrgx3JNAhRKruTDaDwCHUux4cRtPQIfSLDhxG09Ah9IsOHEbT0CH0iw4cRtPQIfSLDhxG09Ah9IsOHEbT0CH0iw4cRtPQ=="
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Timers</span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={`p-1.5 rounded transition-colors ${showCreate ? 'bg-blue-600 text-white' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
          title="New timer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="mb-3 p-3 bg-neutral-200/50 dark:bg-neutral-700/50 rounded-lg">
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Name (optional)"
            className="w-full px-2 py-1.5 mb-2 bg-neutral-100 dark:bg-neutral-600 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-neutral-100 dark:bg-neutral-600 rounded">
              <Roller
                items={HOURS}
                value={createHours}
                onChange={setCreateHours}
                format={(v) => `${v}h`}
              />
            </div>
            <span className="text-neutral-400">:</span>
            <div className="flex-1 bg-neutral-100 dark:bg-neutral-600 rounded">
              <Roller
                items={MINUTES}
                value={createMins}
                onChange={setCreateMins}
                format={(v) => `${v.toString().padStart(2, '0')}m`}
              />
            </div>
          </div>
          <button
            onClick={createTimer}
            disabled={createHours === 0 && createMins === 0}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-400 dark:disabled:bg-neutral-600 disabled:cursor-not-allowed rounded text-sm font-medium text-white"
          >
            Start
          </button>
        </div>
      )}

      {/* Timer list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {timers.length === 0 && !showCreate && (
          <div className="text-center text-neutral-500 text-sm py-4">No timers yet</div>
        )}

        {timers.map((timer) => {
          const remaining = Math.max(0, Math.floor((timer.endTime - now) / 1000));
          const isAlerting = alertingTimerIds.has(timer.id);
          const progress = remaining / timer.duration;
          const isAdjusting = adjustingId === timer.id;

          return (
            <div key={timer.id} className="space-y-1">
              <div
                onWheel={(e) => {
                  if (!isAlerting) {
                    e.preventDefault();
                    adjustTime(timer.id, e.deltaY < 0 ? 60 : -60);
                  }
                }}
                className={`flex items-center gap-2 p-2 rounded-lg ${isAlerting ? 'bg-red-500 text-white animate-pulse' : 'bg-neutral-200/50 dark:bg-neutral-700/50'}`}
              >
                {isAlerting ? (
                  <Bell className="w-4 h-4 animate-bounce flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 flex-shrink-0">
                    <svg className="w-4 h-4 -rotate-90">
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        opacity="0.3"
                      />
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${progress * 37.7} 37.7`}
                      />
                    </svg>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {editingId === timer.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className="w-full bg-transparent border-b border-white/50 text-xs outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => startEditing(timer)}
                      className="text-xs hover:underline text-left truncate w-full"
                    >
                      {timer.name}
                    </button>
                  )}
                  <div
                    className={`text-sm font-mono ${isAlerting ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'}`}
                  >
                    {isAlerting ? "Time's up!" : formatTime(remaining)}
                  </div>
                </div>

                {!isAlerting && (
                  <button
                    onClick={() => setAdjustingId(isAdjusting ? null : timer.id)}
                    className={`p-1 rounded ${isAdjusting ? 'bg-blue-600 text-white' : 'hover:bg-neutral-300 dark:hover:bg-neutral-600'}`}
                  >
                    <TimerIcon className="w-3 h-3" />
                  </button>
                )}

                <button
                  onClick={() => (isAlerting ? dismissTimer(timer.id) : setDeleteId(timer.id))}
                  className={`p-1 rounded ${isAlerting ? 'hover:bg-red-600' : 'hover:bg-neutral-300 dark:hover:bg-neutral-600'}`}
                  title={isAlerting ? 'Dismiss' : 'Cancel'}
                >
                  {isAlerting ? <BellOff className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>

              {isAdjusting && (
                <div className="flex items-center gap-1 p-2 bg-neutral-300/50 dark:bg-neutral-600/50 rounded">
                  <button
                    onClick={() => adjustTime(timer.id, -adjustMinutes * 60)}
                    className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded">
                    <Roller
                      items={ADJUST_MINUTES}
                      value={adjustMinutes}
                      onChange={setAdjustMinutes}
                      format={(v) => `${v}m`}
                    />
                  </div>
                  <button
                    onClick={() => adjustTime(timer.id, adjustMinutes * 60)}
                    className="p-1.5 bg-green-600 hover:bg-green-500 rounded text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            dismissTimer(deleteId);
            setDeleteId(null);
          }
        }}
        title="Cancel Timer"
        message={`Cancel "${timerToDelete?.name || 'Timer'}"?`}
        confirmLabel="Cancel Timer"
        confirmVariant="danger"
      />
    </div>
  );
}

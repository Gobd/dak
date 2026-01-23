/**
 * Timer widget - create and manage countdown timers and stopwatches.
 * Unified view with both types in a single list.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Bell,
  BellOff,
  Plus,
  Minus,
  Timer as TimerIcon,
  Trash2,
  Play,
  Pause,
  Clock,
  X,
  Check,
} from 'lucide-react';
import { Roller, ConfirmModal, Modal, Button } from '@dak/ui';

// Time picker options
const HOURS = Array.from({ length: 13 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ADJUST_MINUTES = Array.from({ length: 60 }, (_, i) => i + 1);

type CreateMode = null | 'timer' | 'stopwatch';

interface TimerData {
  id: string;
  type: 'timer';
  name: string;
  endTime: number;
  duration: number;
  dismissed?: boolean;
}

interface StopwatchData {
  id: string;
  type: 'stopwatch';
  name: string;
  startTime: number;
  elapsed: number;
  running: boolean;
}

type ItemData = TimerData | StopwatchData;

const STORAGE_KEY = 'dashboard-timers-v2';

function loadItems(): ItemData[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveItems(items: ItemData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

export default function Timer() {
  const [items, setItems] = useState<ItemData[]>(loadItems);
  const [now, setNow] = useState(() => Date.now());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [createHours, setCreateHours] = useState(0);
  const [createMins, setCreateMins] = useState(5);
  const [createName, setCreateName] = useState('');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustMinutes, setAdjustMinutes] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevAlertingRef = useRef<Set<string>>(new Set());

  const itemToDelete = items.find((t) => t.id === deleteId);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Save items when they change
  useEffect(() => {
    saveItems(items);
  }, [items]);

  // Compute alerting timers
  const alertingTimerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of items) {
      if (item.type === 'timer' && item.endTime <= now && !item.dismissed) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [items, now]);

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
        type: 'timer',
        name: data.name || 'Timer',
        endTime: Date.now() + data.seconds * 1000,
        duration: data.seconds,
      };
      setItems((prev) => [...prev, newTimer]);
    }

    if (data.type === 'stopwatch') {
      const newStopwatch: StopwatchData = {
        id: `stopwatch-${Date.now()}`,
        type: 'stopwatch',
        name: data.name || 'Stopwatch',
        startTime: Date.now(),
        elapsed: 0,
        running: true,
      };
      setItems((prev) => [...prev, newStopwatch]);
    }

    if (data.type === 'adjust-timer') {
      const deltaSeconds = data.seconds as number;
      const name = data.name as string | undefined;

      setItems((prev) => {
        const timers = prev.filter((i) => i.type === 'timer') as TimerData[];
        if (name) {
          return prev.map((t) =>
            t.type === 'timer' && t.name.toLowerCase().includes(name.toLowerCase())
              ? { ...t, endTime: Math.max(Date.now() + 1000, t.endTime + deltaSeconds * 1000) }
              : t,
          );
        }
        if (timers.length === 1) {
          return prev.map((t) =>
            t.type === 'timer'
              ? { ...t, endTime: Math.max(Date.now() + 1000, t.endTime + deltaSeconds * 1000) }
              : t,
          );
        }
        return prev;
      });
    }

    if (data.type === 'stop-timer') {
      if (data.name) {
        setItems((prev) =>
          prev.filter(
            (t) => !(t.type === 'timer' && t.name.toLowerCase().includes(data.name.toLowerCase())),
          ),
        );
      } else {
        setItems((prev) => {
          const alerting = prev.filter(
            (t) => t.type === 'timer' && t.endTime <= Date.now() && !t.dismissed,
          );
          if (alerting.length > 0) {
            const alertingIds = new Set(alerting.map((t) => t.id));
            return prev.filter((t) => !alertingIds.has(t.id));
          }
          const timers = prev.filter((i) => i.type === 'timer');
          if (timers.length === 1) {
            return prev.filter((t) => t.type !== 'timer');
          }
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

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const adjustTime = useCallback((id: string, deltaSeconds: number) => {
    setItems((prev) =>
      prev.map((t) =>
        t.type === 'timer' && t.id === id
          ? { ...t, endTime: Math.max(Date.now() + 1000, t.endTime + deltaSeconds * 1000) }
          : t,
      ),
    );
  }, []);

  const startEditing = useCallback((item: ItemData) => {
    setEditingId(item.id);
    setEditName(item.name);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId && editName.trim()) {
      setItems((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, name: editName.trim() } : t)),
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
      type: 'timer',
      name: createName.trim() || 'Timer',
      endTime: Date.now() + seconds * 1000,
      duration: seconds,
    };
    setItems((prev) => [...prev, newTimer]);
    setShowMenu(false);
    setCreateMode(null);
    setCreateName('');
    setCreateHours(0);
    setCreateMins(5);
  }, [createHours, createMins, createName]);

  const createStopwatch = useCallback(() => {
    const newStopwatch: StopwatchData = {
      id: `stopwatch-${Date.now()}`,
      type: 'stopwatch',
      name: createName.trim() || 'Stopwatch',
      startTime: Date.now(),
      elapsed: 0,
      running: true,
    };
    setItems((prev) => [...prev, newStopwatch]);
    setShowMenu(false);
    setCreateMode(null);
    setCreateName('');
  }, [createName]);

  const toggleStopwatch = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((s) => {
        if (s.type !== 'stopwatch' || s.id !== id) return s;
        if (s.running) {
          return { ...s, elapsed: s.elapsed + (Date.now() - s.startTime), running: false };
        } else {
          return { ...s, startTime: Date.now(), running: true };
        }
      }),
    );
  }, []);

  const getStopwatchElapsed = (sw: StopwatchData) => {
    if (sw.running) {
      return sw.elapsed + (now - sw.startTime);
    }
    return sw.elapsed;
  };

  const hasItems = items.length > 0;
  const [floatingOpen, setFloatingOpen] = useState(true);
  const [floatingPos, setFloatingPos] = useState({ x: 100, y: 100 });
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(
    null,
  );

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      posX: floatingPos.x,
      posY: floatingPos.y,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      setFloatingPos({
        x: Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.posY + dy)),
      });
    };
    const handleUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [floatingPos]);

  // The widget is just a trigger button
  return (
    <div className="h-full w-full flex items-center justify-center">
      {/* Hidden audio */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQgAVKrgx3JNAhRKruTDaDwCHUux4cRtPQIfSLDhxG09Ah9IsOHEbT0CH0iw4cRtPQIfSLDhxG09Ah9IsOHEbT0CH0iw4cRtPQ=="
      />

      {/* Trigger button */}
      <button
        onClick={() => (hasItems ? setFloatingOpen(true) : setShowMenu(true))}
        className="relative p-2 rounded-lg transition-colors hover:bg-neutral-700/30"
        title={hasItems ? 'Show timers' : 'Add timer or stopwatch'}
      >
        <TimerIcon size={24} className={hasItems ? 'text-blue-400' : 'text-neutral-500'} />
        {hasItems && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>

      {/* Create Modal */}
      <Modal
        open={showMenu || createMode !== null}
        onClose={() => {
          setShowMenu(false);
          setCreateMode(null);
        }}
        title={createMode ? `New ${createMode === 'timer' ? 'Timer' : 'Stopwatch'}` : 'Create'}
        fit
      >
        {!createMode ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setCreateMode('timer')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-200 text-sm font-medium transition-colors"
            >
              <TimerIcon className="w-5 h-5" />
              Timer
            </button>
            <button
              onClick={() => setCreateMode('stopwatch')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-200 text-sm font-medium transition-colors"
            >
              <Clock className="w-5 h-5" />
              Stopwatch
            </button>
          </div>
        ) : createMode === 'timer' ? (
          <div className="space-y-4">
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-neutral-100 dark:bg-neutral-700 rounded-lg overflow-hidden">
                <Roller
                  items={HOURS}
                  value={createHours}
                  onChange={setCreateHours}
                  format={(v) => `${v}h`}
                />
              </div>
              <span className="text-neutral-400 font-bold text-xl">:</span>
              <div className="flex-1 bg-neutral-100 dark:bg-neutral-700 rounded-lg overflow-hidden">
                <Roller
                  items={MINUTES}
                  value={createMins}
                  onChange={setCreateMins}
                  format={(v) => `${v.toString().padStart(2, '0')}m`}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setCreateMode(null)}>Back</Button>
              <Button
                onClick={() => {
                  createTimer();
                  setFloatingOpen(true);
                }}
                disabled={createHours === 0 && createMins === 0}
                variant="primary"
              >
                Start Timer
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <Button onClick={() => setCreateMode(null)}>Back</Button>
              <Button
                onClick={() => {
                  createStopwatch();
                  setFloatingOpen(true);
                }}
                variant="primary"
              >
                Start Stopwatch
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Floating timer window */}
      {hasItems && floatingOpen && (
        <div
          className="fixed z-50 bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 w-[180px]"
          style={{ left: floatingPos.x, top: floatingPos.y }}
        >
          {/* Draggable header */}
          <div
            className="flex items-center justify-between px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-t-xl cursor-move select-none"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              {items.length} active
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMenu(true)}
                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600"
                title="Add"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFloatingOpen(false)}
                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600"
                title="Minimize"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Timer list */}
          <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {items.map((item) => {
              if (item.type === 'timer') {
                const timer = item;
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
                      onClick={isAlerting ? () => deleteItem(timer.id) : undefined}
                      className={`flex items-center gap-2 p-2 rounded-lg ${isAlerting ? 'bg-red-500 text-white animate-pulse cursor-pointer' : 'bg-neutral-200/50 dark:bg-neutral-700/50'}`}
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
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                              className="flex-1 min-w-0 px-1 py-0.5 bg-white dark:bg-neutral-600 border border-neutral-300 dark:border-neutral-500 rounded text-xs text-neutral-900 dark:text-white outline-none"
                              autoFocus
                            />
                            <button
                              onClick={saveEdit}
                              className="p-1 bg-green-600 hover:bg-green-500 rounded text-white"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(timer)}
                            className="text-xs hover:underline text-left truncate w-full text-neutral-700 dark:text-neutral-200"
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
                        onClick={() => (isAlerting ? deleteItem(timer.id) : setDeleteId(timer.id))}
                        className={`p-1 rounded ${isAlerting ? 'hover:bg-red-600' : 'hover:bg-neutral-300 dark:hover:bg-neutral-600'}`}
                        title={isAlerting ? 'Dismiss' : 'Cancel'}
                      >
                        {isAlerting ? (
                          <BellOff className="w-3 h-3" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {isAdjusting && (
                      <div className="relative z-20 flex items-center gap-1 p-2 bg-neutral-300/50 dark:bg-neutral-600/50 rounded">
                        <button
                          onClick={() => adjustTime(timer.id, -adjustMinutes * 60)}
                          className="p-1.5 bg-neutral-500 hover:bg-neutral-400 dark:bg-neutral-600 dark:hover:bg-neutral-500 rounded text-white"
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
                          className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setAdjustingId(null)}
                          className="p-1.5 bg-neutral-400 hover:bg-neutral-300 dark:bg-neutral-500 dark:hover:bg-neutral-400 rounded text-white"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              } else {
                const sw = item;
                const elapsedMs = getStopwatchElapsed(sw);
                const elapsedSeconds = Math.floor(elapsedMs / 1000);

                return (
                  <div
                    key={sw.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-neutral-200/50 dark:bg-neutral-700/50"
                  >
                    <Clock
                      className={`w-4 h-4 flex-shrink-0 ${sw.running ? 'text-green-500' : 'text-neutral-400'}`}
                    />

                    <div className="flex-1 min-w-0">
                      {editingId === sw.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="flex-1 min-w-0 px-1 py-0.5 bg-white dark:bg-neutral-600 border border-neutral-300 dark:border-neutral-500 rounded text-xs text-neutral-900 dark:text-white outline-none"
                            autoFocus
                          />
                          <button
                            onClick={saveEdit}
                            className="p-1 bg-green-600 hover:bg-green-500 rounded text-white"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(sw)}
                          className="text-xs hover:underline text-left truncate w-full text-neutral-700 dark:text-neutral-200"
                        >
                          {sw.name}
                        </button>
                      )}
                      <div className="text-sm font-mono text-neutral-600 dark:text-neutral-300">
                        {formatTime(elapsedSeconds)}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleStopwatch(sw.id)}
                      className={`p-1 rounded ${sw.running ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'} text-white`}
                      title={sw.running ? 'Pause' : 'Resume'}
                    >
                      {sw.running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => setDeleteId(sw.id)}
                      className="p-1 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteItem(deleteId);
            setDeleteId(null);
          }
        }}
        title={itemToDelete?.type === 'timer' ? 'Cancel Timer' : 'Delete Stopwatch'}
        message={`${itemToDelete?.type === 'timer' ? 'Cancel' : 'Delete'} "${itemToDelete?.name}"?`}
        confirmText={itemToDelete?.type === 'timer' ? 'Cancel Timer' : 'Delete'}
        variant="danger"
      />
    </div>
  );
}

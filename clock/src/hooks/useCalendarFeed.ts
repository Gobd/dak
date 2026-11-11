import { useCallback, useEffect, useRef, useState } from 'react';
import { useInterval } from '@dak/hooks';
import { getCalendarSnapshot, type CalendarSnapshotResponse } from '@dak/api-client';
import type { ClockSettings } from '../lib/settings';

export default function useCalendarFeed(settings: ClockSettings, visible: boolean) {
  const [snapshot, setSnapshot] = useState<CalendarSnapshotResponse | null>(null);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!settings.calendarRelay || active.current || document.hidden) return;
    const controller = new AbortController();
    active.current = controller;
    const version = generation.current;
    try {
      const { data, response } = await getCalendarSnapshot({
        baseUrl: settings.calendarRelay,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (version !== generation.current) return;
      if (!response?.ok || !data || !Array.isArray(data.events) || data.events.length > 1000) {
        if (response?.status === 401 || response?.status === 403) setSnapshot(null);
        throw new Error(`Calendar feed unavailable (${response?.status ?? 'network error'})`);
      }
      setSnapshot(data);
      setError('');
    } catch (cause) {
      if (version !== generation.current || controller.signal.aborted) return;
      setError(
        cause instanceof Error && /^(Calendar|Relay)/.test(cause.message)
          ? cause.message
          : 'Calendar connection unavailable',
      );
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [settings.calendarRelay]);

  useEffect(() => {
    generation.current++;
    active.current?.abort();
    active.current = null;
    setSnapshot(null);
    setError('');
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      generation.current++;
      active.current?.abort();
      active.current = null;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);
  useInterval(
    () => void load(),
    visible && settings.calendarRelay ? settings.calendarPollSeconds * 1000 : null,
  );
  return { snapshot, error };
}

import type { CalendarFeedEvent } from '@dak/api-client';
import { dayFraction } from './solar.ts';

export interface ClockCalendar {
  id: string;
  name: string;
  color: string | null;
}

export function calendarsFromEvents(events: CalendarFeedEvent[]): ClockCalendar[] {
  return [
    ...new Map(
      events.map((event) => [
        event.calendar_id,
        {
          id: event.calendar_id,
          name: event.calendar_name,
          color:
            typeof event.color === 'string' && /^#[0-9a-f]{6}$/i.test(event.color)
              ? event.color
              : null,
        },
      ]),
    ).values(),
  ];
}

export interface ClockEvent {
  key: string;
  title: string;
  calendarName: string;
  color: string | null;
  calendarId: string;
  start: number;
  end: number;
  allDay: boolean;
  continuesBefore: boolean;
  continuesAfter: boolean;
  startTime: Date | null;
  endTime: Date | null;
  repeatedHour: boolean;
  lane: number;
}

export const MAX_EVENT_LANES = 5;

export function eventsForDay(
  events: CalendarFeedEvent[],
  date: Date,
  calendarIds: string[],
  filter = calendarIds.length > 0,
): ClockEvent[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const daily: ClockEvent[] = [];
  const seen = new Set<string>();
  for (const event of events.slice(0, 1000)) {
    if (filter && !calendarIds.includes(event.calendar_id)) continue;
    const key = `${event.calendar_id}:${event.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let from: number;
    let to: number;
    let before: boolean;
    let after: boolean;
    let startTime: Date | null = null;
    let endTime: Date | null = null;
    let repeatedHour = false;
    if (event.all_day) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event.start) || !/^\d{4}-\d{2}-\d{2}$/.test(event.end))
        continue;
      if (event.start > localDate || event.end <= localDate) continue;
      from = 0;
      to = 1;
      before = event.start < localDate;
      // Google all-day end dates are exclusive.
      after =
        event.end >
        `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    } else {
      startTime = new Date(event.start);
      endTime = new Date(event.end);
      if (
        !Number.isFinite(startTime.getTime()) ||
        !Number.isFinite(endTime.getTime()) ||
        endTime <= startTime ||
        startTime >= end ||
        endTime <= start
      )
        continue;
      before = startTime < start;
      after = endTime > end;
      from = before ? 0 : dayFraction(startTime);
      to = endTime >= end ? 1 : dayFraction(endTime);
      // The repeated fall-back hour has two timestamps at the same dial position.
      // Show its occupied wall-time range instead of drawing a negative/wrapped band.
      if (to <= from) {
        repeatedHour = true;
        [from, to] = [Math.min(from, to), Math.min(1, Math.max(from, to) + 1 / 1440)];
      }
    }
    daily.push({
      key,
      title: event.title,
      calendarName: event.calendar_name,
      calendarId: event.calendar_id,
      color:
        typeof event.color === 'string' && /^#[0-9a-f]{6}$/i.test(event.color) ? event.color : null,
      start: from,
      end: to,
      allDay: event.all_day,
      continuesBefore: before,
      continuesAfter: after,
      startTime,
      endTime,
      repeatedHour,
      lane: 0,
    });
  }
  daily.sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      a.start - b.start ||
      b.end - a.end ||
      a.key.localeCompare(b.key),
  );
  const laneEnds: number[] = [];
  for (const event of daily) {
    let lane = laneEnds.findIndex((lastEnd) => lastEnd <= event.start);
    if (lane < 0) lane = laneEnds.length;
    event.lane = lane;
    // Rendering gives sub-minute events a one-minute minimum width. Reserve that
    // same visible span so the next event cannot overlap it in the same lane.
    laneEnds[lane] = Math.min(1, Math.max(event.end, event.start + 1 / 1440));
  }
  return daily;
}

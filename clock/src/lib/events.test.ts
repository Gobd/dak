import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CalendarFeedEvent } from '@dak/api-client';
import { eventsForDay, MAX_EVENT_LANES } from './events.ts';
import { faceRadius } from './draw-events.ts';
import { DEFAULT_SETTINGS } from './settings.ts';

const day = new Date(2026, 10, 10, 12);
const event = (id: string, start: string, end: string, all_day = false): CalendarFeedEvent => ({
  id,
  calendar_id: 'family',
  calendar_name: 'Family',
  title: id,
  start,
  end,
  all_day,
  color: '#123456',
});

test('duration bands clip overnight events to the displayed day and respect exclusive ends', () => {
  const events = eventsForDay(
    [
      event('before', '2026-11-09T23:00:00-05:00', '2026-11-10T02:00:00-05:00'),
      event('after', '2026-11-10T23:00:00-05:00', '2026-11-11T02:00:00-05:00'),
      event('notToday', '2026-11-09T23:00:00-05:00', '2026-11-10T00:00:00-05:00'),
    ],
    day,
    [],
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].start, 0);
  assert.equal(events[0].end, 2 / 24);
  assert.equal(events[0].continuesBefore, true);
  assert.equal(events[1].start, 23 / 24);
  assert.equal(events[1].end, 1);
  assert.equal(events[1].continuesAfter, true);
});

test('all-day dates are floating local dates, with full-day spans and separate overlap lanes', () => {
  const events = eventsForDay(
    [
      event('holiday', '2026-11-10', '2026-11-11', true),
      event('yesterday', '2026-11-09', '2026-11-10', true),
      event('lunch', '2026-11-10T12:00:00-05:00', '2026-11-10T13:00:00-05:00'),
      event('meeting', '2026-11-10T12:30:00-05:00', '2026-11-10T14:00:00-05:00'),
      event('later', '2026-11-10T15:00:00-05:00', '2026-11-10T16:00:00-05:00'),
    ],
    day,
    [],
  );
  assert.equal(events.length, 4);
  assert.equal(events[0].start, 0);
  assert.equal(events[0].end, 1);
  assert.deepEqual(
    events.map((item) => item.lane),
    [0, 1, 2, 1],
  );
});

test('calendar filtering, deduplication, invalid dates, and visible-lane bounds', () => {
  const item = event('one', '2026-11-10T12:00:00-05:00', '2026-11-10T13:00:00-05:00');
  assert.equal(eventsForDay([item, item], day, []).length, 1);
  assert.equal(eventsForDay([item], day, ['other']).length, 0);
  assert.equal(eventsForDay([item], day, [], true).length, 0);
  assert.equal(eventsForDay([item], day, ['other'], false).length, 1);
  assert.equal(eventsForDay([event('bad', 'nope', 'bad')], day, []).length, 0);
  const overlapping = eventsForDay(
    Array.from({ length: 8 }, (_, index) => ({ ...item, id: String(index) })),
    day,
    [],
  );
  assert.equal(overlapping.filter((entry) => entry.lane >= MAX_EVENT_LANES).length, 3);
  const outside = faceRadius(720, 720, DEFAULT_SETTINGS, overlapping);
  assert.ok(outside < 359 && outside > 280);
  assert.equal(faceRadius(720, 720, { ...DEFAULT_SETTINGS, eventStyle: 'none' }, overlapping), 359);
});

test('sub-minute event minimum widths reserve separate visible lanes', () => {
  const daily = eventsForDay(
    [
      event('one', '2026-11-10T12:00:00-05:00', '2026-11-10T12:00:20-05:00'),
      event('two', '2026-11-10T12:00:30-05:00', '2026-11-10T12:00:50-05:00'),
    ],
    day,
    [],
  );
  assert.deepEqual(
    daily.map((entry) => entry.lane),
    [0, 1],
  );
});

test('fall-back-hour events cannot create negative duration bands', () => {
  const events = eventsForDay(
    [event('dst', '2026-11-01T01:45:00-04:00', '2026-11-01T01:15:00-05:00')],
    new Date(2026, 10, 1, 12),
    [],
  );
  assert.equal(events.length, 1);
  assert.ok(events[0].end > events[0].start);
  assert.equal(events[0].repeatedHour, true);
});

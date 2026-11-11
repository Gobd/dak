import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayFraction, getSolarDay } from './solar.ts';
import {
  DEFAULT_SETTINGS,
  normalizeColor,
  normalizeSettings,
  validCoordinates,
} from './settings.ts';
import { formatClockDate } from './date.ts';
import { contrastInk } from './colors.ts';
import { hourLabel } from './hours.ts';

test('coordinates and saved settings are validated, including zero coordinates', () => {
  assert.equal(validCoordinates(0, 0), true);
  assert.equal(validCoordinates(91, 0), false);
  assert.equal(validCoordinates(0, -181), false);
  assert.equal(validCoordinates(NaN, 0), false);
  assert.equal(validCoordinates('40', -74), false);
  assert.equal(normalizeSettings(null).latitude, null);
  assert.equal(normalizeSettings({ latitude: 40, longitude: null }).latitude, null);
  assert.deepEqual(
    normalizeSettings({ mode: 'linear', seconds: false, latitude: 0, longitude: 0 }),
    {
      ...DEFAULT_SETTINGS,
      mode: 'linear',
      seconds: false,
      latitude: 0,
      longitude: 0,
    },
  );
});

test('custom colors and date formats validate and retain sensible defaults', () => {
  assert.equal(normalizeColor('#abcdef'), '#abcdef');
  assert.equal(normalizeColor('red'), null);
  assert.equal(normalizeColor('#fff'), null);
  assert.equal(normalizeSettings({ dateFormat: 'invalid' }).dateFormat, 'none');
  assert.equal(normalizeSettings({ showSolarTimes: true }).showSolarTimes, true);
  assert.equal(normalizeSettings({ dayColor: '#ff0000' }).dayColor, '#ff0000');
  assert.equal(contrastInk('#ffffff'), 'var(--clock-ink-dark)');
  assert.equal(contrastInk('#000000'), 'var(--clock-ink-light)');
  const date = new Date(2026, 10, 10, 23);
  assert.equal(formatClockDate(date, 'none'), '');
  assert.equal(formatClockDate(date, 'iso'), '2026-11-10');
  assert.ok(formatClockDate(date, 'full').includes('2026'));
});

test('repeated 12-hour labels change only the numbers on the 24-hour face', () => {
  assert.equal(hourLabel(0, '12h'), '12');
  assert.equal(hourLabel(12, '12h'), '12');
  assert.equal(hourLabel(14, '12h'), '2');
  assert.equal(hourLabel(24, '12h'), '12');
  assert.equal(hourLabel(14, '24h'), '14');
});

test('New York summer day has a plausible sunrise, sunset, and daylight span', () => {
  const day = getSolarDay(new Date(2026, 5, 21, 12), 40.7128, -74.006);
  assert.equal(day.state, 'normal');
  assert.deepEqual(
    day.events.map((event) => event.kind),
    ['sunrise', 'sunset'],
  );
  assert.equal(day.events[0].time.getHours(), 5);
  assert.equal(day.events[1].time.getHours(), 20);
  assert.equal(day.daylight.length, 1);
  const hours = (day.daylight[0].end - day.daylight[0].start) * 24;
  assert.ok(hours > 15 && hours < 16);
});

test('polar summer and winter do not produce invalid times', () => {
  const summer = getSolarDay(new Date(2026, 5, 21, 12), 78.2232, 15.6469);
  assert.equal(summer.state, 'polar-day');
  assert.deepEqual(summer.daylight, [{ start: 0, end: 1 }]);
  assert.deepEqual(summer.events, []);
  const winter = getSolarDay(new Date(2026, 11, 21, 12), 78.2232, 15.6469);
  assert.equal(winter.state, 'polar-night');
  assert.deepEqual(winter.daylight, []);
  assert.deepEqual(winter.events, []);
});

test('a distant location can have sunset before sunrise in the browser timezone', () => {
  const date = new Date(2026, 5, 21, 12);
  const day = getSolarDay(date, 35.6762, 139.6503);
  assert.deepEqual(
    day.events.map((event) => event.kind),
    ['sunset', 'sunrise'],
  );
  assert.equal(day.daylight.length, 2);
  assert.equal(day.daylight[0].start, 0);
  assert.equal(day.daylight[1].end, 1);
  for (const event of day.events) assert.equal(event.time.getDate(), date.getDate());
});

test('solar cycles near the date line stay within the displayed local date', () => {
  for (const longitude of [-180, 180]) {
    const date = new Date(2026, 2, 20, 12);
    const day = getSolarDay(date, 0, longitude);
    assert.equal(day.events.length, 2);
    for (const event of day.events) {
      assert.equal(event.time.getDate(), date.getDate());
      assert.ok(Number.isFinite(event.fraction));
    }
  }
});

test('DST dates use wall-clock position and stay within the displayed date', () => {
  for (const date of [new Date(2026, 2, 8, 12), new Date(2026, 10, 1, 12)]) {
    assert.equal(dayFraction(date), 0.5);
    const day = getSolarDay(date, 40.7128, -74.006);
    assert.equal(day.events.length, 2);
    for (const event of day.events) {
      assert.equal(event.time.getDate(), date.getDate());
      assert.ok(event.fraction >= 0 && event.fraction < 1);
    }
  }
});

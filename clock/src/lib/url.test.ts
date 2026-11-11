import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings.ts';
import { displayUrl, settingsFromParams } from './url.ts';
import { dayFraction, dayKey } from './solar.ts';

test('display URL round-trips every option, including blank coordinates and theme colors', () => {
  for (const settings of [
    DEFAULT_SETTINGS,
    {
      ...DEFAULT_SETTINGS,
      mode: 'linear' as const,
      hourLabels: '12h' as const,
      digitalTimeFormat: '12h' as const,
      rectangleBar: 'bottom' as const,
      barColor: '#000000',
      barTextColor: '#ffffff',
      wipePast: true,
      wipeColor: '#000000',
      wipeOpacity: 72,
      showTimeMarker: false,
      showSecondsMarker: false,
      showWeather: true,
      showTomorrowWeather: true,
      weatherUnit: 'celsius' as const,
      latitude: 0,
      longitude: -180,
      seconds: false,
      showTime: false,
      showSolarTimes: true,
      dateFormat: 'full' as const,
      dayColor: '#ffdead',
      nightColor: '#123456',
      handColor: '#abcdef',
      secondColor: '#fedcba',
      calendarRelay: 'https://relay.example.com',
      calendarIds: ['family@example.com', 'birthdays'],
      calendarFilter: true,
      showCalendarLegend: true,
      showEventNames: true,
      eventStyle: 'dot' as const,
      eventPlacement: 'inside' as const,
      eventColor: '#112233',
      showEventList: true,
      showCalendarStatus: false,
      calendarPollSeconds: 120,
    },
  ]) {
    const url = new URL(displayUrl('https://example.com/clock/?old=1#hash', settings, true, true));
    assert.deepEqual(normalizeSettings(settingsFromParams(url.searchParams)), settings);
    assert.equal(url.searchParams.get('theme'), 'dark');
    assert.equal(url.searchParams.get('f'), '1');
    assert.equal(url.hash, '');
    assert.equal(url.searchParams.has('old'), false);
  }
});

test('all calendars off remains off after URL copying', () => {
  const settings = { ...DEFAULT_SETTINGS, calendarFilter: true, calendarIds: [] };
  const url = new URL(displayUrl('https://example.com/clock/', settings, false, true));
  const restored = normalizeSettings(settingsFromParams(url.searchParams));
  assert.equal(restored.calendarFilter, true);
  assert.deepEqual(restored.calendarIds, []);
  assert.equal(url.searchParams.get('theme'), 'light');
});

test('invalid URL options are ignored; explicit blanks clear saved colors/location', () => {
  assert.deepEqual(
    settingsFromParams(
      new URLSearchParams(
        'mode=no&seconds=yes&date=bogus&lat=91&lng=0&dayColor=red&rectangleBar=no&wipeOpacity=101&wipeColor=red&showTomorrowWeather=yes&weatherUnit=kelvin',
      ),
    ),
    {},
  );
  assert.deepEqual(settingsFromParams(new URLSearchParams('lat=&lng=&dayColor=&seconds=0')), {
    latitude: null,
    longitude: null,
    dayColor: null,
    seconds: false,
  });
  const saved = { ...DEFAULT_SETTINGS, mode: 'circle', dayColor: '#abcdef' };
  const loaded = normalizeSettings({
    ...saved,
    ...settingsFromParams(new URLSearchParams('mode=linear&dayColor=%23123456')),
  });
  assert.equal(loaded.mode, 'linear');
  assert.equal(loaded.dayColor, '#123456');
});

test('legacy calendar read keys are ignored and stripped from copied kiosk URLs', () => {
  const legacy = normalizeSettings({ ...DEFAULT_SETTINGS, calendarKey: 'old-secret' });
  assert.equal(Object.hasOwn(legacy, 'calendarKey'), false);
  const params = new URLSearchParams(
    'calendarRelay=http://relay.local:5111&calendarKey=old-secret',
  );
  const settings = normalizeSettings(settingsFromParams(params));
  assert.equal(settings.calendarRelay, 'http://relay.local:5111');
  assert.equal(Object.hasOwn(settingsFromParams(params), 'calendarKey'), false);
  const url = new URL(
    displayUrl('https://example.com/clock/?calendarKey=old-secret', settings, false, true),
  );
  assert.equal(url.searchParams.has('calendarKey'), false);
});

test('DST repeated hour has the same dial position but triggers a solar refresh', () => {
  const first = new Date('2026-11-01T01:30:00-04:00');
  const second = new Date('2026-11-01T01:30:00-05:00');
  assert.equal(dayFraction(first), dayFraction(second));
  assert.notEqual(dayKey(first), dayKey(second));
  const before = new Date('2026-03-08T01:59:59-05:00');
  const after = new Date('2026-03-08T03:00:00-04:00');
  assert.ok(dayFraction(after) - dayFraction(before) > 1 / 24);
});

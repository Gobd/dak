import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWeather, weatherCondition, weatherDate } from './weather.ts';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings.ts';
import { displayUrl, settingsFromParams } from './url.ts';

const daily = {
  time: ['2026-06-21', '2026-06-22'],
  weather_code: [2, 73],
  temperature_2m_min: [62, 30],
  temperature_2m_max: [79, 38],
  precipitation_probability_max: [20, 80],
};

test('selects today and tomorrow by local date; validates missing/malformed data', () => {
  assert.deepEqual(parseWeather({ daily }, '2026-06-21'), {
    code: 2,
    low: 62,
    high: 79,
    precipitation: 20,
  });
  assert.deepEqual(parseWeather({ daily }, '2026-06-22'), {
    code: 73,
    low: 30,
    high: 38,
    precipitation: 80,
  });
  for (const value of [
    null,
    {},
    { daily: null },
    { daily: { ...daily, temperature_2m_min: [null] } },
    { daily: { ...daily, precipitation_probability_max: [101] } },
  ])
    assert.equal(parseWeather(value, '2026-06-21'), null);
  assert.equal(parseWeather({ daily }, '2026-06-23'), null);
  assert.equal(weatherDate(new Date(2026, 11, 31)), '2026-12-31');
  assert.equal(weatherDate(new Date(2026, 11, 32)), '2027-01-01');
});

test('condition codes choose sun/cloud/rain/snow and storm icons', () => {
  for (const [code, kind] of [
    [0, 'sun'],
    [2, 'partly'],
    [3, 'cloud'],
    [45, 'fog'],
    [61, 'rain'],
    [73, 'snow'],
    [95, 'storm'],
  ] as const)
    assert.equal(weatherCondition(code).kind, kind);
});

test('all rectangle and weather combinations survive a copied URL', () => {
  for (const rectangleBar of ['top', 'bottom', 'overlay'] as const)
    for (const showWeather of [true, false])
      for (const showTomorrowWeather of [true, false])
        for (const wipeOpacity of [0, 100]) {
          const settings = {
            ...DEFAULT_SETTINGS,
            mode: 'linear' as const,
            rectangleBar,
            showWeather,
            showTomorrowWeather,
            wipePast: true,
            wipeOpacity,
          };
          const url = new URL(displayUrl('https://example.com/clock/', settings, false, true));
          assert.deepEqual(normalizeSettings(settingsFromParams(url.searchParams)), settings);
        }
});

test('old and malformed settings get safe rectangle defaults', () => {
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
  assert.equal(normalizeSettings({ wipeOpacity: Infinity }).wipeOpacity, 85);
  assert.equal(normalizeSettings({ wipeOpacity: -1 }).wipeOpacity, 0);
  assert.equal(normalizeSettings({ wipeOpacity: 200 }).wipeOpacity, 100);
  assert.equal(normalizeSettings({ wipeColor: 'red' }).wipeColor, null);
  assert.equal(normalizeSettings({ rectangleBar: 'bogus' }).rectangleBar, 'top');
});

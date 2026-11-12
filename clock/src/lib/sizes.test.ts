import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings.ts';
import { hourLabelStep } from './hours.ts';
import { settingsFromParams } from './url.ts';

test('old settings get size defaults; malformed sizes default and finite sizes clamp', () => {
  const old = normalizeSettings({ mode: 'linear' });
  for (const key of ['barHeight', 'infoScale', 'hourLabelScale'] as const)
    assert.equal(old[key], DEFAULT_SETTINGS[key]);
  const settings = normalizeSettings({ barHeight: 999, infoScale: NaN, hourLabelScale: -1 });
  assert.equal(settings.barHeight, 60);
  assert.equal(settings.infoScale, 100);
  assert.equal(settings.hourLabelScale, 100);
});

test('blank or invalid size URL values leave saved settings intact', () => {
  assert.deepEqual(
    settingsFromParams(new URLSearchParams('barHeight=&infoScale=Infinity&hourLabelScale=301')),
    {},
  );
  assert.deepEqual(
    settingsFromParams(new URLSearchParams('barHeight=35&infoScale=125&hourLabelScale=200')),
    {
      barHeight: 35,
      infoScale: 125,
      hourLabelScale: 200,
    },
  );
});

test('larger hour labels reduce density while preserving regular divisions', () => {
  assert.equal(hourLabelStep(1200, 40, 2), 2);
  assert.equal(hourLabelStep(1200, 120, 2), 4);
  assert.equal(hourLabelStep(400, 40, 6), 6);
  assert.equal(hourLabelStep(100, 200, 2), 24);
});

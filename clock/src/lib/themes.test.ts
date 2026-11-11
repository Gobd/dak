import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLOCK_THEMES, clockThemeColors } from './themes.ts';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings.ts';
import { displayUrl, settingsFromParams } from './url.ts';

test('all starter palettes materialize editable colors and survive kiosk URLs with their theme', () => {
  assert.equal(CLOCK_THEMES.length, 5);
  for (const theme of CLOCK_THEMES) {
    let index = 0;
    const palette = clockThemeColors(theme.id, (token) => {
      assert.ok(token.startsWith(`--color-clock-${theme.id}-`));
      return `#${(++index).toString(16).padStart(6, '0')}`;
    });
    assert.equal(index, 6);
    const settings = {
      ...DEFAULT_SETTINGS,
      mode: 'linear' as const,
      ...palette,
      digitalTimeFormat: '12h' as const,
    };
    const url = new URL(displayUrl('https://example.com/clock/', settings, theme.dark, true));
    assert.equal(url.searchParams.get('theme'), theme.dark ? 'dark' : 'light');
    assert.deepEqual(normalizeSettings(settingsFromParams(url.searchParams)), settings);
    assert.equal(Object.hasOwn(palette, 'wipePast'), false);
    assert.equal(Object.hasOwn(palette, 'wipeOpacity'), false);
    for (const wipePast of [true, false]) {
      const previous = { ...DEFAULT_SETTINGS, wipePast, wipeOpacity: 63, wipeColor: '#293544' };
      const applied = { ...previous, ...palette };
      assert.equal(applied.wipePast, wipePast);
      assert.equal(applied.wipeOpacity, 63);
      assert.equal(applied.wipeColor, null);
    }
    assert.deepEqual(palette, {
      dayColor: '#000001',
      nightColor: '#000002',
      handColor: '#000003',
      secondColor: '#000004',
      barColor: '#000005',
      barTextColor: '#000006',
      wipeColor: null,
    });
  }
});

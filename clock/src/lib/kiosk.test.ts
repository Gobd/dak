import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scripts = fileURLToPath(new URL('../../scripts/', import.meta.url));

test('kiosk scripts have valid Bash syntax', () => {
  for (const script of ['setup-kiosk.sh', 'setup-kiosk-remote.sh', 'kiosk-launcher.sh']) {
    const result = spawnSync('bash', ['-n', join(scripts, script)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('launcher preserves URL as one literal argument without evaluating shell characters', () => {
  const home = mkdtempSync(join(tmpdir(), 'clock-kiosk-test-'));
  try {
    const config = join(home, '.config/clock-kiosk');
    const bin = join(home, 'bin');
    mkdirSync(config, { recursive: true });
    mkdirSync(bin);
    const url =
      "https://example.com/clock/?f=1&calendarKey=quoted'value&shell=$HOME;echo&hash=%23abcdef";
    writeFileSync(join(config, 'url'), `${url}\n`);
    writeFileSync(join(bin, 'chromium'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
    writeFileSync(
      join(bin, 'cage'),
      '#!/usr/bin/env bash\nprintf "%s\\0" "$@" > "$CAPTURE_ARGS"\n',
      { mode: 0o755 },
    );
    const capture = join(home, 'arguments');
    const result = spawnSync('bash', [join(scripts, 'kiosk-launcher.sh')], {
      env: {
        ...process.env,
        HOME: home,
        PATH: `${bin}:${process.env.PATH}`,
        CAPTURE_ARGS: capture,
      },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const args = readFileSync(capture, 'utf8').split('\0').filter(Boolean);
    assert.equal(args.at(-1), url);
    assert.ok(args.includes('--kiosk'));
    assert.ok(args.includes('--incognito'));
    assert.ok(!args.includes('--no-sandbox'));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

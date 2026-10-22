import assert from 'node:assert/strict';
import { test } from 'node:test';
import { servicePlist } from './service.ts';
test('launch agent runs direct TypeScript with absolute paths, escaped XML, and no embedded secrets', () => {
  const plist = servicePlist(
    '/projects/A & B',
    '/node/bin/node',
    '/bin:/tools/<local>',
    '/logs/Agent Voice',
  );
  assert.match(plist, /<string>\/node\/bin\/node<\/string>/);
  assert.match(plist, /--env-file-if-exists=\/projects\/A &amp; B\/.env.local/);
  assert.match(plist, /\/server\/main.ts/);
  assert.match(plist, /&lt;local&gt;/);
  assert.match(plist, /<key>KeepAlive<\/key><true\/>/);
  assert.doesNotMatch(plist, /PASSWORD|ACCESS_TOKEN/);
});

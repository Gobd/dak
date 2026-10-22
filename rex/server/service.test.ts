import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serviceConfigPaths, servicePlist } from './service.ts';

test('service config paths match manager defaults and resolve env overrides from the checkout', () => {
  assert.deepEqual(serviceConfigPaths('/projects/rex', {}), {
    Env: '/projects/rex/.env.local',
    Launchers: '/projects/rex/launchers.local.json',
    'Task harnesses': '/projects/rex/task-harnesses.local.json',
    'Scheduled tasks': '/projects/rex/scheduled-tasks.local.json',
  });
  assert.deepEqual(
    serviceConfigPaths('/projects/rex', {
      REX_PRESETS_FILE: '../launchers.json',
      REX_TASK_HARNESSES_FILE: '/config/harnesses.json',
      REX_TASKS_FILE: 'data/tasks.json',
    }),
    {
      Env: '/projects/rex/.env.local',
      Launchers: '/projects/launchers.json',
      'Task harnesses': '/config/harnesses.json',
      'Scheduled tasks': '/projects/rex/data/tasks.json',
    },
  );
});
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

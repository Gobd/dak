import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combinedBackend } from './combined.ts';
import { rexBackend } from './terminals.ts';

function fixture(unavailable = false) {
  const calls: { provider: string; args: string[] }[] = [];
  const make = (provider: string) =>
    rexBackend(async (args) => {
      calls.push({ provider, args });
      if (provider === 'cmux' && unavailable) throw new Error('Not running');
      if (args[0] === 'ls') return { sessions: [{ session_id: 'session:same', label: 'Project' }] };
      if (args[0] === 'block' && args[1] === 'ls')
        return {
          blocks: [
            { block_id: 'block:same', label: 'Agent', creator_name: 'com.superlogical.terminal' },
          ],
        };
      if (args[0] === 'server') return { rex_version: 'test' };
      if (args[0] === 'new') return { session_id: 'session:new', block_ids: ['block:new'] };
      return '';
    });
  return { backend: combinedBackend({ rex: make('rex'), cmux: make('cmux') }), calls };
}

test('combined discovery namespaces matching IDs and routes exact terminals to the correct app', async () => {
  const { backend, calls } = fixture();
  assert.deepEqual(
    (await backend.sessions()).map((session) => [session.session_id, session.provider]),
    [
      ['session:rex-same', 'rex'],
      ['session:cmux-same', 'cmux'],
    ],
  );
  assert.equal((await backend.blocks('session:cmux-same'))[0].block_id, 'block:cmux-same');
  await backend.send('session:cmux-same', 'block:cmux-same', 'Hello');
  assert.deepEqual(calls.at(-1), {
    provider: 'cmux',
    args: ['send', '-s', 'session:same', '-b', 'block:same', 'Hello'],
  });
  assert.throws(
    () => backend.send('session:rex-same', 'block:cmux-same', 'Wrong app'),
    /different app/,
  );
});

test('one unavailable app does not prevent discovery or launching in the other', async () => {
  const { backend } = fixture(true);
  assert.deepEqual((await backend.status()).connections, { rex: true, cmux: false });
  assert.equal((await backend.sessions()).length, 1);
  const created = await backend.launch({
    label: 'Test',
    cwd: '/projects/test',
    command: ['codex'],
  });
  assert.equal(created.session_id, 'session:rex-new');
  assert.equal(created.block_id, 'block:rex-new');
});

test('new agents require a destination when both apps are available', async () => {
  const { backend } = fixture();
  const options = { label: 'Test', cwd: '/projects/test', command: ['codex'] };
  await assert.rejects(backend.launch(options), /Choose Rex or cmux/);
  assert.equal(
    (await backend.launch({ ...options, provider: 'cmux' })).session_id,
    'session:cmux-new',
  );
});

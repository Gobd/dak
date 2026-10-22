import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cmuxBackend, launchCommand, rexBackend, shellQuote } from './terminals.ts';
import { ProgramStatusStore } from './program-status.ts';
import { activityEvent, shouldAnnounce } from '../shared/terminal.ts';

const workspace = '11111111-1111-4111-8111-111111111111';
const surface = '22222222-2222-4222-8222-222222222222';
const session = 'session:' + workspace;
const block = 'block:' + surface;

test('voice wrapper overrides preserve both wrapper and harness argument ordering', () => {
  const command = [
    'lambdap',
    '--self-contained',
    '--greywall',
    'pi',
    '--no-mcp',
    '--thinking',
    'high',
  ];
  assert.deepEqual(launchCommand(command, ['--no-mcp']), [
    'lambdap',
    '--self-contained',
    '--no-mcp',
    'pi',
    '--no-mcp',
    '--thinking',
    'high',
  ]);
  assert.deepEqual(launchCommand(command), command);
  assert.deepEqual(launchCommand(command, []).slice(0, 3), ['lambdap', '--self-contained', 'pi']);
  assert.throws(() => launchCommand(command, ['--arbitrary']));
  assert.throws(() => launchCommand(['pi'], ['--greywall']));
});

test('cmux normalizes all windows and excludes browser surfaces', async () => {
  const backend = cmuxBackend(async (args) => {
    if (args.includes('tree'))
      return {
        windows: [
          { workspaces: [{ id: workspace, title: 'Project' }] },
          { workspaces: [{ id: 'other', title: 'Other' }] },
        ],
      };
    return {
      surfaces: [
        { id: surface, title: 'Pi', type: 'terminal' },
        { id: 'browser', type: 'browser' },
      ],
    };
  });
  assert.equal((await backend.sessions()).length, 2);
  assert.deepEqual(await backend.blocks(session), [
    { block_id: block, label: 'Pi', creator_name: 'com.superlogical.terminal' },
  ]);
});

test('cmux launches either one workspace terminal or a terminal in the named workspace', async () => {
  const calls: string[][] = [];
  const backend = cmuxBackend(async (args) => {
    calls.push(args);
    return { workspace_id: workspace, surface_id: surface };
  });
  const options = {
    label: 'Pi',
    cwd: '/projects/mainhost',
    command: ['lambdap', '--greywall', '--no-mcp', 'pi', "a'b", '$(touch unwanted)'],
  };
  assert.deepEqual(await backend.launch(options), { session_id: session, block_id: block });
  assert.ok(calls[0].includes('create'));
  assert.equal(
    calls[0][calls[0].indexOf('--command') + 1],
    options.command.map(shellQuote).join(' '),
  );
  await backend.launch({ ...options, session });
  assert.ok(calls[1].includes('new-surface'));
  assert.equal(calls[1][calls[1].indexOf('--workspace') + 1], workspace);
  assert.equal(calls.length, 2);
});

test('cmux uses literal paste input and named keys with explicit workspace and surface', async () => {
  const calls: string[][] = [];
  const backend = cmuxBackend(async (args) => {
    calls.push(args);
    return '';
  });
  await backend.send(session, block, String.raw`Explain \n and --force`);
  await backend.key(session, block, 'enter');
  assert.deepEqual(calls[0], [
    'send',
    '--workspace',
    workspace,
    '--surface',
    surface,
    '--paste',
    '--',
    String.raw`Explain \n and --force`,
  ]);
  assert.deepEqual(calls[1], ['send-key', '--workspace', workspace, '--surface', surface, 'enter']);
  assert.throws(() => backend.capture('session:wrong', block));
});

test('both adapters supply the same native status records', async () => {
  const records = [{ state: 'blocked', kind: 'permission' }];
  const rex = rexBackend(async () => ({ records }));
  const cmux = cmuxBackend(
    async () => {
      throw new Error('No lifecycle fallback expected');
    },
    async () => records,
  );
  assert.deepEqual(await rex.activity('session:one', 'block:one'), records);
  assert.deepEqual(await cmux.activity(session, block), records);
});

function frame(records: { state: string }[], extra = {}) {
  return {
    type: 'event',
    boot_id: 'boot-one',
    name: 'program_status.changed',
    workspace_id: workspace,
    surface_id: surface,
    payload: {
      records,
      records_total: records.length,
      snapshot_id: 'one',
      snapshot_index: 0,
      snapshot_count: 1,
      ...extra,
    },
  };
}
test('cmux status snapshots reassemble chunks and preserve complete state until replacement', () => {
  const store = new ProgramStatusStore();
  store.accept(frame([{ state: 'working' }]));
  store.accept(
    frame([{ state: 'blocked' }], { snapshot_id: 'two', snapshot_count: 2, records_total: 2 }),
  );
  assert.equal(store.get(workspace, surface)?.[0].state, 'working');
  store.accept(
    frame([{ state: 'idle' }], {
      snapshot_id: 'two',
      snapshot_count: 2,
      snapshot_index: 1,
      records_total: 2,
    }),
  );
  assert.deepEqual(store.get(workspace, surface), [{ state: 'blocked' }, { state: 'idle' }]);
  store.accept(frame([], { snapshot_id: 'cleared' }));
  assert.deepEqual(store.get(workspace, surface), []);
});

test('cmux restart and replay gaps discard stale status', () => {
  const store = new ProgramStatusStore();
  store.accept(frame([{ state: 'blocked' }]));
  store.accept({ type: 'ack', boot_id: 'boot-two' });
  assert.equal(store.get(workspace, surface), undefined);
  store.accept({ ...frame([{ state: 'done' }]), boot_id: 'boot-two' });
  store.accept({ type: 'ack', boot_id: 'boot-two', resume: { gap: true } });
  assert.equal(store.get(workspace, surface), undefined);
});

test('shared voice policy announces state changes, ignores progress, and never treats a quiet screen as idle', () => {
  const initial = activityEvent([{ state: 'idle' }]);
  assert.equal(shouldAnnounce(initial), false);
  const working = activityEvent([{ state: 'working' }]);
  assert.equal(shouldAnnounce(working), false);
  const blocked = activityEvent(
    [{ state: 'working' }, { state: 'blocked', kind: 'question' }],
    working,
  );
  assert.equal(blocked?.state, 'blocked');
  assert.equal(shouldAnnounce(blocked, working), true);
  assert.equal(
    shouldAnnounce(activityEvent([{ state: 'blocked', kind: 'question' }], blocked), blocked),
    false,
  );
  assert.equal(shouldAnnounce(activityEvent([{ state: 'idle' }], working), working), true);
  assert.equal(shouldAnnounce(activityEvent([], working), working), false);
});

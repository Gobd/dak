import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConversationManager } from './conversation.ts';

function context(message, conversation = 'phone-one') {
  return {
    message,
    conversation,
    history: [],
    presets: [{ id: 'claude', label: 'Claude', cwd: '/projects' }],
    sessions: [{ session_id: 'session:one', label: 'Claude' }],
    snapshot: [
      { session_id: 'session:one', terminals: [{ block_id: 'block:one', screen: 'No / Yes' }] },
    ],
    projectsRoot: '/projects',
  };
}

test('AI manager searches project folders then starts the configured harness', async () => {
  const actions = [];
  let round = 0;
  const manager = createConversationManager({
    runAgent: async (prompt) => {
      assert.match(prompt, /under 60 words/);
      round++;
      if (round === 1)
        return JSON.stringify({
          reply: '',
          action: { type: 'search_folders', query: 'mainhost prod' },
        });
      assert.match(prompt, /mainhost-prod/);
      return JSON.stringify({
        reply: '',
        action: {
          type: 'launch',
          preset: 'claude',
          cwd: '/projects/mainhost-prod',
          label: 'claude-mainhost',
        },
      });
    },
    searchFolders: async (query) => {
      assert.equal(query, 'mainhost prod');
      return { directories: [{ name: 'mainhost-prod', path: '/projects/mainhost-prod' }] };
    },
    launch: async (action) => {
      actions.push(action);
      return { session_id: 'session:new', label: action.label, cwd: action.cwd };
    },
  });
  const result = await manager(context('Start Claude in mainhost prod'));
  assert.equal(result.session, 'session:new');
  assert.equal(actions.length, 1);
  assert.match(result.text, /Started claude-mainhost/);
});

test('numbered folder choices are read and a spoken number uses the remembered action', async () => {
  let calls = 0;
  const manager = createConversationManager({
    runAgent: async () => {
      calls++;
      return JSON.stringify({
        reply: 'Which project?',
        choices: [
          {
            label: 'Mainhost prod',
            action: { type: 'launch', preset: 'claude', cwd: '/projects/mainhost-prod' },
          },
          {
            label: 'Mainhost base',
            action: { type: 'launch', preset: 'claude', cwd: '/projects/mainhost-base' },
          },
        ],
      });
    },
    launch: async (action) => ({ session_id: 'session:new', label: 'Claude', cwd: action.cwd }),
  });
  const options = await manager(context('Start Claude in mainhost'));
  assert.match(options.text, /1: Mainhost prod.*2: Mainhost base/);
  const result = await manager(context('two'));
  assert.equal(calls, 1);
  assert.match(result.text, /mainhost-base/);
});

test('voice choices belong to one conversation and out-of-range numbers do not launch', async () => {
  let launched = false;
  const manager = createConversationManager({
    runAgent: async () =>
      JSON.stringify({
        reply: 'Choose a folder.',
        choices: [
          { label: 'Project', action: { type: 'launch', preset: 'claude', cwd: '/projects' } },
        ],
      }),
    launch: async () => {
      launched = true;
      return {};
    },
  });
  await manager(context('Start Claude'));
  const other = await manager(context('one', 'phone-two'));
  assert.ok(other.choices);
  assert.equal(launched, false);
  assert.match((await manager(context('three'))).text, /one to 1/);
  assert.equal(launched, false);
});

test('spoken yes selects the visible trust option using keys, not typed text', async () => {
  const sent = [];
  const manager = createConversationManager({
    runAgent: async () =>
      JSON.stringify({
        reply: 'Do you trust this folder?',
        choices: [
          {
            label: 'No, exit',
            action: { type: 'keys', session: 'session:one', block: 'block:one', keys: ['enter'] },
          },
          {
            label: 'Yes, trust this folder',
            action: {
              type: 'keys',
              session: 'session:one',
              block: 'block:one',
              keys: ['down', 'enter'],
            },
          },
        ],
      }),
    readScreen: async () => 'No / Yes',
    keys: async (action) => sent.push(action.keys),
  });
  await manager(context('Read the options'));
  await manager(context('yes'));
  assert.deepEqual(sent, [['down', 'enter']]);
});

test('a changed prompt is read again rather than applying a stale voice choice', async () => {
  let pressed = false;
  const manager = createConversationManager({
    runAgent: async () =>
      JSON.stringify({
        reply: 'One option.',
        choices: [
          {
            label: 'Continue',
            action: { type: 'keys', session: 'session:one', block: 'block:one', keys: ['enter'] },
          },
        ],
      }),
    readScreen: async () => 'A different prompt',
    keys: async () => {
      pressed = true;
    },
  });
  await manager(context('Read options'));
  assert.match((await manager(context('one'))).text, /prompt changed/);
  assert.equal(pressed, false);
});

test('plain model replies remain compatible and do not execute actions', async () => {
  const manager = createConversationManager({
    runAgent: async () => 'Your agent is running tests.',
  });
  assert.equal((await manager(context('What is running?'))).text, 'Your agent is running tests.');
});

test('more than five folder matches asks for specificity without launching or reading a long list', async () => {
  let calls = 0;
  const manager = createConversationManager({
    runAgent: async () => {
      calls++;
      return JSON.stringify({ reply: '', action: { type: 'search_folders', query: 'mainhost' } });
    },
    searchFolders: async () => ({
      directories: Array.from({ length: 6 }, (_, i) => ({
        name: 'mainhost-' + i,
        path: '/projects/' + i,
      })),
    }),
    launch: async () => {
      throw new Error('Must not launch');
    },
  });
  assert.match((await manager(context('Start Pi in mainhost'))).text, /more specific/);
  assert.equal(calls, 1);
});

test('more than five model choices asks for specificity', async () => {
  const manager = createConversationManager({
    runAgent: async () =>
      JSON.stringify({
        reply: 'Pick one',
        choices: Array.from({ length: 6 }, () => ({
          label: 'Folder',
          action: { type: 'launch', preset: 'pi', cwd: '/projects' },
        })),
      }),
  });
  const result = await manager(context('Start Pi'));
  assert.match(result.text, /more specific/);
  assert.equal(result.choices, undefined);
});

test('automatic status observations can offer menu choices but cannot execute mutations', async () => {
  let pressed = 0;
  let mode = 'action';
  const action = { type: 'keys', session: 'session:one', block: 'block:one', keys: ['enter'] };
  const manager = createConversationManager({
    runAgent: async () =>
      JSON.stringify(
        mode === 'action'
          ? { reply: '', action }
          : { reply: 'Continue?', choices: [{ label: 'Yes, continue', action }] },
      ),
    readScreen: async () => 'No / Yes',
    keys: async () => {
      pressed++;
    },
  });
  const observation = {
    ...context('Agent needs input'),
    observation: true,
    session: 'session:one',
    block: 'block:one',
  };
  await manager(observation);
  assert.equal(pressed, 0);
  mode = 'choices';
  assert.ok((await manager(observation)).choices);
  assert.equal(pressed, 0);
  await manager(context('yes'));
  assert.equal(pressed, 1);
});

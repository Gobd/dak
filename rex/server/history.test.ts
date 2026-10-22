import assert from 'node:assert/strict';
import { appendFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseConversation, readConversation, streamHistory, terminalHistory } from './history.ts';
import { rexBackend } from './terminals.ts';

const id = '11111111-1111-4111-8111-111111111111';
const jsonl = (...rows: unknown[]) => rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
const codexMessage = (role: string, text: string, extra = {}) => ({
  type: 'response_item',
  payload: {
    type: 'message',
    role,
    content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
    ...extra,
  },
});

test('Codex history includes chronological chat and excludes context, reasoning, tool data and partial writes', () => {
  const data =
    jsonl(
      codexMessage('system', 'Private instructions'),
      codexMessage('user', '<environment_context>private context</environment_context>'),
      codexMessage('user', 'Fix the sidebar'),
      { type: 'response_item', payload: { type: 'function_call_output', output: 'Tool result' } },
      codexMessage('assistant', 'Private analysis', { channel: 'analysis' }),
      codexMessage('assistant', 'I am checking it.', { phase: 'commentary' }),
      codexMessage('assistant', 'Fixed.', { phase: 'final_answer' }),
    ) + '{"incomplete":';
  assert.deepEqual(parseConversation(data, 'codex'), [
    { role: 'user', text: 'Fix the sidebar' },
    { role: 'assistant', text: 'I am checking it.', phase: 'commentary' },
    { role: 'assistant', text: 'Fixed.', phase: 'final_answer' },
  ]);
});

test('Codex waits for confirmed chat messages and never exposes compaction summaries', () => {
  const message = (id: string, text: string, phase = 'final_answer') =>
    codexMessage('assistant', text, {
      id,
      phase,
      internal_chat_message_metadata_passthrough: { turn_id: 'turn-one' },
    });
  const complete = (id: string) => ({
    type: 'event_msg',
    payload: {
      type: 'item_completed',
      item: { type: 'AgentMessage', id },
    },
  });
  const summary = message('summary', 'Internal handoff details');
  const data = jsonl(
    codexMessage('user', 'Fix it'),
    message('progress', 'Checking.', 'commentary'),
    complete('progress'),
    message('reply', 'Fixed.'),
    complete('reply'),
    summary,
  );
  const expected = [
    { role: 'user', text: 'Fix it' },
    { role: 'assistant', text: 'Checking.', phase: 'commentary' },
    { role: 'assistant', text: 'Fixed.', phase: 'final_answer' },
  ];
  assert.deepEqual(parseConversation(data, 'codex'), expected);
  assert.deepEqual(
    parseConversation(
      data +
        jsonl({
          type: 'compacted',
          payload: {
            message:
              'Another language model started to solve this problem and produced a summary of its thinking process. Internal handoff details',
          },
        }),
      'codex',
    ),
    expected,
  );
  assert.deepEqual(parseConversation(jsonl(message('pending', 'A real answer')), 'codex'), []);
  assert.equal(
    parseConversation(jsonl(message('pending', 'A real answer'), complete('pending')), 'codex')[0]
      .text,
    'A real answer',
  );
});

test('Codex supports older completion events and hides injected handoff context', () => {
  assert.deepEqual(
    parseConversation(
      jsonl(
        codexMessage(
          'user',
          'Another language model started to solve this problem and produced a summary of its thinking process. Private handoff',
        ),
        codexMessage('assistant', 'Done', { internal_chat_message_metadata_passthrough: {} }),
        { type: 'event_msg', payload: { type: 'task_complete', last_agent_message: 'Done' } },
      ),
      'codex',
    ),
    [{ role: 'assistant', text: 'Done' }],
  );
});

test('Claude and Pi histories show chat text without tool results or sidechains', () => {
  assert.deepEqual(
    parseConversation(
      jsonl(
        { type: 'user', message: { role: 'user', content: 'Hello' } },
        {
          type: 'user',
          message: { role: 'user', content: [{ type: 'tool_result', content: 'secret' }] },
        },
        {
          type: 'assistant',
          isSidechain: true,
          message: { role: 'assistant', content: [{ type: 'text', text: 'Other agent' }] },
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'analysis' },
              { type: 'text', text: 'Hi' },
            ],
          },
        },
      ),
      'claude',
    ),
    [
      { role: 'user', text: 'Hello' },
      { role: 'assistant', text: 'Hi' },
    ],
  );
  assert.deepEqual(
    parseConversation(
      jsonl({
        type: 'message',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Pi answer' }] },
      }),
      'pi',
    ),
    [{ role: 'assistant', text: 'Pi answer' }],
  );
});

test('conversation lookup uses the exact checkpoint and ignores unsupported or invalid IDs', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'rex-transcript-'));
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = join(home, '.codex');
  t.after(() => {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
  });
  const directory = join(home, '.codex', 'sessions', '2026', '10', '22');
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, `rollout-${id}.jsonl`),
    jsonl(codexMessage('user', 'This exact conversation')),
  );
  assert.equal(
    (await readConversation({ kind: 'codex', id }, home))?.messages[0].text,
    'This exact conversation',
  );
  assert.equal(await readConversation({ kind: 'codex', id: '../../other' }, home), undefined);
  assert.equal(await readConversation({ kind: 'unknown', id }, home), undefined);
});

test('Codex activity retains the actual task start and stops on matching completion or interruption', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'rex-activity-'));
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = home;
  t.after(() => {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
  });
  const directory = join(home, 'sessions');
  await mkdir(directory);
  const path = join(directory, `rollout-${id}.jsonl`);
  const link = { kind: 'codex', id };
  const start = {
    type: 'event_msg',
    timestamp: '2026-10-22T21:47:19.000Z',
    payload: { type: 'task_started', turn_id: 'current', started_at: 1792705638 },
  };
  const complete = (turn_id: string, type = 'task_complete') => ({
    type: 'event_msg',
    payload: { type, turn_id },
  });
  await writeFile(path, jsonl(start));
  const working = { state: 'working', startedAt: '2026-10-22T21:47:18.000Z' };
  assert.deepEqual((await readConversation(link))?.activity, working);
  assert.deepEqual((await readConversation(link))?.messages, []);
  await appendFile(path, jsonl(complete('older')));
  assert.deepEqual((await readConversation(link))?.activity, working);
  const backend = rexBackend(async () => '');
  backend.describe = async () => ({ agent: true, conversation: link });
  backend.activity = async () => [{ state: 'blocked' }];
  assert.deepEqual((await terminalHistory(backend, 'session:test', 'block:test')).activity, {
    state: 'blocked',
  });
  backend.activity = async () => [{ state: 'working' }];
  assert.deepEqual(
    (await terminalHistory(backend, 'session:test', 'block:test')).activity,
    working,
  );
  await appendFile(path, jsonl(complete('current')));
  assert.deepEqual((await readConversation(link))?.activity, { state: 'done' });
  await appendFile(path, jsonl(start, complete('current', 'turn_aborted')));
  assert.deepEqual((await readConversation(link))?.activity, { state: 'idle' });
  await appendFile(path, jsonl({ ...start, payload: { ...start.payload, started_at: 1e20 } }));
  assert.deepEqual((await readConversation(link))?.activity, { state: 'working' });
});

test('history stream pushes saved messages promptly and sends no unchanged duplicate snapshot', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'rex-stream-'));
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = home;
  t.after(() => {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
  });
  await mkdir(join(home, 'sessions'));
  const path = join(home, 'sessions', `rollout-${id}.jsonl`);
  await writeFile(path, jsonl(codexMessage('user', 'Hello')));
  const backend = rexBackend(async () => '');
  backend.describe = async () => ({ agent: true, conversation: { kind: 'codex', id } });
  const server = createServer((_request, response) =>
    streamHistory(response, backend, 'session:test', 'block:test'),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  const controller = new AbortController();
  t.after(() => controller.abort());
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}`, { signal: controller.signal });
  assert.match(response.headers.get('content-type') || '', /text\/event-stream/);
  const reader = response.body!.getReader();
  let output = '';
  const until = async (text: string) => {
    while (!output.includes(text)) {
      const next = await reader.read();
      assert.equal(next.done, false);
      output += new TextDecoder().decode(next.value);
    }
  };
  await until('Hello');
  const start = Date.now();
  await appendFile(
    path,
    jsonl(codexMessage('assistant', 'Fresh reply', { phase: 'final_answer' })),
  );
  await Promise.race([
    until('Fresh reply'),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Stream update timed out')), 1800),
    ),
  ]);
  assert.ok(Date.now() - start < 1800);
  assert.equal(output.split('event: history').length - 1, 2);
  controller.abort();
});

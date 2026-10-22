import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNtfyNotifier, notificationMessage, validateTopic } from './ntfy.ts';
const task = { id: 'one', label: 'Jira summary', notifyTopic: 'my-private-topic' };
const run = {
  status: 'succeeded',
  output: 'You have three assigned tickets.\n\nThe highest priority is ABC-123.',
};
test('ntfy preserves paragraph summaries and publishes JSON with Mac-only authentication', async () => {
  let sent;
  const notifier = createNtfyNotifier(
    'https://push.example.com',
    'test-token',
    async (url, options) => {
      sent = { url: String(url), ...options };
      return new Response('{}', { status: 200 });
    },
  );
  await notifier(task, run, new AbortController().signal);
  assert.equal(sent.url, 'https://push.example.com/');
  assert.equal(sent.headers.Authorization, 'Bearer test-token');
  const payload = JSON.parse(sent.body);
  assert.equal(payload.topic, task.notifyTopic);
  assert.equal(payload.message, run.output);
  assert.equal(payload.title, 'Jira summary finished');
});
test('ntfy clips by UTF-8 bytes without corrupting emoji or exceeding the limit', () => {
  const message = notificationMessage({ output: '😀'.repeat(2000) });
  assert.ok(Buffer.byteLength(message, 'utf8') <= 3500);
  assert.ok(message.endsWith('…'));
  assert.equal(message.includes('\ufffd'), false);
  assert.equal(notificationMessage({ output: 'é'.repeat(1700) }).length, 1700);
});
test('topics are validated, blank topics send nothing, and publish failures are reported', async () => {
  for (const topic of ['../other', 'topic?token=secret', 'x'.repeat(65)])
    assert.throws(() => validateTopic(topic));
  assert.equal(validateTopic(''), undefined);
  let calls = 0;
  const notifier = createNtfyNotifier(undefined, undefined, async () => {
    calls++;
    return new Response('', { status: 403 });
  });
  await notifier({ ...task, notifyTopic: undefined }, run, new AbortController().signal);
  assert.equal(calls, 0);
  await assert.rejects(
    notifier(
      task,
      { ...run, status: 'failed', error: 'MCP unavailable.' },
      new AbortController().signal,
    ),
    /HTTP 403/,
  );
  assert.equal(calls, 1);
  assert.throws(() => createNtfyNotifier('file:///etc/passwd'));
});

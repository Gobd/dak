import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { test } from 'node:test';
import { createTaskScheduler, executeTask, nextRun, validateSchedule } from './tasks.ts';

async function fixture(t, extra = {}) {
  const base = resolve('node_modules/.tmp');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, 'tasks-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let clock = Date.parse('2026-10-22T15:00:00Z');
  const file = join(directory, 'tasks.json');
  const options = {
    file,
    now: () => clock,
    validate: async (input) => input,
    run: async () => 'All tests passed.',
    ...extra,
  };
  const scheduler = createTaskScheduler(options);
  t.after(() => scheduler.close());
  await scheduler.ready;
  const input = {
    label: 'Check PR',
    harness: 'pi',
    cwd: directory,
    prompt: 'Check PR 12.',
    schedule: { kind: 'interval', minutes: 10 },
  };
  return {
    scheduler,
    options,
    file,
    input,
    advance: (milliseconds) => {
      clock += milliseconds;
    },
  };
}
async function finish(scheduler) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      !(await scheduler.listing()).runs.some(
        (run) => run.status === 'running' || run.notification === 'pending',
      )
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Task did not finish.');
}
test('schedule validation rejects ambiguous timestamps, unsupported intervals and invalid timezones', () => {
  for (const value of [
    { kind: 'once', at: '2026-10-22T09:00' },
    { kind: 'interval', minutes: 0 },
    { kind: 'interval', minutes: 1.5 },
    { kind: 'daily', time: '25:00', timezone: 'UTC' },
    { kind: 'daily', time: '09:00', timezone: 'bad' },
    { kind: 'weekly', time: '09:00', timezone: 'UTC', days: [] },
    { kind: 'cron', expression: '* * * * *' },
  ])
    assert.throws(() => validateSchedule(value));
});
test('daily and weekday schedules respect timezone and daylight saving transitions', () => {
  assert.equal(
    nextRun(
      { kind: 'daily', time: '09:00', timezone: 'America/Denver' },
      Date.parse('2026-10-22T14:00:00Z'),
    ),
    '2026-10-22T15:00:00.000Z',
  );
  assert.equal(
    nextRun(
      { kind: 'weekly', time: '09:00', timezone: 'America/Denver', days: [1, 2, 3, 4, 5] },
      Date.parse('2026-10-23T15:00:00Z'),
    ),
    '2026-10-26T15:00:00.000Z',
  );
  assert.equal(
    nextRun(
      { kind: 'daily', time: '02:30', timezone: 'America/Denver' },
      Date.parse('2026-03-08T07:00:00Z'),
    ),
    '2026-03-09T08:30:00.000Z',
  );
  assert.equal(
    nextRun(
      { kind: 'daily', time: '09:00', timezone: 'America/Denver' },
      Date.parse('2026-11-01T07:00:00Z'),
    ),
    '2026-11-01T16:00:00.000Z',
  );
});
test('tasks and run results persist, manual runs do not change the schedule, and pause survives restart', async (t) => {
  const { scheduler, options, file, input } = await fixture(t);
  const task = await scheduler.upsert(input);
  const run = await scheduler.run(task.id);
  assert.equal(run.status, 'running');
  await finish(scheduler);
  assert.equal((await scheduler.listing()).tasks[0].nextRun, task.nextRun);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).runs[0].output, 'All tests passed.');
  await scheduler.change(task.id, 'pause');
  scheduler.close();
  const restarted = createTaskScheduler(options);
  t.after(() => restarted.close());
  assert.equal((await restarted.listing()).tasks[0].enabled, false);
  await restarted.change(task.id, 'resume');
  assert.equal((await restarted.listing()).tasks[0].enabled, true);
  await restarted.change(task.id, 'delete');
  assert.equal((await restarted.listing()).tasks.length, 0);
  assert.equal((await restarted.listing()).runs.length, 1);
});
test('due task runs exactly once even with concurrent ticks, and tasks cannot overlap', async (t) => {
  let release;
  let calls = 0;
  const { scheduler, input, advance } = await fixture(t, {
    run: async () => {
      calls++;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  const task = await scheduler.upsert(input);
  advance(600000);
  await Promise.allSettled([scheduler.tick(), scheduler.tick()]);
  assert.equal(calls, 1);
  await assert.rejects(scheduler.run(task.id), /already running/);
  await assert.rejects(scheduler.change(task.id, 'delete'), /finish/);
  await assert.rejects(scheduler.upsert(input, task.id), /finish/);
  release('Finished.');
  await finish(scheduler);
  await scheduler.tick();
  assert.equal(calls, 1);
});
test('sleep skips missed recurring runs but catches up a one-time task once', async (t) => {
  const { scheduler, input, advance } = await fixture(t);
  const recurring = await scheduler.upsert(input);
  const once = await scheduler.upsert({
    ...input,
    schedule: { kind: 'once', at: '2026-10-22T15:05:00Z' },
  });
  advance(3600000);
  await scheduler.tick();
  await finish(scheduler);
  const listing = await scheduler.listing();
  assert.equal(listing.runs.length, 1);
  assert.equal(listing.runs[0].taskId, once.id);
  assert.equal(listing.tasks.find((task) => task.id === once.id).enabled, false);
  assert.equal(
    listing.tasks.find((task) => task.id === recurring.id).nextRun,
    '2026-10-22T16:10:00.000Z',
  );
  await scheduler.tick();
  assert.equal((await scheduler.listing()).runs.length, 1);
});
test('a failed task records the error and does not block later tasks', async (t) => {
  const { scheduler, input } = await fixture(t, {
    run: async () => {
      throw new Error('Authentication required.');
    },
  });
  const task = await scheduler.upsert(input);
  await scheduler.run(task.id);
  await finish(scheduler);
  assert.equal((await scheduler.listing()).runs[0].error, 'Authentication required.');
  await scheduler.run(task.id);
  await finish(scheduler);
  assert.equal((await scheduler.listing()).runs.length, 2);
});
test('restart marks interrupted runs failed without retrying and corrupt stores fail closed', async (t) => {
  const { scheduler, options, file, input } = await fixture(t);
  const task = await scheduler.upsert(input);
  scheduler.close();
  const state = JSON.parse(await readFile(file, 'utf8'));
  state.runs = [
    {
      id: 'run',
      taskId: task.id,
      label: task.label,
      harness: 'pi',
      status: 'running',
      startedAt: '2026-10-22T15:00:00Z',
      output: '',
    },
  ];
  await writeFile(file, JSON.stringify(state));
  const restarted = createTaskScheduler(options);
  t.after(() => restarted.close());
  assert.match((await restarted.listing()).runs[0].error, /Not retried/);
  await writeFile(file, '{broken');
  const broken = createTaskScheduler(options);
  await assert.rejects(broken.ready);
  assert.equal(await readFile(file, 'utf8'), '{broken');
});
test('shutdown aborts an active harness and persists a failed result', async (t) => {
  const { scheduler, input } = await fixture(t, {
    run: async (_task, signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('Stopped.')), { once: true }),
      ),
  });
  const task = await scheduler.upsert(input);
  await scheduler.run(task.id);
  scheduler.close();
  await finish(scheduler);
  assert.equal((await scheduler.listing()).runs[0].status, 'failed');
});
test('task execution passes prompt as literal argv, closes stdin and reports process failures', async () => {
  const prompt = '--model evil; $(echo hacked) `echo bad`\nDo work.';
  const output = await executeTask(
    [
      process.execPath,
      '-e',
      'process.stdin.resume(); process.stdin.on("end", () => console.log(process.argv[1]))',
      '--',
    ],
    process.cwd(),
    prompt,
    new AbortController().signal,
  );
  assert.ok(output.includes(prompt));
  await assert.rejects(
    executeTask(
      [process.execPath, '-e', 'console.error("MCP unavailable"); process.exit(1)', '--'],
      process.cwd(),
      'Check.',
      new AbortController().signal,
    ),
    /MCP unavailable/,
  );
});

test('task push results are persisted and a notification failure leaves harness success intact', async (t) => {
  let shouldFail = false;
  const messages = [];
  const { scheduler, input, file } = await fixture(t, {
    notify: async (task, run) => {
      messages.push({ task, run });
      if (shouldFail) throw new Error('ntfy offline');
    },
  });
  const task = await scheduler.upsert({ ...input, notifyTopic: 'my-topic' });
  await scheduler.run(task.id);
  await finish(scheduler);
  assert.equal(messages[0].task.notifyTopic, 'my-topic');
  assert.equal((await scheduler.listing()).runs[0].notification, 'sent');
  assert.equal(JSON.parse(await readFile(file, 'utf8')).runs[0].notification, 'sent');
  shouldFail = true;
  await scheduler.run(task.id);
  await finish(scheduler);
  const run = (await scheduler.listing()).runs[0];
  assert.equal(run.status, 'succeeded');
  assert.equal(run.notification, 'failed');
  assert.equal(run.notificationError, 'ntfy offline');
});

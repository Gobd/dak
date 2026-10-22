import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import type { TaskNotifier } from './ntfy.ts';
import type {
  ScheduledTask,
  TaskInput,
  TaskRun,
  TaskSchedule,
  TaskHarness,
} from '../shared/tasks.ts';

export class TaskError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function validateSchedule(value: unknown): TaskSchedule {
  const schedule = value as TaskSchedule;
  if (!schedule || typeof schedule !== 'object') throw new TaskError('Choose a schedule.');
  if (schedule.kind === 'once') {
    if (
      typeof schedule.at !== 'string' ||
      !Number.isFinite(Date.parse(schedule.at)) ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(schedule.at)
    )
      throw new TaskError('Choose a date with a timezone.');
    return { kind: 'once', at: new Date(schedule.at).toISOString() };
  }
  if (schedule.kind === 'interval') {
    if (!Number.isInteger(schedule.minutes) || schedule.minutes < 1 || schedule.minutes > 525600)
      throw new TaskError('Intervals must be between 1 and 525600 minutes.');
    return { kind: 'interval', minutes: schedule.minutes };
  }
  if (schedule.kind !== 'daily' && schedule.kind !== 'weekly')
    throw new TaskError('Unknown schedule.');
  if (typeof schedule.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time))
    throw new TaskError('Choose a time in HH:MM format.');
  try {
    if (typeof schedule.timezone !== 'string' || !schedule.timezone) throw new Error();
    new Intl.DateTimeFormat('en', { timeZone: schedule.timezone });
  } catch {
    throw new TaskError('Choose a valid IANA timezone.');
  }
  if (schedule.kind === 'daily')
    return { kind: 'daily', time: schedule.time, timezone: schedule.timezone };
  if (
    !Array.isArray(schedule.days) ||
    !schedule.days.length ||
    schedule.days.length > 7 ||
    schedule.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw new TaskError('Choose weekdays numbered Sunday 0 through Saturday 6.');
  return {
    kind: 'weekly',
    time: schedule.time,
    timezone: schedule.timezone,
    days: [...new Set(schedule.days)].sort(),
  };
}
export function nextRun(schedule: TaskSchedule, after: number): string | null {
  if (schedule.kind === 'once') return Date.parse(schedule.at) > after ? schedule.at : null;
  if (schedule.kind === 'interval') return new Date(after + schedule.minutes * 60000).toISOString();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: schedule.timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const start = Math.floor(after / 60000) * 60000 + 60000;
  // Scan actual instants: nonexistent DST times are skipped, repeated times run once a day.
  for (let instant = start; instant <= start + 8 * 86400000; instant += 60000) {
    const parts = Object.fromEntries(
      formatter.formatToParts(instant).map((part) => [part.type, part.value]),
    );
    if (
      parts.hour + ':' + parts.minute === schedule.time &&
      (schedule.kind === 'daily' || schedule.days.includes(days.indexOf(parts.weekday)))
    )
      return new Date(instant).toISOString();
  }
  throw new TaskError('Could not find the next scheduled time.');
}
const execute = promisify(execFile);
export async function executeTask(
  command: string[],
  cwd: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  const pending = execute(
    command[0],
    [
      ...command.slice(1),
      'Scheduled task request:\n' +
        prompt +
        '\n\nWhen finished, give the user a result summary. Follow their requested length and format; otherwise keep it concise.',
    ],
    {
      cwd,
      signal,
      timeout: 15 * 60000,
      maxBuffer: 1024 * 1024,
      env: process.env,
    },
  );
  pending.child.stdin?.end();
  try {
    const { stdout } = await pending;
    if (!stdout.trim()) throw new Error('The harness returned no output.');
    return stdout.trim();
  } catch (error) {
    const failure = error as Error & { stderr?: string; killed?: boolean };
    throw new Error(
      signal.aborted
        ? 'Task stopped with the manager.'
        : failure.killed
          ? 'Task exceeded its 15-minute time or output limit.'
          : (failure.stderr?.trim() || failure.message).slice(-4000),
    );
  }
}
interface State {
  version: 1;
  tasks: ScheduledTask[];
  runs: TaskRun[];
}
interface Options {
  file: string;
  validate: (input: TaskInput) => Promise<TaskInput>;
  run: (task: ScheduledTask, signal: AbortSignal) => Promise<string>;
  now?: () => number;
  notify?: TaskNotifier;
}
export function createTaskScheduler(options: Options) {
  const now = options.now || Date.now;
  let state: State = { version: 1, tasks: [], runs: [] };
  let queue: Promise<unknown> = Promise.resolve();
  let active: { taskId: string; controller: AbortController } | undefined;
  let closed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const pending = queue.then(work);
    queue = pending.catch(() => {});
    return pending;
  }
  async function save(next: State) {
    await mkdir(dirname(options.file), { recursive: true });
    const temporary = options.file + '.writing';
    await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
    await rename(temporary, options.file);
    state = next;
  }
  const ready = (async () => {
    let stored: string;
    try {
      stored = await readFile(options.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    const parsed = JSON.parse(stored) as State;
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.runs))
      throw new Error('Invalid scheduled-task store.');
    for (const task of parsed.tasks) validateSchedule(task.schedule);
    state = parsed;
    if (state.runs.some((run) => run.status === 'running' || run.notification === 'pending')) {
      await save({
        ...state,
        runs: state.runs.map((run) =>
          run.status === 'running'
            ? {
                ...run,
                status: 'failed',
                finishedAt: new Date(now()).toISOString(),
                error: 'Manager stopped before this run finished. Not retried.',
                ...(run.notifyTopic
                  ? {
                      notification: 'failed' as const,
                      notificationError: 'Manager stopped before notifying. Not retried.',
                    }
                  : {}),
              }
            : run.notification === 'pending'
              ? {
                  ...run,
                  notification: 'failed',
                  notificationError: 'Manager stopped during notification. Not retried.',
                }
              : run,
        ),
      });
    }
  })();
  function listing() {
    return structuredClone({ tasks: state.tasks, runs: state.runs });
  }
  async function start(id: string, automatic: boolean): Promise<TaskRun> {
    await ready;
    const run = await serial(async () => {
      if (closed) throw new TaskError('The manager is stopping.', 409);
      if (active)
        throw new TaskError(
          'A scheduled task is already running. Try again after it finishes.',
          409,
        );
      const task = state.tasks.find((item) => item.id === id);
      if (!task) throw new TaskError('That task no longer exists.', 404);
      const timestamp = new Date(now()).toISOString();
      const record: TaskRun = {
        id: randomUUID(),
        taskId: id,
        label: task.label,
        harness: task.harness,
        startedAt: timestamp,
        status: 'running',
        output: '',
        ...(task.notifyTopic ? { notifyTopic: task.notifyTopic } : {}),
      };
      // Persist the claim before launching; restart never duplicates an interrupted run.
      let updated = task;
      if (automatic) {
        const following =
          task.schedule.kind === 'daily' || task.schedule.kind === 'weekly'
            ? nextRun(task.schedule, now() + 20 * 3600000)
            : nextRun(task.schedule, now());
        updated = { ...task, nextRun: following, enabled: !!following };
      }
      await save({
        ...state,
        tasks: state.tasks.map((item) => (item.id === id ? updated : item)),
        runs: [record, ...state.runs].slice(0, 100),
      });
      active = { taskId: id, controller: new AbortController() };
      const controller = active.controller;
      const taskCopy = structuredClone(task);
      void (async () => {
        let result: Partial<TaskRun>;
        try {
          result = {
            status: 'succeeded',
            output: (await options.run(taskCopy, controller.signal)).slice(-24000),
          };
        } catch (error) {
          result = { status: 'failed', error: (error as Error).message.slice(-4000) };
        }
        try {
          const completed: TaskRun = {
            ...record,
            ...result,
            finishedAt: new Date(now()).toISOString(),
            ...(taskCopy.notifyTopic ? { notification: 'pending' } : {}),
          };
          await serial(() =>
            save({
              ...state,
              runs: state.runs.map((item) => (item.id === record.id ? completed : item)),
            }),
          );
          if (taskCopy.notifyTopic) {
            let notification: Partial<TaskRun>;
            try {
              if (!options.notify) throw new Error('ntfy is not configured on this manager.');
              await options.notify(taskCopy, completed, controller.signal);
              notification = { notification: 'sent' };
            } catch (error) {
              notification = {
                notification: 'failed',
                notificationError: (error as Error).message.slice(0, 1000),
              };
            }
            await serial(() =>
              save({
                ...state,
                runs: state.runs.map((item) =>
                  item.id === record.id ? { ...item, ...notification } : item,
                ),
              }),
            );
          }
        } catch (error) {
          console.error('Could not save scheduled-task result:', (error as Error).message);
        } finally {
          active = undefined;
        }
      })();
      return record;
    });
    return structuredClone(run);
  }
  async function tick() {
    await ready;
    if (closed || active) return;
    // Missed one-offs run once. Recurring runs older than a minute are skipped.
    await serial(async () => {
      const tasks = state.tasks.map((task) =>
        task.enabled &&
        task.nextRun &&
        task.schedule.kind !== 'once' &&
        Date.parse(task.nextRun) < now() - 60000
          ? { ...task, nextRun: nextRun(task.schedule, now()) }
          : task,
      );
      if (JSON.stringify(tasks) !== JSON.stringify(state.tasks)) await save({ ...state, tasks });
    });
    const task = state.tasks.find(
      (item) => item.enabled && item.nextRun && Date.parse(item.nextRun) <= now(),
    );
    if (task) await start(task.id, true);
  }
  return {
    ready,
    listing: async () => {
      await ready;
      return listing();
    },
    upsert: async (input: TaskInput, id?: string) => {
      await ready;
      const validated = await options.validate(input);
      const schedule = validateSchedule(validated.schedule);
      const following = nextRun(schedule, now());
      if (!following) throw new TaskError('Choose a future time.');
      return serial(async () => {
        const existing = id ? state.tasks.find((task) => task.id === id) : undefined;
        if (id && !existing) throw new TaskError('That task no longer exists.', 404);
        if (id && active?.taskId === id)
          throw new TaskError('Wait for this task to finish before editing it.', 409);
        if (!id && state.tasks.length >= 200)
          throw new TaskError('Remove a task before adding more (limit 200).');
        const task: ScheduledTask = {
          ...validated,
          schedule,
          id: id || randomUUID(),
          createdAt: existing?.createdAt || new Date(now()).toISOString(),
          enabled: existing?.enabled ?? true,
          nextRun: existing?.enabled === false ? null : following,
        };
        await save({
          ...state,
          tasks: existing
            ? state.tasks.map((item) => (item.id === id ? task : item))
            : [...state.tasks, task],
        });
        return structuredClone(task);
      });
    },
    change: async (id: string, operation: 'pause' | 'resume' | 'delete') => {
      await ready;
      return serial(async () => {
        const task = state.tasks.find((item) => item.id === id);
        if (!task) throw new TaskError('That task no longer exists.', 404);
        if (operation === 'delete' && active?.taskId === id)
          throw new TaskError('Wait for this task to finish before deleting it.', 409);
        const following = operation === 'resume' ? nextRun(task.schedule, now()) : null;
        if (operation === 'resume' && !following)
          throw new TaskError('Edit the expired one-time schedule before resuming it.');
        await save({
          ...state,
          tasks:
            operation === 'delete'
              ? state.tasks.filter((item) => item.id !== id)
              : state.tasks.map((item) =>
                  item.id === id
                    ? { ...item, enabled: operation === 'resume', nextRun: following }
                    : item,
                ),
        });
        return listing();
      });
    },
    run: (id: string) => start(id, false),
    tick,
    start: async () => {
      await ready;
      if (closed || timer) return;
      timer = setInterval(() => {
        void tick().catch((error) => console.error('Scheduled task:', error.message));
      }, 10000);
      timer.unref();
      await tick();
    },
    close: () => {
      closed = true;
      if (timer) clearInterval(timer);
      active?.controller.abort();
    },
  };
}
export type TaskScheduler = ReturnType<typeof createTaskScheduler>;
export type { TaskHarness };

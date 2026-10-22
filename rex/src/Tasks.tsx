import { useCallback, useEffect, useRef, useState } from 'react';
import { useInterval } from '@dak/hooks';
import { Button, Input } from '@dak/ui';
import FolderPicker from './FolderPicker';
import {
  describeSchedule,
  type ScheduledTask,
  type TaskInput,
  type TaskListing,
  type TaskRun,
  type TaskSchedule,
} from '../shared/tasks';

interface Props {
  request: <T>(route: string, body?: unknown) => Promise<T>;
  visible: boolean;
  onRuns: (runs: TaskRun[]) => void;
}
const selectClass = 'w-full rounded-lg border border-border bg-surface-sunken p-3 text-text';
function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export default function Tasks({ request, visible, onRuns }: Props) {
  const [listing, setListing] = useState<TaskListing>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const polling = useRef(false);
  const onRunsRef = useRef(onRuns);
  onRunsRef.current = onRuns;
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [notifyTopic, setNotifyTopic] = useState('');
  const [harness, setHarness] = useState('');
  const [cwd, setCwd] = useState('');
  const [kind, setKind] = useState<TaskSchedule['kind']>('interval');
  const [minutes, setMinutes] = useState('60');
  const [at, setAt] = useState(localDate(new Date(Date.now() + 3600000).toISOString()));
  const [time, setTime] = useState('09:00');
  const [timezone, setTimezone] = useState('');
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [showFolders, setShowFolders] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const refresh = useCallback(async () => {
    if (polling.current || busyRef.current || document.hidden) return;
    polling.current = true;
    try {
      const result = await request<TaskListing>('tasks');
      setListing(result);
      onRunsRef.current(result.runs);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load tasks.');
    } finally {
      polling.current = false;
    }
  }, [request]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useInterval(() => {
    void refresh();
  }, 5000);
  async function mutate(route: string, body: unknown) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await request(route, body);
      setListing(await request<TaskListing>('tasks'));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the task.');
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function edit(task?: ScheduledTask) {
    setEditing(task?.id || null);
    setLabel(task?.label || '');
    setPrompt(task?.prompt || '');
    setNotifyTopic(task?.notifyTopic || '');
    setHarness(task?.harness || listing?.harnesses[0]?.id || '');
    setCwd(task?.cwd || listing?.harnesses[0]?.cwd || '');
    const schedule = task?.schedule;
    setKind(schedule?.kind || 'interval');
    setMinutes(String(schedule?.kind === 'interval' ? schedule.minutes : 60));
    setAt(
      localDate(
        schedule?.kind === 'once' ? schedule.at : new Date(Date.now() + 3600000).toISOString(),
      ),
    );
    setTime(schedule?.kind === 'daily' || schedule?.kind === 'weekly' ? schedule.time : '09:00');
    setTimezone(
      schedule?.kind === 'daily' || schedule?.kind === 'weekly'
        ? schedule.timezone
        : listing?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    setDays(schedule?.kind === 'weekly' ? schedule.days : [1, 2, 3, 4, 5]);
    setShowFolders(false);
    setFormOpen(true);
    setError('');
  }
  async function save() {
    let schedule: TaskSchedule;
    if (kind === 'once') {
      const date = new Date(at);
      if (!Number.isFinite(date.getTime())) {
        setError('Choose a valid date.');
        return;
      }
      schedule = { kind, at: date.toISOString() };
    } else if (kind === 'interval') schedule = { kind, minutes: Number(minutes) };
    else if (kind === 'daily') schedule = { kind, time, timezone };
    else schedule = { kind, time, timezone, days };
    const existing = listing?.tasks.find((task) => task.id === editing);
    const task: TaskInput = {
      notifyTopic: notifyTopic.trim() || undefined,
      label,
      prompt,
      harness,
      cwd,
      schedule,
      ...(existing?.wrapperFlags ? { wrapperFlags: existing.wrapperFlags } : {}),
    };
    if (await mutate('tasks/save', { id: editing || undefined, task })) setFormOpen(false);
  }
  if (!visible) return null;
  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-surface-raised p-4"
      aria-label="Scheduled tasks"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Scheduled tasks</h2>
        <Button size="sm" disabled={busy || !listing?.harnesses.length} onClick={() => edit()}>
          Add task
        </Button>
      </div>
      <p className="text-sm text-text-secondary">
        Run a prompt on your Mac, save its result, and announce it when this app is open. One task
        runs at a time, for up to 15 minutes.
      </p>
      {listing && !listing.harnesses.length && (
        <p className="text-sm text-text-secondary">
          Configure task-harnesses.local.json on your Mac using the example in the rex folder, then
          restart the manager.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {formOpen && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy} className="space-y-3">
            <legend className="mb-3 font-medium">{editing ? 'Edit task' : 'New task'}</legend>
            <label className="block">
              <span className="mb-1 block text-sm">Task name</span>
              <Input
                required
                maxLength={100}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Prompt</span>
              <textarea
                required
                maxLength={8000}
                rows={3}
                className={selectClass}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Check this project’s open PRs and report what needs attention."
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Harness</span>
              <select
                className={selectClass}
                value={harness}
                aria-label="Harness"
                onChange={(event) => {
                  setHarness(event.target.value);
                  setCwd(
                    listing?.harnesses.find((item) => item.id === event.target.value)?.cwd || '',
                  );
                }}
              >
                {listing?.harnesses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {listing?.harnesses.find((item) => item.id === harness) && (
              <code className="block break-all text-xs text-text-secondary">
                {listing.harnesses.find((item) => item.id === harness)!.command.join(' ')}
              </code>
            )}
            <label className="block">
              <span className="mb-1 block text-sm">Project folder</span>
              <div className="flex gap-2">
                <Input
                  aria-label="Project folder"
                  required
                  value={cwd}
                  onChange={(event) => setCwd(event.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowFolders(!showFolders)}
                >
                  Browse
                </Button>
              </div>
            </label>
            {showFolders && (
              <FolderPicker
                request={request}
                onChoose={(directory) => {
                  setCwd(directory);
                  setShowFolders(false);
                }}
                onClose={() => setShowFolders(false)}
              />
            )}
            <label className="block">
              <span className="mb-1 block text-sm">Schedule</span>
              <select
                className={selectClass}
                value={kind}
                aria-label="Schedule"
                onChange={(event) => setKind(event.target.value as TaskSchedule['kind'])}
              >
                <option value="interval">Every interval</option>
                <option value="once">One time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly / weekdays</option>
              </select>
            </label>
            {kind === 'interval' && (
              <label className="block">
                <span className="mb-1 block text-sm">Interval in minutes</span>
                <Input
                  type="number"
                  required
                  min={1}
                  max={525600}
                  step={1}
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                />
              </label>
            )}
            {kind === 'once' && (
              <label className="block">
                <span className="mb-1 block text-sm">
                  Date and time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                </span>
                <Input
                  type="datetime-local"
                  required
                  value={at}
                  onChange={(event) => setAt(event.target.value)}
                />
              </label>
            )}
            {(kind === 'daily' || kind === 'weekly') && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm">Time</span>
                  <Input
                    type="time"
                    required
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm">Timezone</span>
                  <Input
                    required
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  />
                </label>
              </>
            )}
            {kind === 'weekly' && (
              <div className="flex flex-wrap gap-3" role="group" aria-label="Days of week">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <label key={day} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={days.includes(index)}
                      onChange={(event) =>
                        setDays(
                          event.target.checked
                            ? [...days, index]
                            : days.filter((value) => value !== index),
                        )
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            )}
            <label className="block">
              <span className="mb-1 block text-sm">ntfy topic (optional)</span>
              <Input
                maxLength={64}
                value={notifyTopic}
                aria-label="ntfy topic (optional)"
                onChange={(event) => setNotifyTopic(event.target.value)}
                placeholder="Your private topic"
              />
              <span className="mt-1 block text-xs text-text-muted">
                Subscribe to this topic in the Android ntfy app. Leave blank for no push.
              </span>
            </label>
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>
                Save task
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {listing?.tasks.length === 0 && (
        <p className="text-sm text-text-muted">
          No scheduled tasks yet. Add one here or ask the manager by voice.
        </p>
      )}
      {listing?.tasks.map((task) => (
        <article key={task.id} className="space-y-2 rounded-lg border border-border p-3">
          <h3 className="font-medium">
            {task.label}
            {!task.enabled ? ' · paused' : ''}
          </h3>
          <p className="whitespace-pre-wrap text-sm">{task.prompt}</p>
          <p className="break-all text-xs text-text-secondary">
            {task.harness} · {task.cwd}
          </p>
          <p className="text-sm text-text-secondary">{describeSchedule(task.schedule)}</p>
          {task.notifyTopic && (
            <p className="text-xs text-text-secondary">Push to ntfy: {task.notifyTopic}</p>
          )}
          <p className="text-xs text-text-muted">
            {task.nextRun ? 'Next: ' + new Date(task.nextRun).toLocaleString() : 'No upcoming run'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => edit(task)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || listing.runs.some((run) => run.status === 'running')}
              onClick={() => void mutate('tasks/run', { id: task.id })}
            >
              Run now
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void mutate('tasks/change', {
                  id: task.id,
                  operation: task.enabled ? 'pause' : 'resume',
                })
              }
            >
              {task.enabled ? 'Pause' : 'Resume'}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDeleteId(task.id)}>
              Delete
            </Button>
          </div>
          {deleteId === task.id && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Delete this saved task?</span>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  void mutate('tasks/change', { id: task.id, operation: 'delete' }).then(
                    (success) => {
                      if (success) setDeleteId('');
                    },
                  );
                }}
              >
                Delete task
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteId('')}>
                Keep it
              </Button>
            </div>
          )}
        </article>
      ))}
      {!!listing?.runs.length && (
        <div className="space-y-2">
          <h3 className="font-medium">Recent runs</h3>
          {listing.runs.map((run) => (
            <details key={run.id} className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm">
                {run.label} · {run.status} · {new Date(run.startedAt).toLocaleString()}
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {run.error || run.output || 'Running…'}
              </p>
              {run.notification && (
                <p className="mt-2 text-xs text-text-secondary">
                  ntfy: {run.notification}
                  {run.notificationError ? ' · ' + run.notificationError : ''}
                </p>
              )}
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

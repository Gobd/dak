import type { ScheduledTask, TaskRun } from '../shared/tasks.ts';
export type TaskNotifier = (
  task: ScheduledTask,
  run: TaskRun,
  signal: AbortSignal,
) => Promise<void>;
export function validateTopic(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value))
    throw new Error('ntfy topics must be 1–64 letters, numbers, hyphens, or underscores.');
  return value;
}
export function notificationMessage(run: TaskRun): string {
  const value = (run.error || run.output || 'The harness finished without a status message.')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim();
  if (Buffer.byteLength(value, 'utf8') <= 3500) return value;
  let clipped = '';
  let bytes = 0;
  for (const character of value) {
    const size = Buffer.byteLength(character, 'utf8');
    if (bytes + size > 3497) break;
    clipped += character;
    bytes += size;
  }
  return clipped + '…';
}
export function createNtfyNotifier(
  server = 'https://ntfy.sh',
  token?: string,
  request: typeof fetch = fetch,
): TaskNotifier {
  const url = new URL(server);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new Error(
      'REX_NTFY_URL must be an HTTP(S) server URL without credentials, query or fragment.',
    );
  return async (task, run, signal) => {
    if (!task.notifyTopic) return;
    validateTopic(task.notifyTopic);
    const response = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({
        topic: task.notifyTopic,
        title: task.label + (run.status === 'succeeded' ? ' finished' : ' failed'),
        message: notificationMessage(run),
        tags: [run.status === 'succeeded' ? 'white_check_mark' : 'warning'],
        priority: run.status === 'succeeded' ? 3 : 4,
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error('ntfy publish failed (HTTP ' + response.status + ').');
  };
}

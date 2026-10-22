import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer as createHttpsServer, type ServerOptions } from 'node:https';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  createConversationManager,
  type Action,
  type Context,
  type Agent,
} from './conversation.ts';
import { validateTopic, type TaskNotifier } from './ntfy.ts';
import { createTaskScheduler, executeTask, TaskError } from './tasks.ts';
import type { TaskInput, TaskHarness } from '../shared/tasks.ts';
import { createVoiceGate } from './voice.ts';
import { cmuxProgramStatus } from './program-status.ts';
import { TerminalInputError } from './terminals.ts';
import { streamHistory, terminalHistory } from './history.ts';
import { combinedBackend } from './combined.ts';
import type { ProviderScope } from '../shared/terminal.ts';
import { cli, rexBackend, cmuxBackend, launchCommand, type Cli } from './terminals.ts';

interface Preset {
  id: string;
  label: string;
  cwd: string;
  command: string[];
}
interface ManagerOptions {
  voiceIdleSeconds?: number;
  presets?: Preset[];
  rexBin?: string;
  cmuxBin?: string;
  zoxideBin?: string;
  zoxide?: Cli;
  managerCommand?: string[];
  taskHarnesses?: TaskHarness[];
  tasksFile?: string;
  taskRunner?: typeof executeTask;
  taskNotifier?: TaskNotifier;
  managerCwd?: string;
  projectRoot?: string;
  distDir?: string;
  sharedDir?: string;
  tls?: ServerOptions;
  allowedOrigins?: string[];
  rex?: Cli;
  cmux?: Cli;
  agent?: Agent;
}

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = '/rex/api/';
const maxBody = 65536;
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function validatePresets(value: unknown): Preset[] {
  if (!Array.isArray(value)) throw new Error('Launch presets must be an array.');
  const ids = new Set();
  return value.map((preset) => {
    if (
      !preset ||
      typeof preset.id !== 'string' ||
      !/^[a-z0-9-]{1,64}$/.test(preset.id) ||
      ids.has(preset.id) ||
      typeof preset.label !== 'string' ||
      !preset.label.trim() ||
      typeof preset.cwd !== 'string' ||
      !isAbsolute(preset.cwd) ||
      !Array.isArray(preset.command) ||
      !preset.command.length ||
      preset.command.some((arg: unknown) => typeof arg !== 'string' || arg.includes('\0')) ||
      !preset.command[0]
    ) {
      throw new Error(
        'Each preset needs a unique id, label, absolute cwd, and ordered command array.',
      );
    }
    ids.add(preset.id);
    return { id: preset.id, label: preset.label, cwd: preset.cwd, command: preset.command };
  });
}

async function body(request: IncomingMessage): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBody) throw new HttpError(413, 'Message is too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}

function text(value: unknown, name: string, max = 8000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) {
    throw new HttpError(400, `Invalid ${name}.`);
  }
  return value.trim();
}

function identifier(value: unknown, name: string) {
  const id = text(value, name, 128);
  if (!new RegExp(`^${name}:[a-zA-Z0-9-]+$`).test(id))
    throw new HttpError(400, `Invalid ${name} ID.`);
  return id;
}

function reply(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

export function createManager(options: ManagerOptions) {
  const voiceGate = createVoiceGate(options.voiceIdleSeconds);
  function voiceCall(value: unknown) {
    const id = text(value, 'voice call', 64);
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new HttpError(400, 'Invalid voice call.');
    return provider() + ':' + id;
  }
  const {
    presets = [],
    rexBin = 'rex',
    cmuxBin = 'cmux',
    zoxideBin = 'zoxide',
    zoxide: injectedZoxide,
    cmux: injectedCmux,
    managerCommand,
    taskHarnesses = [],
    tasksFile,
    taskRunner = executeTask,
    taskNotifier,
    managerCwd = root,
    projectRoot = resolve(root, '../..'),
    distDir = resolve(root, 'dist'),
    sharedDir = resolve(root, '../packages/vite-shared-react/dist'),
    tls,
    allowedOrigins = [],
    rex: injectedRex,
    agent: injectedAgent,
  } = options;
  validatePresets(presets);
  validatePresets(taskHarnesses);
  const cmuxStatus = injectedCmux ? undefined : cmuxProgramStatus(cmuxBin);
  const singleBackends = {
    rex: rexBackend(injectedRex || cli(rexBin, ['--autostart=false'])),
    cmux: cmuxBackend(injectedCmux || cli(cmuxBin), cmuxStatus?.read),
  };
  const backends = { ...singleBackends, all: combinedBackend(singleBackends) };
  const zoxide = injectedZoxide || cli(zoxideBin);
  const providerContext = new AsyncLocalStorage<ProviderScope>();
  const provider = () => providerContext.getStore() || 'rex';
  const backend = () => backends[provider()];
  const runAgent: Agent =
    injectedAgent ||
    (async (prompt, signal) => {
      if (!Array.isArray(managerCommand) || !managerCommand.length) {
        throw new HttpError(
          503,
          'Set REX_MANAGER_COMMAND_JSON to enable manager chat. Sessions and terminal controls are available.',
        );
      }
      // Append one prompt argument after the configured argv; never invoke a shell.
      const pending = execute(managerCommand[0], [...managerCommand.slice(1), prompt], {
        cwd: managerCwd,
        timeout: 150000,
        maxBuffer: 1024 * 1024,
        signal,
        env: process.env,
      });
      // Print-mode harnesses wait for EOF on non-TTY stdin.
      pending.child.stdin?.end();
      const { stdout } = await pending;
      if (!stdout.trim()) throw new HttpError(502, 'The manager agent returned no text.');
      return stdout.trim();
    });
  let chatting = false;
  let launching = false;
  const sending = new Set();

  async function projectDirectory(input: unknown) {
    const base = await realpath(projectRoot);
    if (typeof input !== 'string' || !isAbsolute(input))
      throw new HttpError(400, 'Choose an absolute project directory.');
    const directory = await realpath(input).catch(() => {
      throw new HttpError(400, 'That directory does not exist.');
    });
    if (directory !== base && !directory.startsWith(base + sep))
      throw new HttpError(400, 'Choose a folder within the configured projects directory.');
    if (!(await stat(directory)).isDirectory()) throw new HttpError(400, 'Choose a directory.');
    return { base, directory };
  }

  async function listDirectories(url: URL) {
    const { base, directory } = await projectDirectory(url.searchParams.get('path') || projectRoot);
    const projectsOnly = url.searchParams.get('projects') === 'true';
    const search = (url.searchParams.get('search') || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_.-]+/g, '');
    if (search.length > 100) throw new HttpError(400, 'Folder search is too long.');
    const ignored = new Set([
      'node_modules',
      'dist',
      'build',
      'target',
      'vendor',
      '__pycache__',
      '_site',
    ]);
    const directories: { name: string; path: string }[] = [];
    const queue = [{ path: directory, depth: 0 }];
    let visited = 0;
    while (queue.length && visited < 2000 && directories.length < 100) {
      const current = queue.shift()!;
      visited++;
      const entries = await readdir(current.path, { withFileTypes: true }).catch(() => []);
      if (
        projectsOnly &&
        current.path !== directory &&
        (entries.some((entry) => entry.name === '.git') ||
          ['HEAD', 'objects', 'refs'].every((name) => entries.some((entry) => entry.name === name)))
      )
        continue;
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || ignored.has(entry.name)) continue;
        const fullPath = resolve(current.path, entry.name);
        if (
          !search ||
          entry.name
            .toLowerCase()
            .replace(/[\s_.-]+/g, '')
            .includes(search)
        )
          directories.push({ name: entry.name, path: fullPath });
        if (search && current.depth < 4) queue.push({ path: fullPath, depth: current.depth + 1 });
        if (directories.length >= 100) break;
      }
      if (!search) break;
    }
    directories.sort((a, b) => a.path.localeCompare(b.path));
    return {
      root: base,
      current: directory,
      parent: directory === base ? null : dirname(directory),
      directories,
      truncated: !!queue.length || directories.length >= 100,
    };
  }

  async function getBlocks(session: string) {
    return backend().blocks(session);
  }

  async function checkTerminal(session: string, block: string) {
    const blocks = await getBlocks(session);
    const target = blocks.find((candidate) => candidate.block_id === block);
    if (!target || target.creator_name !== 'com.superlogical.terminal') {
      throw new HttpError(404, 'That terminal is no longer available. Refresh the sessions.');
    }
    return target;
  }

  const scheduler = tasksFile
    ? createTaskScheduler({
        file: tasksFile,
        notify: taskNotifier,
        validate: async (input: TaskInput) => {
          if (!input || typeof input !== 'object') throw new TaskError('Provide the task details.');
          const harness = taskHarnesses.find((item) => item.id === input.harness);
          if (!harness) throw new TaskError('Choose a configured task harness.');
          const { directory } = await projectDirectory(input.cwd || harness.cwd);
          let notifyTopic: string | undefined;
          try {
            notifyTopic = validateTopic(input.notifyTopic);
          } catch (error) {
            throw new TaskError((error as Error).message);
          }
          let wrapperFlags: string[] | undefined;
          try {
            launchCommand(harness.command, input.wrapperFlags);
            wrapperFlags = input.wrapperFlags;
          } catch (error) {
            throw new TaskError((error as Error).message);
          }
          return {
            label: text(input.label, 'task name', 100),
            prompt: text(input.prompt, 'task prompt'),
            harness: harness.id,
            cwd: directory,
            schedule: input.schedule,
            ...(notifyTopic ? { notifyTopic } : {}),
            ...(wrapperFlags === undefined ? {} : { wrapperFlags }),
          };
        },
        run: async (task, signal) => {
          const harness = taskHarnesses.find((item) => item.id === task.harness);
          if (!harness) throw new TaskError('This task’s harness is no longer configured.');
          const { directory } = await projectDirectory(task.cwd);
          return taskRunner(
            launchCommand(harness.command, task.wrapperFlags),
            directory,
            task.prompt,
            signal,
          );
        },
      })
    : undefined;
  function tasks() {
    if (!scheduler) throw new TaskError('Scheduled tasks are not configured on this manager.', 503);
    return scheduler;
  }
  async function taskAction(action: Action) {
    if (action.type === 'list_tasks') {
      const listing = await tasks().listing();
      return {
        tasks: listing.tasks,
        runs: listing.runs.slice(0, 10).map((run) => ({ ...run, output: run.output.slice(-2000) })),
      };
    }
    if (action.type === 'schedule_task' || action.type === 'update_task') {
      if (action.type === 'update_task' && !action.taskId)
        throw new TaskError('Choose a task to edit.');
      const task = await tasks().upsert(
        action.task!,
        action.type === 'update_task' ? action.taskId : undefined,
      );
      return {
        text:
          'Saved ' +
          task.label +
          '. ' +
          (task.nextRun
            ? 'Next run: ' +
              new Date(task.nextRun).toLocaleString('en-US', {
                timeZone:
                  task.schedule.kind === 'daily' || task.schedule.kind === 'weekly'
                    ? task.schedule.timezone
                    : undefined,
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              }) +
              '.'
            : 'It is paused.'),
      };
    }
    const id = text(action.taskId, 'task ID', 64);
    if (action.type === 'run_task') {
      const run = await tasks().run(id);
      return {
        text: 'Started ' + run.label + '. I will have its result when the harness finishes.',
      };
    }
    const operation = (
      { pause_task: 'pause', resume_task: 'resume', delete_task: 'delete' } as const
    )[action.type as 'pause_task' | 'resume_task' | 'delete_task'];
    if (!operation) throw new TaskError('Unknown task operation.');
    await tasks().change(id, operation);
    return {
      text:
        ({ pause: 'Paused', resume: 'Resumed', delete: 'Deleted' } as const)[operation] +
        ' the task.',
    };
  }
  const operations = {
    runAgent,
    taskAction,
    searchFolders: async (query: string) => {
      const search = text(query, 'folder search', 100);
      const base = await realpath(projectRoot);
      const normalized = search.toLowerCase().replace(/[\s_.-]+/g, '');
      const preferExact = (directories: { name: string; path: string }[]) => {
        const exact = directories.filter(
          (item) => item.name.toLowerCase().replace(/[\s_.-]+/g, '') === normalized,
        );
        return { directories: exact.length ? exact : directories, exactMatch: !!exact.length };
      };
      // zi uses zoxide interactively. Query the same ranked database without a terminal picker.
      try {
        const output: string = await zoxide([
          'query',
          '--list',
          '--base-dir',
          base,
          '--',
          ...search.split(/\s+/),
        ]);
        const directories: { name: string; path: string }[] = [];
        const seen = new Set<string>();
        for (const candidate of output.trim().split('\n').filter(Boolean).slice(0, 100)) {
          try {
            const { directory } = await projectDirectory(candidate);
            if (!seen.has(directory)) {
              seen.add(directory);
              directories.push({ name: basename(directory), path: directory });
            }
          } catch {
            /* Ignore stale entries and paths outside the configured root. */
          }
        }
        if (directories.length)
          return { root: base, source: 'zoxide', truncated: false, ...preferExact(directories) };
      } catch {
        /* zoxide is optional; unvisited projects are found by repository scanning. */
      }
      const url = new URL('http://localhost');
      url.searchParams.set('search', search);
      url.searchParams.set('projects', 'true');
      const listing = await listDirectories(url);
      return { ...listing, source: 'repositories', ...preferExact(listing.directories) };
    },
    readScreen: async (session: string, block: string) => {
      identifier(session, 'session');
      identifier(block, 'block');
      await checkTerminal(session, block);
      return (await backend().capture(session, block)).slice(-6000);
    },
    inspectSession: async (session: string) => {
      identifier(session, 'session');
      const sessions = await backend().sessions();
      const target = sessions.find((item) => item.session_id === session);
      if (!target) throw new HttpError(404, 'That session is no longer available.');
      const blocks = await getBlocks(session);
      const terminals: Context['snapshot'][number]['terminals'] = [];
      for (const block of blocks
        .filter((item) => item.creator_name === 'com.superlogical.terminal')
        .slice(0, 6)) {
        terminals.push({
          block_id: block.block_id,
          label: block.label,
          screen: (await backend().capture(session, block.block_id)).slice(-6000),
        });
      }
      return { ...target, terminals };
    },
    launch: async (action: Action) => {
      const preset = presets.find((item) => item.id === action.preset);
      if (!preset) throw new HttpError(400, 'That launch preset is not configured.');
      if (launching) throw new HttpError(409, 'A session is already starting.');
      launching = true;
      try {
        const { directory: cwd } = await projectDirectory(action.cwd || preset.cwd);
        const session = action.session ? identifier(action.session, 'session') : undefined;
        if (session && !(await backend().sessions()).some((item) => item.session_id === session))
          throw new HttpError(404, 'That workspace or session is no longer available.');
        let command: string[];
        try {
          command = launchCommand(preset.command, action.wrapperFlags);
        } catch (error) {
          throw new HttpError(400, (error as Error).message);
        }
        const label = text(action.label || preset.id, 'session label', 64);
        if (!/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(label))
          throw new HttpError(400, 'Use letters, numbers, spaces or hyphens for the session name.');
        const created = await backend().launch({
          label,
          cwd,
          command,
          session,
          provider: action.provider,
        });
        return { ...created, label, cwd };
      } finally {
        launching = false;
      }
    },
    send: async (action: Action) => {
      const session = identifier(action.session, 'session');
      const block = identifier(action.block, 'block');
      const message = text(action.message, 'message');
      if (
        Array.from(message).some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        )
      )
        throw new HttpError(400, 'Send a single-line agent message.');
      if (sending.has(provider() + ':' + block))
        throw new HttpError(409, 'Input is already being sent to that terminal.');
      sending.add(provider() + ':' + block);
      try {
        await checkTerminal(session, block);
        await backend().send(session, block, message);
        await backend().key(session, block, 'enter');
      } finally {
        sending.delete(provider() + ':' + block);
      }
    },
    keys: async (action: Action) => {
      const session = identifier(action.session, 'session');
      const block = identifier(action.block, 'block');
      if (
        action.keys!.some(
          (key) =>
            !['enter', 'up', 'down', 'left', 'right', 'escape', 'tab', 'ctrl+c'].includes(key),
        )
      )
        throw new HttpError(400, 'Unsupported terminal key.');
      if (sending.has(provider() + ':' + block))
        throw new HttpError(409, 'Input is already being sent to that terminal.');
      sending.add(provider() + ':' + block);
      try {
        await checkTerminal(session, block);
        for (const key of action.keys!)
          await backend().key(session, block, key, { answerPrompt: true });
      } finally {
        sending.delete(provider() + ':' + block);
      }
    },
  };
  const conversations = {
    rex: createConversationManager(operations),
    cmux: createConversationManager(operations),
    all: createConversationManager(operations),
  };

  async function api(request: IncomingMessage, response: ServerResponse, route: string) {
    const origin = request.headers.origin;
    if (origin) {
      const sameHost = new URL(origin).host === request.headers.host;
      if (!sameHost && !allowedOrigins.includes(origin))
        throw new HttpError(403, 'This app origin is not configured on the manager.');
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Cache-Control': 'no-store' });
      return response.end();
    }
    const url = new URL(request.url!, 'http://localhost');
    if (request.method === 'GET' && route === 'voice/state')
      return reply(response, 200, voiceGate.state(voiceCall(url.searchParams.get('call'))));
    if (request.method === 'GET' && route === 'status') {
      const status = await backend().status();
      return reply(response, 200, {
        connected: status.connected ?? true,
        connections: status.connections,
        version: status.version,
        provider: provider(),
        projectsRoot: await realpath(projectRoot),
        managerEnabled: !!managerCommand || !!injectedAgent,
      });
    }
    if (request.method === 'GET' && route === 'tasks') {
      return reply(response, 200, {
        ...(await tasks().listing()),
        harnesses: taskHarnesses,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
    if (request.method === 'GET' && route === 'sessions') {
      return reply(response, 200, { sessions: await backend().sessions() });
    }
    if (request.method === 'GET' && route === 'terminals') {
      const sessions = await backend().sessions();
      return reply(response, 200, {
        sessions: await Promise.all(
          sessions.map(async (session) => ({
            ...session,
            terminals: await Promise.all(
              (await getBlocks(session.session_id))
                .filter((block) => block.creator_name === 'com.superlogical.terminal')
                .map(async (block) => ({
                  ...block,
                  ...(await backend()
                    .describe(session.session_id, block.block_id)
                    .catch(() => ({ agent: null }))),
                })),
            ),
          })),
        ),
      });
    }
    if (request.method === 'GET' && (route === 'history' || route === 'history/events')) {
      const session = identifier(url.searchParams.get('session'), 'session');
      const block = identifier(url.searchParams.get('block'), 'block');
      await checkTerminal(session, block);
      if (route === 'history/events') return streamHistory(response, backend(), session, block);
      return reply(response, 200, await terminalHistory(backend(), session, block));
    }
    if (request.method === 'GET' && route === 'presets') return reply(response, 200, { presets });
    if (request.method === 'GET' && route === 'directories')
      return reply(response, 200, await listDirectories(url));
    if (request.method === 'GET' && route === 'blocks') {
      const session = identifier(url.searchParams.get('session'), 'session');
      return reply(response, 200, { blocks: await getBlocks(session) });
    }
    if (request.method === 'GET' && route === 'activity') {
      const selectedSession = url.searchParams.get('session');
      const selectedBlock = url.searchParams.get('block');
      if (selectedBlock && !selectedSession)
        throw new HttpError(400, 'Choose a session for that terminal.');
      if (selectedSession) identifier(selectedSession, 'session');
      if (selectedBlock) identifier(selectedBlock, 'block');
      const sessions = (await backend().sessions())
        .filter((item) => !selectedSession || item.session_id === selectedSession)
        .slice(0, 12);
      const terminals = [];
      for (const session of sessions) {
        for (const block of (await getBlocks(session.session_id))
          .filter(
            (item) =>
              item.creator_name === 'com.superlogical.terminal' &&
              (!selectedBlock || item.block_id === selectedBlock),
          )
          .slice(0, 8)) {
          const details = await backend()
            .describe(session.session_id, block.block_id)
            .catch(() => undefined);
          let records =
            details?.agent === false
              ? []
              : await backend().activity(session.session_id, block.block_id);
          if (records.some((record) => record.state === 'blocked')) {
            const screen = await backend()
              .capture(session.session_id, block.block_id)
              .catch(() => undefined);
            if (screen) {
              const promptId = createHash('sha256').update(screen.slice(-6000)).digest('hex');
              records = records.map((record) =>
                record.state === 'blocked' ? { ...record, id: promptId } : record,
              );
            }
          }
          terminals.push({
            session: session.session_id,
            block: block.block_id,
            label: session.label + ' / ' + block.label,
            records,
          });
        }
      }
      return reply(response, 200, { terminals });
    }
    if (request.method === 'GET' && route === 'capture') {
      const session = identifier(url.searchParams.get('session'), 'session');
      const block = identifier(url.searchParams.get('block'), 'block');
      await checkTerminal(session, block);
      const screen = await backend().capture(session, block);
      return reply(response, 200, { screen });
    }
    if (request.method !== 'POST') throw new HttpError(404, 'Unknown endpoint.');
    const input = await body(request);
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new HttpError(400, 'Expected an object.');
    if (route === 'voice/transcript')
      return reply(
        response,
        200,
        voiceGate.consume(voiceCall(input.call), text(input.transcript, 'transcript')),
      );
    if (route === 'voice/end') return reply(response, 200, voiceGate.end(voiceCall(input.call)));
    if (route === 'voice/playback') {
      if (typeof input.speaking !== 'boolean') throw new HttpError(400, 'Invalid playback state.');
      return reply(response, 200, voiceGate.playback(voiceCall(input.call), input.speaking));
    }
    if (route === 'tasks/save')
      return reply(response, 200, await tasks().upsert(input.task, input.id));
    if (route === 'tasks/change') {
      if (!['pause', 'resume', 'delete'].includes(input.operation))
        throw new TaskError('Unknown task operation.');
      return reply(
        response,
        200,
        await tasks().change(text(input.id, 'task ID', 64), input.operation),
      );
    }
    if (route === 'tasks/run')
      return reply(response, 202, await tasks().run(text(input.id, 'task ID', 64)));
    if (route === 'launch') {
      return reply(response, 200, await operations.launch({ ...input, type: 'launch' }));
    }
    if (route === 'key') {
      const session = identifier(input.session, 'session');
      const block = identifier(input.block, 'block');
      if (!['enter', 'up', 'down', 'left', 'right', 'escape', 'tab', 'ctrl+c'].includes(input.key))
        throw new HttpError(400, 'Unsupported terminal key.');
      if (sending.has(provider() + ':' + block))
        throw new HttpError(409, 'Input is already being sent to this terminal.');
      sending.add(provider() + ':' + block);
      try {
        await checkTerminal(session, block);
        await backend().key(session, block, input.key, { answerPrompt: true });
        return reply(response, 200, { sent: true });
      } finally {
        sending.delete(provider() + ':' + block);
      }
    }
    if (route === 'send') {
      const session = identifier(input.session, 'session');
      const block = identifier(input.block, 'block');
      const message = text(input.message, 'message');
      // Single-line input avoids paste handling submitting commands before Return.
      if (
        Array.from(message).some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        )
      )
        throw new HttpError(400, 'Send a single-line message to a terminal.');
      if (sending.has(provider() + ':' + block))
        throw new HttpError(409, 'A message is already being sent to this terminal.');
      sending.add(provider() + ':' + block);
      try {
        await checkTerminal(session, block);
        await backend().send(session, block, message);
        await backend().key(session, block, 'enter');
        return reply(response, 200, { sent: true });
      } finally {
        sending.delete(provider() + ':' + block);
      }
    }
    if (route === 'chat') {
      const message = text(input.message, 'message');
      if (
        !Array.isArray(input.history) ||
        input.history.length > 30 ||
        input.history.some(
          (item: { role: string; text: string }) =>
            !item ||
            !['user', 'assistant'].includes(item.role) ||
            typeof item.text !== 'string' ||
            item.text.length > 8000,
        )
      ) {
        throw new HttpError(400, 'Invalid conversation history.');
      }
      if (chatting) throw new HttpError(409, 'The manager is answering another request.');
      const releaseVoice =
        input.voiceCall === undefined ? undefined : voiceGate.hold(voiceCall(input.voiceCall));
      if (input.voiceCall !== undefined && !releaseVoice)
        throw new HttpError(409, 'Say Hey Rex to start a conversation.');
      chatting = true;
      const controller = new AbortController();
      const onClose = () => {
        if (!response.writableEnded) controller.abort();
      };
      response.on('close', onClose);
      try {
        const sessions = await backend().sessions();
        const snapshot: Context['snapshot'] = [];
        const chosen = input.session ? identifier(input.session, 'session') : null;
        const chosenBlock = input.block ? identifier(input.block, 'block') : null;
        if (input.terminalOnly === true) {
          if (!chosen || !chosenBlock) throw new HttpError(400, 'Choose a terminal to answer.');
          await checkTerminal(chosen, chosenBlock);
        }
        if (chosen && !sessions.some((session) => session.session_id === chosen))
          throw new HttpError(404, 'The selected session is no longer available.');
        for (const session of chosen
          ? sessions.filter((item) => item.session_id === chosen)
          : sessions.slice(0, 6)) {
          const blocks = await getBlocks(session.session_id);
          const terminals: Context['snapshot'][number]['terminals'] = [];
          for (const block of blocks
            .filter(
              (item) =>
                item.creator_name === 'com.superlogical.terminal' &&
                (input.terminalOnly !== true || item.block_id === chosenBlock),
            )
            .slice(0, 3)) {
            try {
              const screen = await backend().capture(session.session_id, block.block_id);
              terminals.push({
                label: block.label,
                block_id: block.block_id,
                screen: screen.slice(-6000),
              });
            } catch {
              terminals.push({
                label: block.label,
                block_id: block.block_id,
                screen: 'Terminal unavailable.',
              });
            }
          }
          snapshot.push({ ...session, terminals });
        }
        if (
          input.conversation !== undefined &&
          (typeof input.conversation !== 'string' ||
            !/^[a-zA-Z0-9-]{1,64}$/.test(input.conversation))
        )
          throw new HttpError(400, 'Invalid conversation ID.');
        const result = await conversations[provider()](
          {
            provider: provider(),
            observation: input.observation === true,
            terminalOnly: input.terminalOnly === true,
            message,
            history: input.history,
            conversation: input.conversation,
            sessions,
            snapshot,
            presets,
            taskHarnesses,
            scheduledTasks: scheduler ? (await scheduler.listing()).tasks : [],
            currentTime: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            projectsRoot: projectRoot,
            session: chosen,
            block: chosenBlock,
          },
          controller.signal,
        );
        return reply(response, 200, result);
      } finally {
        releaseVoice?.();
        response.off('close', onClose);
        chatting = false;
      }
    }
    throw new HttpError(404, 'Unknown endpoint.');
  }

  async function staticFile(request: IncomingMessage, response: ServerResponse, path: string) {
    if (!['GET', 'HEAD'].includes(request.method || ''))
      throw new HttpError(405, 'Method not allowed.');
    if (path === '/' || path === '/rex') {
      response.writeHead(302, { Location: '/rex/' });
      return response.end();
    }
    const shared = path.startsWith('/_shared/');
    if (!shared && !path.startsWith('/rex/')) throw new HttpError(404, 'Not found.');
    const directory = await realpath(shared ? sharedDir : distDir).catch(() => {
      throw new HttpError(503, 'Build the app first with pnpm --filter rex build.');
    });
    const relative = path.slice(shared ? '/_shared/'.length : '/rex/'.length) || 'index.html';
    const candidate = resolve(directory, relative);
    const file = await realpath(candidate).catch(() => {
      throw new HttpError(404, 'Not found.');
    });
    if (!file.startsWith(`${directory}${sep}`)) throw new HttpError(404, 'Not found.');
    const content = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  }

  const handler = async (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; worker-src 'self'; frame-ancestors 'none'",
    );
    try {
      const url = new URL(request.url!, 'http://localhost');
      const path = decodeURIComponent(url.pathname);
      if (path.startsWith(apiRoot)) {
        const selected = url.searchParams.get('provider') || 'rex';
        if (selected !== 'rex' && selected !== 'cmux' && selected !== 'all')
          throw new HttpError(400, 'Choose Rex or cmux.');
        await providerContext.run(selected, () =>
          api(request, response, path.slice(apiRoot.length)),
        );
      } else await staticFile(request, response, path);
    } catch (error) {
      if (response.destroyed || response.writableEnded) return;
      const status =
        error instanceof HttpError ||
        error instanceof TerminalInputError ||
        error instanceof TaskError
          ? error.status
          : 502;
      const message =
        error instanceof HttpError ||
        error instanceof TerminalInputError ||
        error instanceof TaskError
          ? error.message
          : 'Could not reach the selected terminal app or manager agent. Check the Mac’s manager logs.';
      if (!(error instanceof HttpError)) console.error((error as Error).message);
      reply(response, status, { error: message });
    }
  };
  const server = tls ? createHttpsServer(tls, handler) : createServer(handler);
  server.on('listening', () => {
    void scheduler
      ?.start()
      .catch((error) => console.error('Task scheduler could not start:', error.message));
  });
  server.on('close', () => {
    cmuxStatus?.close();
    scheduler?.close();
  });
  return server;
}

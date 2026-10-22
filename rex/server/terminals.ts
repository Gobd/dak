import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename } from 'node:path';

const execute = promisify(execFile);
export type { Provider, Session, Block, StatusRecord } from '../shared/terminal.ts';
import type { Session, Block, StatusRecord } from '../shared/terminal.ts';
// JSON CLI output is decoded at the adapter boundary.
export type Cli = (args: string[], json?: boolean) => Promise<any>;
export interface Launch {
  label: string;
  cwd: string;
  command: string[];
  session?: string;
}
export interface Created {
  session_id: string;
  block_id?: string;
  label?: string;
  cwd?: string;
}
export interface TerminalBackend {
  status(): Promise<{ version?: string }>;
  sessions(): Promise<Session[]>;
  blocks(session: string): Promise<Block[]>;
  capture(session: string, block: string): Promise<string>;
  activity(session: string, block: string): Promise<StatusRecord[]>;
  launch(options: Launch): Promise<Created>;
  send(session: string, block: string, message: string): Promise<void>;
  key(
    session: string,
    block: string,
    key: string,
    options?: { answerPrompt?: boolean },
  ): Promise<void>;
}
export class TerminalInputError extends Error {
  status = 409;
}
async function cmuxInput(run: Cli, args: string[]): Promise<void> {
  try {
    await run(args);
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr || '';
    if (/question or dialog|draft|nothing was sent/.test(stderr)) {
      throw new TerminalInputError(
        'That terminal has an open question, dialog, or draft. Ask the manager to read its options, then answer yes/no or a number. Your message was not sent.',
      );
    }
    throw error;
  }
}
export function cli(binary: string, prefix: string[] = []): Cli {
  return async (args, json = false) => {
    const { stdout } = await execute(binary, [...prefix, ...args], {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
      env: process.env,
    });
    return json ? JSON.parse(stdout) : stdout;
  };
}
export function launchCommand(command: string[], wrapperFlags?: unknown): string[] {
  if (wrapperFlags === undefined) return [...command];
  if (
    !Array.isArray(wrapperFlags) ||
    wrapperFlags.length > 2 ||
    wrapperFlags.some((flag) => !['--greywall', '--no-mcp'].includes(flag)) ||
    new Set(wrapperFlags).size !== wrapperFlags.length
  ) {
    throw new Error('Choose only Greywall and no-MCP wrapper options.');
  }
  if (basename(command[0]) !== 'lambdap') {
    throw new Error('Wrapper options require a lambdap launch preset.');
  }
  // Change only wrapper flags, never harness arguments after its name.
  const harness = command.findIndex(
    (arg, index) => index > 0 && ['pi', 'claude', 'codex'].includes(basename(arg)),
  );
  if (harness < 0) throw new Error('The lambdap preset needs a harness name.');
  return [
    command[0],
    ...command.slice(1, harness).filter((arg) => !['--greywall', '--no-mcp'].includes(arg)),
    ...wrapperFlags,
    ...command.slice(harness),
  ];
}
export function rexBackend(run: Cli): TerminalBackend {
  return {
    status: async () => ({
      version: (await run(['server', 'status', '--json'], true)).rex_version,
    }),
    sessions: async () => (await run(['ls', '--json'], true)).sessions || [],
    blocks: async (session) =>
      (await run(['block', 'ls', '-s', session, '--json'], true)).blocks || [],
    capture: (session, block) => run(['capture', '-s', session, '-b', block, '--trim', '--unwrap']),
    activity: async (session, block) =>
      (await run(['block', 'call', '-s', session, '-b', block, 'program_status'], true)).records ||
      [],
    launch: async ({ label, cwd, command, session }) => {
      const created = await run(
        session
          ? [
              'run',
              '-s',
              session,
              '--label',
              label,
              '-c',
              cwd,
              '--keep-open',
              '--focus=false',
              '--json',
              '--',
              ...command,
            ]
          : ['new', label, '-c', cwd, '--keep-open', '--json', '--', ...command],
        true,
      );
      return {
        ...created,
        session_id: session || created.session_id,
        block_id: created.block_ids?.[0] || created.initial_windows?.[0]?.block_ids?.[0],
      };
    },
    send: async (session, block, message) => {
      await run(['send', '-s', session, '-b', block, message]);
    },
    key: async (session, block, key) => {
      await run(['send-key', '-s', session, '-b', block, key]);
    },
  };
}
export function shellQuote(value: string): string {
  return "'" + value.replaceAll("'", "'\"'\"'") + "'";
}
function uuid(value: string, kind: 'session' | 'block'): string {
  const id = value.slice(kind.length + 1);
  if (!value.startsWith(kind + ':') || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
    throw new Error('Invalid cmux ' + kind + ' ID.');
  return id;
}
export function cmuxBackend(
  run: Cli,
  readStatus?: (workspace: string, surface: string) => Promise<StatusRecord[] | undefined>,
): TerminalBackend {
  const json = (args: string[]) => run(['--json', '--id-format', 'uuids', ...args], true);
  const target = (session: string, block: string) => [
    '--workspace',
    uuid(session, 'session'),
    '--surface',
    uuid(block, 'block'),
  ];
  return {
    status: async () => {
      await json(['tree', '--all']);
      return { version: (await run(['version'])).trim() };
    },
    sessions: async () => {
      const tree = await json(['tree', '--all']);
      return (tree.windows || []).flatMap((window: any) =>
        (window.workspaces || []).map((workspace: any) => ({
          session_id: 'session:' + workspace.id,
          label: workspace.title || workspace.id,
        })),
      );
    },
    blocks: async (session) => {
      const data = await json(['list-panels', '--workspace', uuid(session, 'session')]);
      return (data.surfaces || [])
        .filter((surface: any) => surface.type === 'terminal')
        .map((surface: any) => ({
          block_id: 'block:' + surface.id,
          label: surface.title || 'Terminal',
          creator_name: 'com.superlogical.terminal',
        }));
    },
    capture: (session, block) => run(['read-screen', ...target(session, block)]),
    activity: async (session, block) => {
      const records = await readStatus?.(uuid(session, 'session'), uuid(block, 'block'));
      if (records !== undefined) return records;
      // Native hooks remain a fallback when no OSC snapshot was retained.
      const data = await json([
        'rpc',
        'surface.input_state',
        JSON.stringify({
          workspace_id: uuid(session, 'session'),
          surface_id: uuid(block, 'block'),
        }),
      ]);
      const states: Record<string, string> = {
        running: 'working',
        idle: 'idle',
        needs_input: 'blocked',
        needsInput: 'blocked',
        completed: 'done',
        failed: 'error',
      };
      const state = data.waiting_on_human ? 'blocked' : states[data.lifecycle];
      return state ? [{ state }] : [];
    },
    launch: async ({ label, cwd, command, session }) => {
      const commandText = command.map(shellQuote).join(' ');
      const created = await json(
        session
          ? [
              'new-surface',
              '--workspace',
              uuid(session, 'session'),
              '--type',
              'terminal',
              '--working-directory',
              cwd,
              '--command',
              commandText,
              '--focus',
              'false',
            ]
          : [
              'workspace',
              'create',
              '--name',
              label,
              '--cwd',
              cwd,
              '--command',
              commandText,
              '--focus',
              'false',
            ],
      );
      if (!created.workspace_id)
        throw new Error('cmux did not return the created workspace ID. Refresh before retrying.');
      return {
        session_id: 'session:' + created.workspace_id,
        block_id: created.surface_id ? 'block:' + created.surface_id : undefined,
      };
    },
    send: async (session, block, message) => {
      await cmuxInput(run, ['send', ...target(session, block), '--paste', '--', message]);
    },
    key: async (session, block, key, options) => {
      await cmuxInput(run, [
        'send-key',
        ...target(session, block),
        ...(options?.answerPrompt ? ['--force'] : []),
        key,
      ]);
    },
  };
}

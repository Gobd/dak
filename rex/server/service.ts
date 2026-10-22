import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const label = 'dev.dak.agent-voice';
const domain = `gui/${process.getuid?.()}`;
const target = `${domain}/${label}`;
const plistPath = resolve(homedir(), 'Library/LaunchAgents', label + '.plist');
const logsDir = resolve(homedir(), 'Library/Logs/DAK/Agent Voice');
const stdoutPath = resolve(logsDir, 'manager.log');
const stderrPath = resolve(logsDir, 'errors.log');

function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
export function servicePlist(directory: string, node: string, path: string, logs: string): string {
  const args = [
    node,
    `--env-file-if-exists=${resolve(directory, '.env.local')}`,
    resolve(directory, 'server/main.ts'),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${args.map((arg) => '<string>' + xml(arg) + '</string>').join('')}</array>
<key>WorkingDirectory</key><string>${xml(directory)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(path)}</string></dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${xml(resolve(logs, 'manager.log'))}</string>
<key>StandardErrorPath</key><string>${xml(resolve(logs, 'errors.log'))}</string>
</dict></plist>
`;
}
async function loaded() {
  try {
    return (await execute('/bin/launchctl', ['print', target])).stdout;
  } catch {
    return '';
  }
}
async function install() {
  await mkdir(dirname(plistPath), { recursive: true });
  await mkdir(logsDir, { recursive: true });
  // Never persist secrets from .env.local in the launch agent plist.
  await writeFile(
    plistPath,
    servicePlist(
      root,
      process.execPath,
      process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      logsDir,
    ),
    { mode: 0o600 },
  );
  if (await loaded()) await execute('/bin/launchctl', ['bootout', target]);
  await execute('/bin/launchctl', ['bootstrap', domain, plistPath]);
  console.log(`Installed and started ${label}. It runs at login while this Mac is awake.`);
}
async function start() {
  if (!existsSync(plistPath))
    throw new Error('Service is not installed. Run pnpm --filter rex service install.');
  if (!(await loaded())) await execute('/bin/launchctl', ['bootstrap', domain, plistPath]);
  else await execute('/bin/launchctl', ['kickstart', target]);
  console.log('Service started.');
}
async function stop() {
  if (await loaded()) await execute('/bin/launchctl', ['bootout', target]);
  console.log('Service stopped. It will start again at your next login.');
}
export async function manageService(command: string, args: string[] = []) {
  if (process.platform !== 'darwin')
    throw new Error(
      'The service CLI requires macOS. Use pnpm --filter rex start on other systems.',
    );
  const commands: Record<string, () => Promise<void>> = {
    install,
    start,
    stop,
    restart: async () => {
      if (!(await loaded())) return start();
      await execute('/bin/launchctl', ['kickstart', '-k', target]);
      console.log('Service restarted with the current TypeScript files and .env.local.');
    },
    status: async () => {
      const info = await loaded();
      console.log(
        `Installed: ${existsSync(plistPath) ? 'yes' : 'no'}\nLoaded: ${info ? 'yes' : 'no'}\nPlist: ${plistPath}\nLogs: ${logsDir}`,
      );
      if (info)
        console.log(
          info
            .split('\n')
            .filter((line) => /state =|pid =|last exit code =|program =/.test(line))
            .join('\n'),
        );
      const host = process.env.REX_HOST || '127.0.0.1';
      const url = `${process.env.REX_TLS_CERT ? 'https' : 'http'}://${host}:${process.env.REX_PORT || '5184'}/rex/api/status?provider=${process.env.VOICE_PROVIDER || 'rex'}`;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        console.log(
          'Manager health: ' +
            (response.ok ? 'ready' : 'not ready') +
            ' (' +
            JSON.stringify(await response.json()) +
            ')',
        );
      } catch {
        console.log('Manager health: unreachable at ' + url);
      }
    },
    uninstall: async () => {
      if (await loaded()) await execute('/bin/launchctl', ['bootout', target]);
      await unlink(plistPath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      console.log('Service uninstalled. Configuration and logs have been kept.');
    },
    update: async () => {
      if (!existsSync(plistPath)) throw new Error('Install the service before updating it.');
      console.log(
        'Updating dependencies from the current checkout; pull repository changes first.',
      );
      await new Promise<void>((done, reject) => {
        const child = spawn('pnpm', ['install', '--frozen-lockfile'], {
          cwd: resolve(root, '..'),
          stdio: 'inherit',
        });
        child.on('error', reject);
        child.on('exit', (code) =>
          code === 0
            ? done()
            : reject(new Error('Dependency update failed; the service was not restarted.')),
        );
      });
      await install();
    },
    logs: async () => {
      if (!existsSync(stdoutPath) && !existsSync(stderrPath))
        throw new Error('No logs yet. Install or start the service first.');
      const files = [stdoutPath, stderrPath].filter(existsSync);
      if (args.includes('--open')) {
        try {
          await execute('code', files);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          await execute('/usr/bin/open', ['-t', ...files]);
        }
      } else if (args.includes('--follow')) {
        await new Promise<void>((done, reject) => {
          const child = spawn('/usr/bin/tail', ['-n', '100', '-F', ...files], { stdio: 'inherit' });
          child.on('error', reject);
          child.on('exit', () => done());
        });
      } else {
        console.log(
          (await execute('/usr/bin/tail', ['-n', '100', ...files], { maxBuffer: 1024 * 1024 }))
            .stdout,
        );
      }
    },
  };
  const action = commands[command];
  if (!action) {
    console.log(
      'Usage: pnpm --filter rex service <install|status|start|stop|restart|uninstall|update|logs>\nLogs: add --follow or --open.',
    );
    if (command && command !== 'help') throw new Error('Unknown service command: ' + command);
    return;
  }
  await action();
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await manageService(process.argv[2] || 'help', process.argv.slice(3));
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}

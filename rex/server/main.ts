import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createManager, validatePresets } from './manager.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundledRex = '/Applications/Rex Beta.app/Contents/Helpers/Rex Server.rex/Contents/MacOS/rex';
const presetsPath = resolve(root, process.env.REX_PRESETS_FILE || 'launchers.local.json');
const presets = existsSync(presetsPath)
  ? validatePresets(JSON.parse(await readFile(presetsPath, 'utf8')))
  : [];
const commandJson = process.env.REX_MANAGER_COMMAND_JSON;
const managerCommand = commandJson ? JSON.parse(commandJson) : undefined;
if (
  managerCommand &&
  (!Array.isArray(managerCommand) ||
    !managerCommand.length ||
    managerCommand.some((argument) => typeof argument !== 'string' || argument.includes('\0')) ||
    !managerCommand[0])
)
  throw new Error('REX_MANAGER_COMMAND_JSON must be a nonempty command array.');
const cert = process.env.REX_TLS_CERT;
const key = process.env.REX_TLS_KEY;
if (!!cert !== !!key) throw new Error('Set both REX_TLS_CERT and REX_TLS_KEY.');
const tls = cert ? { cert: await readFile(cert), key: await readFile(key!) } : undefined;
const server = createManager({
  presets,
  rexBin: process.env.REX_BIN || (existsSync(bundledRex) ? bundledRex : 'rex'),
  cmuxBin: process.env.CMUX_BIN || 'cmux',
  managerCommand,
  managerCwd: process.env.REX_MANAGER_CWD || root,
  projectRoot: process.env.REX_PROJECT_ROOT || resolve(root, '../..'),
  allowedOrigins: (
    process.env.REX_ALLOWED_ORIGINS || 'https://dak.bkemper.me,http://localhost:5183'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  tls,
});
const host = process.env.REX_HOST || '127.0.0.1';
const port = Number(process.env.REX_PORT || 5184);
server.listen(port, host, () => {
  console.log(`Agent Voice manager: ${tls ? 'https' : 'http'}://${host}:${port}/rex/`);
  if (!presets.length) console.log('Add launchers.local.json to enable session launch presets.');
  if (!managerCommand) console.log('Set REX_MANAGER_COMMAND_JSON to enable manager chat.');
});

function shutdown() {
  server.closeAllConnections();
  server.close(() => process.exit(0));
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

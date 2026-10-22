import { open, readdir } from 'node:fs/promises';
import { watchFile, unwatchFile } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ChatMessage, ConversationLink, TerminalHistory } from '../shared/terminal.ts';
import type { TerminalBackend } from './terminals.ts';

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const maxBytes = 8 * 1024 * 1024;
const maxMessages = 200;

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (part) =>
        ['text', 'input_text', 'output_text'].includes(part?.type) && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('\n');
}

export function parseConversation(data: string, kind: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const rows = data.split('\n').flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const confirmedIds = new Set<string>();
  const confirmedText = new Set<string>();
  const compactionSummaries = new Set<string>();
  if (kind === 'codex') {
    for (const row of rows) {
      const event = row.type === 'event_msg' ? row.payload : undefined;
      if (event?.type === 'item_completed' && event.item?.type === 'AgentMessage') {
        confirmedIds.add(event.item.id);
      }
      if (event?.type === 'task_complete' && typeof event.last_agent_message === 'string') {
        confirmedText.add(event.last_agent_message.trim());
      }
      if (event?.type === 'agent_message' && typeof event.message === 'string') {
        confirmedText.add(event.message.trim());
      }
      if (row.type === 'compacted' && typeof row.payload?.message === 'string') {
        compactionSummaries.add(row.payload.message);
      }
    }
  }
  for (const row of rows) {
    let message;
    if (kind === 'codex' && row.type === 'response_item' && row.payload?.type === 'message') {
      message = row.payload;
      if (message.channel === 'analysis' || message.phase === 'analysis') continue;
    } else if (kind === 'claude' && ['user', 'assistant'].includes(row.type) && !row.isSidechain) {
      message = row.message;
    } else if (kind === 'pi' && row.type === 'message') {
      message = row.message;
    }
    if (!message || !['user', 'assistant'].includes(message.role)) continue;
    const text = contentText(message.content).trim();
    if (!text) continue;
    if (kind === 'codex') {
      // Compaction emits a response_item that looks like a final answer, but is
      // never completed as a user-facing AgentMessage. Wait for that event.
      if (
        message.role === 'assistant' &&
        ((message.internal_chat_message_metadata_passthrough &&
          !confirmedIds.has(message.id) &&
          !confirmedText.has(text)) ||
          [...compactionSummaries].some((summary) => summary.endsWith(text)))
      )
        continue;
      if (
        message.role === 'user' &&
        text.startsWith(
          'Another language model started to solve this problem and produced a summary of its thinking process.',
        )
      )
        continue;
    }
    if (
      kind === 'codex' &&
      message.role === 'user' &&
      /^(?:<environment_context>|<permissions instructions>|<skills_instructions>|# AGENTS\.md instructions|<INSTRUCTIONS>)/.test(
        text,
      )
    )
      continue;
    messages.push({
      role: message.role,
      text: text.slice(0, 16000),
      ...(message.phase ? { phase: message.phase } : {}),
    });
  }
  return messages;
}

async function findTranscript(
  root: string,
  id: string,
  depth: number,
): Promise<string | undefined> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const file = entries.find(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith('.jsonl') &&
      (entry.name === `${id}.jsonl` ||
        entry.name.endsWith(`-${id}.jsonl`) ||
        entry.name.endsWith(`_${id}.jsonl`)),
  );
  if (file) return join(root, file.name);
  if (depth <= 0) return;
  for (const entry of entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name))) {
    const found = await findTranscript(join(root, entry.name), id, depth - 1);
    if (found) return found;
  }
}

async function conversationPath(
  link: ConversationLink,
  home = homedir(),
): Promise<string | undefined> {
  if (!uuid.test(link.id)) return;
  const roots: Record<string, { path: string; depth: number }> = {
    codex: { path: join(process.env.CODEX_HOME || join(home, '.codex'), 'sessions'), depth: 3 },
    claude: {
      path: join(process.env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'projects'),
      depth: 1,
    },
    pi: {
      path: join(process.env.PI_CODING_AGENT_DIR || join(home, '.pi', 'agent'), 'sessions'),
      depth: 1,
    },
  };
  const root = roots[link.kind];
  if (!root) return;
  return findTranscript(root.path, link.id, root.depth);
}

export async function readConversation(
  link: ConversationLink,
  home = homedir(),
): Promise<TerminalHistory | undefined> {
  const path = await conversationPath(link, home);
  if (!path) return;
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    const start = Math.max(0, size - maxBytes);
    const buffer = Buffer.alloc(Math.min(size, maxBytes));
    const { bytesRead } = await file.read(buffer, 0, buffer.length, start);
    let data = buffer.subarray(0, bytesRead).toString('utf8');
    if (start) data = data.slice(data.indexOf('\n') + 1);
    const messages = parseConversation(data, link.kind);
    if (!messages.length) return;
    return {
      source: 'conversation',
      app: link.kind,
      conversationId: link.id,
      messages: messages.slice(-maxMessages),
      truncated: start > 0 || messages.length > maxMessages,
    };
  } finally {
    await file.close();
  }
}

export async function terminalHistory(
  backend: TerminalBackend,
  session: string,
  block: string,
): Promise<TerminalHistory> {
  const details = await backend.describe(session, block).catch(() => undefined);
  if (details?.conversation) {
    const history = await readConversation(details.conversation).catch(() => undefined);
    if (history) return history;
  }
  const output = await backend.scrollback(session, block);
  return {
    source: 'scrollback',
    messages: [],
    app: details?.app,
    output: output.slice(-160000),
    truncated: output.length > 160000,
  };
}

export function streamHistory(
  response: ServerResponse,
  backend: TerminalBackend,
  session: string,
  block: string,
) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.write(': connected\n\n');
  let busy = false;
  let queued = false;
  let closed = false;
  let previous = '';
  let watched: string | undefined;
  const changed = () => {
    void refresh();
  };
  const refresh = async () => {
    if (closed) return;
    if (busy) {
      queued = true;
      return;
    }
    busy = true;
    try {
      const details = await backend.describe(session, block).catch(() => undefined);
      const path = details?.conversation ? await conversationPath(details.conversation) : undefined;
      if (closed) return;
      if (path !== watched) {
        if (watched) unwatchFile(watched, changed);
        watched = path;
        if (watched) watchFile(watched, { interval: 200, persistent: false }, changed);
      }
      const history = await terminalHistory(backend, session, block);
      if (closed) return;
      const data = JSON.stringify(history);
      if (data !== previous) {
        previous = data;
        response.write(`event: history\ndata: ${data}\n\n`);
      }
    } catch {
      if (!closed)
        response.write(
          'event: unavailable\ndata: {"message":"Live history is temporarily unavailable. Reconnecting…"}\n\n',
        );
    } finally {
      busy = false;
      if (queued && !closed) {
        queued = false;
        void refresh();
      }
    }
  };
  const fallback = setInterval(() => void refresh(), 3000);
  const heartbeat = setInterval(() => {
    if (!closed) response.write(': heartbeat\n\n');
  }, 20000);
  response.once('close', () => {
    closed = true;
    clearInterval(fallback);
    clearInterval(heartbeat);
    if (watched) unwatchFile(watched, changed);
  });
  void refresh();
}

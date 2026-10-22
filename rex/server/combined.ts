import type { Block, Provider, Session } from '../shared/terminal.ts';
import { TerminalInputError, type TerminalBackend } from './terminals.ts';

const providers: Provider[] = ['rex', 'cmux'];
function scoped(id: string, provider: Provider): string {
  return id.replace(':', `:${provider}-`);
}
function target(session: string, block?: string) {
  const match = /^session:(rex|cmux)-([a-zA-Z0-9-]+)$/.exec(session);
  if (!match) throw new TerminalInputError('Choose a terminal from Rex or cmux.');
  const provider = match[1] as Provider;
  if (block && !block.startsWith(`block:${provider}-`))
    throw new TerminalInputError(
      'That terminal belongs to a different app. Refresh and select it again.',
    );
  return {
    provider,
    session: `session:${match[2]}`,
    block: block?.replace(`block:${provider}-`, 'block:') || '',
  };
}

export function combinedBackend(backends: Record<Provider, TerminalBackend>): TerminalBackend {
  const status = async () => {
    const results = await Promise.allSettled(
      providers.map((provider) => backends[provider].status()),
    );
    const connections = Object.fromEntries(
      providers.map((provider, index) => [provider, results[index].status === 'fulfilled']),
    );
    return { connected: Object.values(connections).some(Boolean), connections };
  };
  const sessions = async (): Promise<Session[]> => {
    const results = await Promise.allSettled(
      providers.map((provider) => backends[provider].sessions()),
    );
    return results.flatMap((result, index) =>
      result.status === 'fulfilled'
        ? result.value.map((session) => ({
            ...session,
            provider: providers[index],
            session_id: scoped(session.session_id, providers[index]),
          }))
        : [],
    );
  };
  return {
    status,
    sessions,
    blocks: async (session): Promise<Block[]> => {
      const t = target(session);
      return (await backends[t.provider].blocks(t.session)).map((block) => ({
        ...block,
        block_id: scoped(block.block_id, t.provider),
      }));
    },
    describe: (session, block) => {
      const t = target(session, block);
      return backends[t.provider].describe(t.session, t.block);
    },
    activity: (session, block) => {
      const t = target(session, block);
      return backends[t.provider].activity(t.session, t.block);
    },
    capture: (session, block) => {
      const t = target(session, block);
      return backends[t.provider].capture(t.session, t.block);
    },
    scrollback: (session, block) => {
      const t = target(session, block);
      return backends[t.provider].scrollback(t.session, t.block);
    },
    send: (session, block, message) => {
      const t = target(session, block);
      return backends[t.provider].send(t.session, t.block, message);
    },
    key: (session, block, key, options) => {
      const t = target(session, block);
      return backends[t.provider].key(t.session, t.block, key, options);
    },
    launch: async (options) => {
      const existing = options.session ? target(options.session) : undefined;
      let provider = existing?.provider || options.provider;
      if (provider && !providers.includes(provider))
        throw new TerminalInputError('Choose Rex or cmux for the new agent.');
      if (!provider) {
        const available = await status();
        const online = providers.filter((item) => available.connections[item]);
        if (online.length !== 1)
          throw new TerminalInputError('Choose Rex or cmux for the new agent.');
        provider = online[0];
      }
      const created = await backends[provider].launch({ ...options, session: existing?.session });
      return {
        ...created,
        session_id: scoped(created.session_id, provider),
        block_id: created.block_id ? scoped(created.block_id, provider) : undefined,
      };
    },
  };
}

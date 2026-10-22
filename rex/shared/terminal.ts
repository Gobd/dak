export const providers = {
  rex: { label: 'Rex', sessionLabel: 'Session' },
  cmux: { label: 'cmux', sessionLabel: 'Workspace' },
} as const;
export type Provider = keyof typeof providers;
export type ProviderScope = Provider | 'all';
export interface Session {
  session_id: string;
  label: string;
  provider?: Provider;
}
export interface Block {
  block_id: string;
  label: string;
  creator_name: string;
}
export interface ConversationLink {
  kind: string;
  id: string;
  cwd?: string;
}
export interface TerminalDetails {
  agent: boolean | null;
  app?: string;
  state?: string;
  conversation?: ConversationLink;
}
export interface AgentTerminal extends Block, TerminalDetails {}
export interface TerminalSession extends Session {
  terminals: AgentTerminal[];
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  phase?: string;
}
export interface TerminalHistory {
  source: 'conversation' | 'scrollback';
  messages: ChatMessage[];
  output?: string;
  app?: string;
  conversationId?: string;
  truncated?: boolean;
}
export interface StatusRecord {
  id?: string;
  state: string;
  kind?: string;
  msg?: string;
  updated_at?: string;
  app?: string;
  effective_app?: string;
}
export interface ActivityTerminal {
  session: string;
  block: string;
  label: string;
  records: StatusRecord[];
}
export interface ActivityEvent {
  state: string;
  signature: string;
  message: string;
}
const urgency: Record<string, number> = { blocked: 5, error: 4, working: 3, done: 2, idle: 1 };
export function activityEvent(
  records: StatusRecord[],
  previous?: ActivityEvent,
): ActivityEvent | undefined {
  const record = records
    .filter((item) => urgency[item.state])
    .sort((a, b) => urgency[b.state] - urgency[a.state])[0];
  if (!record) return undefined;
  const signature = JSON.stringify([record.id, record.state, record.kind, record.msg]);
  const message =
    record.msg ||
    (
      {
        blocked: 'needs your input',
        error: 'reported an error',
        done: 'finished its work',
        idle: 'is idle and ready for your next instruction',
      } as Record<string, string>
    )[record.state] ||
    '';
  return {
    state: record.state,
    signature,
    message: record.state === 'idle' && !previous ? '' : message,
  };
}
export function shouldAnnounce(
  event: ActivityEvent | undefined,
  previous?: ActivityEvent,
): boolean {
  return !!event && !!event.message && event.signature !== previous?.signature;
}

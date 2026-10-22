export interface Session {
  session_id: string;
  label: string;
}

export interface Block {
  block_id: string;
  label: string;
  creator_name: string;
}

export interface Preset {
  id: string;
  label: string;
  cwd: string;
  command: string[];
}

export interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export function managerOrigin(value: string): string {
  if (!value.trim()) return '';
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Enter the manager origin, such as https://rex.example.com, without a path.');
  }
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  ) {
    throw new Error('Use HTTPS for the manager, or HTTP on localhost during development.');
  }
  return url.origin;
}

export async function api<T>(route: string, body?: unknown, managerUrl = ''): Promise<T> {
  const origin = managerOrigin(managerUrl);
  const response = await fetch(`${origin || window.location.origin}/rex/api/${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(route === 'chat' ? 180000 : 30000),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      result.error ||
        (response.status === 404
          ? 'Set the private Mac manager address in Settings.'
          : `Request failed (${response.status})`),
    );
  }
  return result as T;
}

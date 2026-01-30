import { RealtimeSync } from '@dak/ui';
import type { PostgresChangeEvent } from '@dak/ui';
import { supabase } from './supabase';
import type { SyncEvent } from '../types';

type SyncHandler = (event: SyncEvent | PostgresChangeEvent) => void;

const handlers = new Set<SyncHandler>();
let onReconnectCallback: (() => void) | null = null;

const sync = new RealtimeSync<SyncEvent>({
  supabase,
  channelPrefix: 'sync:maintenance',
  onEvent: (event) => {
    handlers.forEach((handler) => handler(event));
  },
  onReconnect: () => {
    onReconnectCallback?.();
  },
  tables: [
    { table: 'maint_tasks', filter: 'user_id=eq.${userId}' },
    { table: 'maint_logs', filter: 'user_id=eq.${userId}' },
  ],
});

export function subscribeToSync(
  userId: string,
  onEvent: SyncHandler,
  onReconnect?: () => void,
): () => void {
  handlers.add(onEvent);

  if (onReconnect) {
    onReconnectCallback = onReconnect;
  }

  if (handlers.size === 1) {
    sync.subscribe(userId);
  }

  return () => {
    handlers.delete(onEvent);
    if (handlers.size === 0) {
      sync.unsubscribe();
      onReconnectCallback = null;
    }
  };
}

export async function broadcastSync(event: SyncEvent) {
  await sync.broadcast(event);
}

export function unsubscribeFromSync() {
  handlers.clear();
  sync.unsubscribe();
  onReconnectCallback = null;
}

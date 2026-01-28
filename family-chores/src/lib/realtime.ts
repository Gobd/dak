import { RealtimeSync } from '@dak/ui';
import type { PostgresChangeEvent } from '@dak/ui';
import { supabase } from './supabase';
import type { SyncEvent } from '../types';

type SyncHandler = (event: SyncEvent | PostgresChangeEvent) => void;

const handlers = new Set<SyncHandler>();
let onReconnectCallback: (() => void) | null = null;

const sync = new RealtimeSync<SyncEvent>({
  supabase,
  channelPrefix: 'sync:chores',
  onEvent: (event) => {
    handlers.forEach((handler) => handler(event));
  },
  onReconnect: () => {
    onReconnectCallback?.();
  },
  // Watch root tables with user_id for bulletproof "something changed" detection
  // Child tables (chore_instances, goal_completions, points_ledger) use broadcast
  tables: [
    { table: 'family_members', filter: 'user_id=eq.${userId}' },
    { table: 'chores', filter: 'user_id=eq.${userId}' },
    { table: 'app_settings', filter: 'user_id=eq.${userId}' },
  ],
});

/**
 * Subscribe to sync events for cross-device updates
 */
export function subscribeToSync(
  userId: string,
  onEvent: SyncHandler,
  onReconnect?: () => void,
): () => void {
  handlers.add(onEvent);

  if (onReconnect) {
    onReconnectCallback = onReconnect;
  }

  // Subscribe if this is the first handler
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

/**
 * Broadcast a sync event to other devices
 */
export async function broadcastSync(event: SyncEvent) {
  await sync.broadcast(event);
}

/**
 * Cleanup on logout
 */
export function unsubscribeFromSync() {
  handlers.clear();
  sync.unsubscribe();
  onReconnectCallback = null;
}

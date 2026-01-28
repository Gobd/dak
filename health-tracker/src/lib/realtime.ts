import { RealtimeSync } from '@dak/ui';
import type { PostgresChangeEvent } from '@dak/ui';
import { supabase } from './supabase';

export type SyncEvent =
  | { type: 'shots' }
  | { type: 'medicine' }
  | { type: 'prn' }
  | { type: 'people' };

type SyncHandler = (event: SyncEvent | PostgresChangeEvent) => void;

const handlers = new Set<SyncHandler>();
let onReconnectCallback: (() => void) | null = null;

const sync = new RealtimeSync<SyncEvent>({
  supabase,
  channelPrefix: 'sync:health',
  onEvent: (event) => {
    handlers.forEach((handler) => handler(event));
  },
  onReconnect: () => {
    // Refresh all data on reconnect
    onReconnectCallback?.();
  },
  // Watch all tables with user_id for bulletproof postgres_changes
  tables: [
    { table: 'people', filter: 'user_id=eq.${userId}' },
    { table: 'shot_schedules', filter: 'user_id=eq.${userId}' },
    { table: 'shot_logs', filter: 'user_id=eq.${userId}' },
    { table: 'medicine_courses', filter: 'user_id=eq.${userId}' },
    { table: 'medicine_doses', filter: 'user_id=eq.${userId}' },
    { table: 'prn_meds', filter: 'user_id=eq.${userId}' },
    { table: 'prn_logs', filter: 'user_id=eq.${userId}' },
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

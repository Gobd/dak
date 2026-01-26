import { RealtimeSync } from '@dak/ui';
import { supabase } from './supabase';

export type SyncEvent =
  | { type: 'entries' }
  | { type: 'targets' }
  | { type: 'presets' }
  | { type: 'preferences' };

type SyncHandler = (event: SyncEvent) => void;

const handlers = new Set<SyncHandler>();

const sync = new RealtimeSync<SyncEvent>({
  supabase,
  channelPrefix: 'sync:tracker',
  onEvent: (event) => {
    handlers.forEach((handler) => handler(event));
  },
});

/**
 * Subscribe to sync events for cross-device updates
 */
export function subscribeToSync(userId: string, onEvent: SyncHandler) {
  handlers.add(onEvent);

  // Subscribe if this is the first handler
  if (handlers.size === 1) {
    sync.subscribe(userId);
  }

  return () => {
    handlers.delete(onEvent);
    if (handlers.size === 0) {
      sync.unsubscribe();
    }
  };
}

/**
 * Broadcast a sync event to other devices (only if others are online)
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
}

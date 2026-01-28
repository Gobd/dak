import { RealtimeSync } from '@dak/ui';
import type { PostgresChangeEvent } from '@dak/ui';
import { supabase } from './supabase';

export type SyncEvent =
  | { type: 'note_changed'; noteId: string }
  | { type: 'note_created'; noteId: string }
  | { type: 'note_trashed'; noteId: string }
  | { type: 'note_restored'; noteId: string }
  | { type: 'note_deleted'; noteId: string }
  | { type: 'notes_refresh' }
  | { type: 'tags_refresh' };

type SyncHandler = (event: SyncEvent | PostgresChangeEvent) => void;

const handlers = new Set<SyncHandler>();
let onReconnectCallback: (() => void) | null = null;
let currentUserId: string | null = null;

const sync = new RealtimeSync<SyncEvent>({
  supabase,
  channelPrefix: 'realtime:notes',
  onEvent: (event) => {
    handlers.forEach((handler) => handler(event));
  },
  onReconnect: () => {
    onReconnectCallback?.();
  },
  // Watch tables with user_id for bulletproof postgres_changes:
  // - notes: owned notes (any change to my notes)
  // - note_access: notes shared with me (when someone shares/unshares)
  // - tags: my tags
  tables: [
    { table: 'notes', filter: 'user_id=eq.${userId}' },
    { table: 'note_access', filter: 'user_id=eq.${userId}' },
    { table: 'tags', filter: 'user_id=eq.${userId}' },
  ],
});

/**
 * Subscribe to sync events for a user
 *
 * Uses postgres_changes for owned notes (bulletproof) and
 * broadcast for shared notes (fast notification from other users)
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

  currentUserId = userId;

  // Subscribe if this is the first handler
  if (handlers.size === 1) {
    sync.subscribe(userId);
  }

  return () => {
    handlers.delete(onEvent);
    if (handlers.size === 0) {
      sync.unsubscribe();
      onReconnectCallback = null;
      currentUserId = null;
    }
  };
}

/**
 * Broadcast a sync event to other devices/users
 *
 * For private notes: broadcasts only to user's own channel (other devices)
 * For shared notes: broadcasts to own channel AND all users with access
 */
export async function broadcastSync(event: SyncEvent, isPrivate: boolean = true) {
  // Broadcast to own channel (for own other devices)
  await sync.broadcast(event);

  // For shared notes, also notify all users who have access (owner + other shared users)
  if (!isPrivate && 'noteId' in event) {
    await notifyUsersWithAccess(event.noteId, event);
  }
}

/**
 * Notify all users who have access to a note (excluding current user)
 * This includes the owner (if current user is a shared user) and other shared users
 */
async function notifyUsersWithAccess(noteId: string, event: SyncEvent) {
  if (!currentUserId) return;

  try {
    // Get all users with access to this note (owner + shared users)
    const { data: accessList, error } = await supabase
      .from('note_access')
      .select('user_id')
      .eq('note_id', noteId);

    if (error || !accessList) {
      console.error('[realtime] Failed to get note access:', error);
      return;
    }

    // Filter out current user
    const userIds = accessList
      .map((a) => a.user_id)
      .filter((id): id is string => id !== null && id !== currentUserId);

    if (userIds.length === 0) return;

    // Send to each user's channel
    await Promise.all(
      userIds.map(async (userId) => {
        const channel = supabase.channel(`realtime:notes:${userId}`);
        try {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
            channel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                clearTimeout(timeout);
                resolve();
              }
            });
          });

          await channel.send({
            type: 'broadcast',
            event: 'sync',
            payload: event,
          });
        } catch {
          // Timeout or error - user may be offline, that's fine
        } finally {
          supabase.removeChannel(channel);
        }
      }),
    );
  } catch (err) {
    console.error('[realtime] Failed to notify users:', err);
  }
}

/**
 * Unsubscribe from all sync events (call on signout)
 */
export function unsubscribeFromSync() {
  handlers.clear();
  sync.unsubscribe();
  onReconnectCallback = null;
  currentUserId = null;
}

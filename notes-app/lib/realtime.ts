import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SyncEvent =
  | { type: 'note_changed'; noteId: string }
  | { type: 'note_created'; noteId: string }
  | { type: 'note_trashed'; noteId: string }
  | { type: 'note_restored'; noteId: string }
  | { type: 'note_deleted'; noteId: string }
  | { type: 'notes_refresh' }
  | { type: 'tags_refresh' };

type SyncHandler = (event: SyncEvent) => void;

// User's personal channel (for syncing across their devices)
let userChannel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
const handlers = new Set<SyncHandler>();

// Presence channel to track who's online
let presenceChannel: RealtimeChannel | null = null;
// Cache of online user IDs (updated via presence sync)
const onlineUsers = new Set<string>();

// Reconnection state
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

// Heartbeat to detect silent disconnects (important for kiosk/long-running apps)
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_INTERVAL_MS = 30000; // Check every 30 seconds

/**
 * Start heartbeat to detect silent disconnects
 */
function startHeartbeat(userId: string) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    // Check if channels are in a healthy state
    const userChannelState = userChannel?.state;
    const presenceChannelState = presenceChannel?.state;

    if (userChannelState !== 'joined' && userChannelState !== 'joining') {
      console.warn(`[realtime] Heartbeat detected unhealthy user channel: ${userChannelState}`);
      scheduleReconnect(userId);
    } else if (presenceChannelState !== 'joined' && presenceChannelState !== 'joining') {
      console.warn(
        `[realtime] Heartbeat detected unhealthy presence channel: ${presenceChannelState}`
      );
      scheduleReconnect(userId);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop the heartbeat interval
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Schedule a reconnection attempt with exponential backoff
 */
function scheduleReconnect(userId: string) {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[realtime] Max reconnection attempts reached, giving up');
    return;
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s
  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts),
    RECONNECT_MAX_DELAY_MS
  );
  reconnectAttempts++;

  console.log(`[realtime] Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    reconnectChannels(userId);
  }, delay);
}

/**
 * Reconnect all channels after a disconnect
 */
function reconnectChannels(userId: string) {
  console.log('[realtime] Attempting to reconnect...');

  // Clean up old channels
  if (userChannel) {
    supabase.removeChannel(userChannel);
    userChannel = null;
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
    onlineUsers.clear();
  }

  // Re-establish channels
  setupChannels(userId);
}

/**
 * Set up the broadcast and presence channels
 */
function setupChannels(userId: string) {
  // Create broadcast channel for this user's devices
  // self: false means we don't receive our own broadcasts
  userChannel = supabase.channel(`sync:user:${userId}`, {
    config: {
      broadcast: { self: false },
    },
  });

  userChannel
    .on('broadcast', { event: 'sync' }, ({ payload }) => {
      const event = payload as SyncEvent;
      handlers.forEach((handler) => handler(event));
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[realtime] User channel connected');
        reconnectAttempts = 0; // Reset on successful connection
        startHeartbeat(userId); // Start monitoring for silent disconnects
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[realtime] User channel failed:', status, err);
        stopHeartbeat();
        scheduleReconnect(userId);
      } else if (status === 'CLOSED') {
        console.warn('[realtime] User channel closed, reconnecting...');
        stopHeartbeat();
        scheduleReconnect(userId);
      }
    });

  // Subscribe to presence channel to track who's online
  // This lets us skip broadcasting to users who aren't listening
  presenceChannel = supabase.channel('presence:online');

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      // Rebuild online users set from presence state
      onlineUsers.clear();
      const state = presenceChannel?.presenceState() ?? {};
      for (const presences of Object.values(state)) {
        for (const presence of presences as Array<{ user_id?: string }>) {
          if (presence.user_id) {
            onlineUsers.add(presence.user_id);
          }
        }
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[realtime] Presence channel connected');
        // Track this user as online
        await presenceChannel?.track({ user_id: userId });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[realtime] Presence channel disconnected:', status);
        // Presence reconnect is handled by user channel reconnect
      }
    });
}

/**
 * Subscribe to sync events for a user
 *
 * Syncs across a user's own devices. When another device (or a user
 * who shared a note with them) makes changes, they receive events here.
 */
export function subscribeToSync(userId: string, onEvent: SyncHandler) {
  handlers.add(onEvent);

  // Only create channel once per user
  if (userChannel && currentUserId === userId) {
    return () => {
      handlers.delete(onEvent);
    };
  }

  // Clean up old channels if user changed
  if (userChannel) {
    supabase.removeChannel(userChannel);
    userChannel = null;
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
    onlineUsers.clear();
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  currentUserId = userId;
  reconnectAttempts = 0;

  // Set up the channels
  setupChannels(userId);

  return () => {
    handlers.delete(onEvent);
    if (handlers.size === 0) {
      stopHeartbeat();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (userChannel) {
        supabase.removeChannel(userChannel);
        userChannel = null;
      }
      if (presenceChannel) {
        supabase.removeChannel(presenceChannel);
        presenceChannel = null;
        onlineUsers.clear();
      }
      currentUserId = null;
      reconnectAttempts = 0;
    }
  };
}

/**
 * Broadcast a sync event to other devices/users
 *
 * For private notes (isPrivate=true): broadcasts only to user's own devices
 * For shared notes (isPrivate=false): broadcasts to user's devices AND
 *   all users who have access via note_shares table
 *
 * @param event - The sync event to broadcast
 * @param isPrivate - If true, only sync to own devices. If false, also notify shared users.
 */
export async function broadcastSync(event: SyncEvent, isPrivate: boolean = true) {
  if (!userChannel || !currentUserId) {
    // No channel yet - this can happen on first save before sync is set up
    // It's fine, the other devices will fetch on load anyway
    return;
  }

  // Always broadcast to own devices
  const result = await userChannel.send({
    type: 'broadcast',
    event: 'sync',
    payload: event,
  });

  if (result !== 'ok') {
    console.warn('[realtime] Broadcast to own devices failed:', result);
  }

  // For shared notes, also notify users who have access
  if (!isPrivate && 'noteId' in event) {
    await notifySharedUsers(event.noteId, event);
  }
}

/**
 * Notify all users who have access to a shared note
 *
 * Only notifies users who are currently online (via presence).
 * Offline users will fetch updates when they next open the app.
 */
async function notifySharedUsers(noteId: string, event: SyncEvent) {
  try {
    // Get all users who have access to this note (excluding owner)
    const { data: shares, error } = await supabase
      .from('note_access')
      .select('user_id')
      .eq('note_id', noteId)
      .eq('is_owner', false);

    if (error || !shares) {
      console.error('Failed to get note shares:', error);
      return;
    }

    // Filter to only users who are currently online
    const userIds = shares
      .map((s) => s.user_id)
      .filter((id): id is string => id !== null && id !== currentUserId && onlineUsers.has(id));

    if (userIds.length === 0) {
      // No shared users are online - skip broadcasting entirely
      return;
    }

    const SUBSCRIPTION_TIMEOUT_MS = 5000;

    await Promise.all(
      userIds.map(async (userId) => {
        const channel = supabase.channel(`sync:user:${userId}`);

        try {
          // Wait for channel to be ready with timeout to prevent hanging
          await Promise.race([
            new Promise<void>((resolve) => {
              channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') resolve();
              });
            }),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Subscription timeout')), SUBSCRIPTION_TIMEOUT_MS)
            ),
          ]);

          // Send the broadcast and wait for confirmation
          const result = await channel.send({
            type: 'broadcast',
            event: 'sync',
            payload: event,
          });

          if (result !== 'ok') {
            console.warn(`Failed to notify user ${userId} - send returned: ${result}`);
          }
        } catch {
          // Timeout or subscription error - continue with cleanup
          console.warn(`Failed to notify user ${userId} - subscription timeout`);
        } finally {
          supabase.removeChannel(channel);
        }
      })
    );
  } catch (err) {
    console.error('Failed to notify shared users:', err);
  }
}

/**
 * Unsubscribe from all sync events
 */
export function unsubscribeFromSync() {
  stopHeartbeat();
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (userChannel) {
    supabase.removeChannel(userChannel);
    userChannel = null;
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
    onlineUsers.clear();
  }
  currentUserId = null;
  reconnectAttempts = 0;
  handlers.clear();
}

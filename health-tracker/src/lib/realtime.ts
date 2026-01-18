import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SyncEvent = { type: 'shots' } | { type: 'medicine' } | { type: 'prn' } | { type: 'people' };

type SyncHandler = (event: SyncEvent) => void;

let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let deviceId: string | null = null;
const handlers = new Set<SyncHandler>();

// Track how many devices are connected (via presence)
let otherDevicesOnline = 0;

// Reconnection state
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

// Heartbeat to detect silent disconnects (important for kiosk/long-running apps)
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_INTERVAL_MS = 30000; // Check every 30 seconds

// Track if browser event listeners are registered
let listenersRegistered = false;

/**
 * Handle visibility change - reconnect when app comes back to foreground
 * This is critical for mobile browsers that suspend JS when backgrounded
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && currentUserId) {
    const channelState = channel?.state;

    // Only reconnect if channel is unhealthy
    if (channelState !== 'joined' && channelState !== 'joining') {
      console.log('[realtime] App became visible with unhealthy channel, reconnecting...');
      reconnectAttempts = 0; // Reset so we don't stay in "given up" state
      reconnectChannel(currentUserId);
    }
  }
}

/**
 * Handle online event - reconnect when browser regains network
 */
function handleOnline() {
  if (currentUserId) {
    console.log('[realtime] Browser came online, reconnecting...');
    reconnectAttempts = 0;
    reconnectChannel(currentUserId);
  }
}

/**
 * Register browser event listeners for reconnection
 */
function registerBrowserListeners() {
  if (listenersRegistered || typeof document === 'undefined') return;

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleOnline);
  listenersRegistered = true;
}

/**
 * Unregister browser event listeners
 */
function unregisterBrowserListeners() {
  if (!listenersRegistered || typeof document === 'undefined') return;

  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleOnline);
  listenersRegistered = false;
}

/**
 * Start heartbeat to detect silent disconnects
 */
function startHeartbeat(userId: string) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    const channelState = channel?.state;

    if (channelState !== 'joined' && channelState !== 'joining') {
      console.warn(`[realtime] Heartbeat detected unhealthy channel: ${channelState}`);
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
    reconnectChannel(userId);
  }, delay);
}

/**
 * Reconnect channel after a disconnect
 */
function reconnectChannel(userId: string) {
  console.log('[realtime] Attempting to reconnect...');

  // Clean up old channel
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  otherDevicesOnline = 0;

  // Re-establish channel
  setupChannel(userId);
}

/**
 * Set up the broadcast/presence channel
 */
function setupChannel(userId: string) {
  // Unique ID for this browser tab/device
  deviceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Channel with broadcast and presence
  channel = supabase.channel(`sync:health:${userId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: deviceId },
    },
  });

  channel
    .on('broadcast', { event: 'sync' }, ({ payload }) => {
      const event = payload as SyncEvent;
      handlers.forEach((handler) => handler(event));
    })
    .on('presence', { event: 'sync' }, () => {
      // Count other devices (exclude our own deviceId)
      const state = channel?.presenceState() ?? {};
      otherDevicesOnline = Object.keys(state).filter((key) => key !== deviceId).length;
    })
    .subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[realtime] Channel connected');
        reconnectAttempts = 0; // Reset on successful connection
        startHeartbeat(userId);
        await channel?.track({ device_id: deviceId });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[realtime] Channel failed:', status, err);
        stopHeartbeat();
        scheduleReconnect(userId);
      } else if (status === 'CLOSED') {
        console.warn('[realtime] Channel closed, reconnecting...');
        stopHeartbeat();
        scheduleReconnect(userId);
      }
    });
}

/**
 * Subscribe to sync events for cross-device updates
 */
export function subscribeToSync(userId: string, onEvent: SyncHandler) {
  handlers.add(onEvent);

  if (channel && currentUserId === userId) {
    return () => {
      handlers.delete(onEvent);
    };
  }

  // Clean up old channel if user changed
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  currentUserId = userId;
  reconnectAttempts = 0;

  // Register browser event listeners for reconnection on visibility/online changes
  registerBrowserListeners();

  // Set up the channel
  setupChannel(userId);

  return () => {
    handlers.delete(onEvent);
    if (handlers.size === 0) {
      stopHeartbeat();
      unregisterBrowserListeners();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      currentUserId = null;
      deviceId = null;
      otherDevicesOnline = 0;
      reconnectAttempts = 0;
    }
  };
}

/**
 * Broadcast a sync event to other devices (only if others are online)
 */
export async function broadcastSync(event: SyncEvent) {
  // Skip if no channel or no other devices are listening
  if (!channel || otherDevicesOnline === 0) return;

  await channel.send({
    type: 'broadcast',
    event: 'sync',
    payload: event,
  });
}

/**
 * Cleanup on logout
 */
export function unsubscribeFromSync() {
  stopHeartbeat();
  unregisterBrowserListeners();
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  currentUserId = null;
  deviceId = null;
  otherDevicesOnline = 0;
  reconnectAttempts = 0;
  handlers.clear();
}

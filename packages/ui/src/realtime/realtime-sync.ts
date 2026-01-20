import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface RealtimeSyncOptions<TEvent> {
  /** Supabase client instance */
  supabase: SupabaseClient;
  /** Channel prefix (e.g., 'sync:chores', 'sync:health') - userId will be appended */
  channelPrefix: string;
  /** Handler called when sync events are received */
  onEvent: (event: TEvent) => void;
}

/**
 * Robust realtime sync manager with automatic reconnection.
 *
 * Features:
 * - Exponential backoff reconnection (1s → 30s max, 10 attempts)
 * - Heartbeat detection for silent disconnects (every 30s)
 * - Visibility change handling (reconnects when app returns to foreground)
 * - Online event handling (reconnects when browser regains network)
 * - Presence tracking to skip broadcasts when no other devices are online
 *
 * @example
 * ```ts
 * type MySyncEvent = { type: 'items' } | { type: 'settings' };
 *
 * const sync = new RealtimeSync<MySyncEvent>({
 *   supabase,
 *   channelPrefix: 'sync:myapp',
 *   onEvent: (event) => {
 *     if (event.type === 'items') refreshItems();
 *   },
 * });
 *
 * // On login
 * sync.subscribe(userId);
 *
 * // On data change
 * await sync.broadcast({ type: 'items' });
 *
 * // On logout
 * sync.unsubscribe();
 * ```
 */
export class RealtimeSync<TEvent> {
  private supabase: SupabaseClient;
  private channelPrefix: string;
  private onEvent: (event: TEvent) => void;

  private channel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;
  private deviceId: string | null = null;
  private otherDevicesOnline = 0;

  // Reconnection state
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_BASE_DELAY_MS = 1000;
  private readonly RECONNECT_MAX_DELAY_MS = 30000;

  // Heartbeat to detect silent disconnects
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 30000;

  // Track if browser event listeners are registered
  private listenersRegistered = false;

  // Bound handlers for event listeners (so we can remove them)
  private boundHandleVisibilityChange: () => void;
  private boundHandleOnline: () => void;

  constructor(options: RealtimeSyncOptions<TEvent>) {
    this.supabase = options.supabase;
    this.channelPrefix = options.channelPrefix;
    this.onEvent = options.onEvent;

    // Bind handlers so they can be removed later
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.boundHandleOnline = this.handleOnline.bind(this);
  }

  /**
   * Subscribe to sync events for a user.
   * Call this after login.
   */
  subscribe(userId: string): void {
    // Check if already subscribed with a healthy channel
    const channelState = this.channel?.state;
    if (
      this.channel &&
      this.currentUserId === userId &&
      (channelState === 'joined' || channelState === 'joining')
    ) {
      return; // Already subscribed for this user with healthy channel
    }

    // Clean up old channel if user changed
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.currentUserId = userId;
    this.reconnectAttempts = 0;

    // Register browser event listeners for reconnection
    this.registerBrowserListeners();

    // Set up the channel
    this.setupChannel(userId);
  }

  /**
   * Broadcast a sync event to other devices.
   * Only sends if other devices are online (via presence).
   */
  async broadcast(event: TEvent): Promise<void> {
    if (!this.channel || this.otherDevicesOnline === 0) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'sync',
      payload: event,
    });
  }

  /**
   * Unsubscribe from all sync events.
   * Call this on logout.
   */
  unsubscribe(): void {
    this.stopHeartbeat();
    this.unregisterBrowserListeners();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.currentUserId = null;
    this.deviceId = null;
    this.otherDevicesOnline = 0;
    this.reconnectAttempts = 0;
  }

  /**
   * Handle visibility change - reconnect when app comes back to foreground.
   * Critical for mobile browsers that suspend JS when backgrounded.
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible' && this.currentUserId) {
      const channelState = this.channel?.state;

      // Only reconnect if channel is unhealthy
      if (channelState !== 'joined' && channelState !== 'joining') {
        console.log('[realtime] App became visible with unhealthy channel, reconnecting...');
        this.reconnectAttempts = 0; // Reset so we don't stay in "given up" state
        this.reconnectChannel(this.currentUserId);
      }
    }
  }

  /**
   * Handle online event - reconnect when browser regains network.
   */
  private handleOnline(): void {
    if (this.currentUserId) {
      console.log('[realtime] Browser came online, reconnecting...');
      this.reconnectAttempts = 0;
      this.reconnectChannel(this.currentUserId);
    }
  }

  /**
   * Register browser event listeners for reconnection.
   */
  private registerBrowserListeners(): void {
    if (this.listenersRegistered || typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
    window.addEventListener('online', this.boundHandleOnline);
    this.listenersRegistered = true;
  }

  /**
   * Unregister browser event listeners.
   */
  private unregisterBrowserListeners(): void {
    if (!this.listenersRegistered || typeof document === 'undefined') return;

    document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
    window.removeEventListener('online', this.boundHandleOnline);
    this.listenersRegistered = false;
  }

  /**
   * Start heartbeat to detect silent disconnects.
   */
  private startHeartbeat(userId: string): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const channelState = this.channel?.state;

      if (channelState !== 'joined' && channelState !== 'joining') {
        console.warn(`[realtime] Heartbeat detected unhealthy channel: ${channelState}`);
        this.scheduleReconnect(userId);
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop the heartbeat interval.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  private scheduleReconnect(userId: string): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[realtime] Max reconnection attempts reached, giving up');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s
    const delay = Math.min(
      this.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      this.RECONNECT_MAX_DELAY_MS
    );
    this.reconnectAttempts++;

    console.log(`[realtime] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectChannel(userId);
    }, delay);
  }

  /**
   * Reconnect channel after a disconnect.
   */
  private reconnectChannel(userId: string): void {
    console.log('[realtime] Attempting to reconnect...');

    // Clean up old channel
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.otherDevicesOnline = 0;

    // Re-establish channel
    this.setupChannel(userId);
  }

  /**
   * Set up the broadcast/presence channel.
   */
  private setupChannel(userId: string): void {
    // Unique ID for this browser tab/device
    this.deviceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    this.channel = this.supabase.channel(`${this.channelPrefix}:${userId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: this.deviceId },
      },
    });

    this.channel
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        const event = payload as TEvent;
        this.onEvent(event);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel?.presenceState() ?? {};
        this.otherDevicesOnline = Object.keys(state).filter((key) => key !== this.deviceId).length;
      })
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[realtime] Channel connected');
          this.reconnectAttempts = 0; // Reset on successful connection
          this.startHeartbeat(userId);
          await this.channel?.track({ device_id: this.deviceId });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[realtime] Channel failed:', status, err);
          this.stopHeartbeat();
          this.scheduleReconnect(userId);
        } else if (status === 'CLOSED') {
          console.warn('[realtime] Channel closed, reconnecting...');
          this.stopHeartbeat();
          this.scheduleReconnect(userId);
        }
      });
  }
}

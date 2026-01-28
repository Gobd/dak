import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface TableConfig {
  /** Table name to watch */
  table: string;
  /** Optional filter (e.g., `user_id=eq.${userId}`) - userId placeholder will be replaced */
  filter?: string;
}

export interface RealtimeSyncOptions<TEvent> {
  /** Supabase client instance */
  supabase: SupabaseClient;
  /** Channel prefix (e.g., 'sync:chores', 'sync:health') - userId will be appended */
  channelPrefix: string;
  /** Handler called when sync events are received (broadcast or postgres_changes) */
  onEvent: (event: TEvent | PostgresChangeEvent) => void;
  /** Handler called after reconnection - use to refresh data */
  onReconnect?: () => void;
  /**
   * Tables to watch via postgres_changes (bulletproof, DB-triggered).
   * Only tables with user_id column can be filtered effectively.
   * When a watched table changes, onEvent receives { type: 'postgres_change', table: string }
   */
  tables?: TableConfig[];
}

/** Event emitted when postgres_changes detects a change */
export interface PostgresChangeEvent {
  type: 'postgres_change';
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

// Polling interval as fallback (5 minutes)
const POLLING_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Robust realtime sync manager with automatic reconnection.
 *
 * Features:
 * - postgres_changes for bulletproof DB-triggered notifications
 * - Broadcast for fast cross-device sync
 * - Exponential backoff reconnection (1s → 5 min max, retries indefinitely)
 * - Visibility change handling (reconnects + refreshes when app returns to foreground)
 * - Online event handling (reconnects when browser regains network)
 * - Polling fallback every 5 minutes as insurance
 * - Data refresh on reconnect (catches any missed events)
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
 *   onReconnect: () => {
 *     // Refresh all data after reconnection
 *     refreshItems();
 *     refreshSettings();
 *   },
 *   tables: [
 *     { table: 'items', filter: 'user_id=eq.${userId}' },
 *   ],
 * });
 *
 * // On login
 * sync.subscribe(userId);
 *
 * // On data change (for cross-device notification)
 * await sync.broadcast({ type: 'items' });
 *
 * // On logout
 * sync.unsubscribe();
 * ```
 */
export class RealtimeSync<TEvent> {
  private supabase: SupabaseClient;
  private channelPrefix: string;
  private onEvent: RealtimeSyncOptions<TEvent>['onEvent'];
  private onReconnect?: () => void;
  private tables: TableConfig[];

  private channel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;

  // Reconnection state
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly RECONNECT_BASE_DELAY_MS = 1000;
  private readonly RECONNECT_MAX_DELAY_MS = 300000; // 5 min max

  // Track when app was last visible (for staleness detection)
  private lastVisibleAt: number = Date.now();
  private readonly STALE_THRESHOLD_MS = 60000; // 1 minute

  // Track if browser event listeners are registered
  private listenersRegistered = false;

  // Polling fallback
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  // Bound handlers for event listeners (so we can remove them)
  private boundHandleVisibilityChange: () => void;
  private boundHandleOnline: () => void;

  constructor(options: RealtimeSyncOptions<TEvent>) {
    this.supabase = options.supabase;
    this.channelPrefix = options.channelPrefix;
    this.onEvent = options.onEvent;
    this.onReconnect = options.onReconnect;
    this.tables = options.tables ?? [];

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
    this.stopPolling();

    this.currentUserId = userId;
    this.reconnectAttempts = 0;

    // Register browser event listeners for reconnection
    this.registerBrowserListeners();

    // Set up the channel
    this.setupChannel(userId);

    // Start polling fallback
    this.startPolling();
  }

  /**
   * Broadcast a sync event to other devices.
   */
  async broadcast(event: TEvent): Promise<void> {
    if (!this.channel) return;

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
    this.unregisterBrowserListeners();
    this.stopPolling();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.currentUserId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Handle visibility change - reconnect when app comes back to foreground.
   * Critical for mobile browsers that suspend JS when backgrounded.
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      this.lastVisibleAt = Date.now();
      return;
    }

    if (document.visibilityState === 'visible' && this.currentUserId) {
      const timeInBackground = Date.now() - this.lastVisibleAt;
      const isStale = timeInBackground > this.STALE_THRESHOLD_MS;
      const channelState = this.channel?.state;
      const isUnhealthy = channelState !== 'joined' && channelState !== 'joining';

      if (isStale || isUnhealthy) {
        console.log(
          `[realtime] Visible after ${Math.round(timeInBackground / 1000)}s, ` +
            `channel=${channelState}, reconnecting...`,
        );
        this.reconnectAttempts = 0;
        this.reconnectChannel(this.currentUserId);
      } else {
        // Even if channel looks healthy, refresh data after being hidden
        // (browser may have throttled the tab and missed events)
        this.onReconnect?.();
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
   * Start polling fallback - refreshes data every 5 minutes as insurance.
   */
  private startPolling(): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(() => {
      this.onReconnect?.();
    }, POLLING_INTERVAL_MS);
  }

  /**
   * Stop polling fallback.
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   * Never gives up - keeps trying at max interval (5 min) indefinitely.
   */
  private scheduleReconnect(userId: string): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(
      this.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      this.RECONNECT_MAX_DELAY_MS,
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
    console.log('[realtime] Reconnecting...');

    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.setupChannel(userId);
  }

  /**
   * Set up the realtime channel with postgres_changes + broadcast.
   */
  private setupChannel(userId: string): void {
    this.channel = this.supabase.channel(`${this.channelPrefix}:${userId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    // Set up postgres_changes listeners for configured tables
    for (const tableConfig of this.tables) {
      const filter = tableConfig.filter?.replace('${userId}', userId);

      this.channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableConfig.table,
          ...(filter && { filter }),
        },
        (payload) => {
          console.log(`[realtime] postgres_changes on ${tableConfig.table}:`, payload.eventType);
          this.onEvent({
            type: 'postgres_change',
            table: tableConfig.table,
            eventType: payload.eventType,
          } as PostgresChangeEvent);
        },
      );
    }

    // Listen to broadcast for cross-device sync
    this.channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
      const event = payload as TEvent;
      console.log('[realtime] broadcast received');
      this.onEvent(event);
    });

    this.channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[realtime] Channel connected');
        this.reconnectAttempts = 0;
        // Refresh data on successful reconnect (may have missed events)
        this.onReconnect?.();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[realtime] Channel error:', status, err);
        this.scheduleReconnect(this.currentUserId!);
      } else if (status === 'CLOSED') {
        console.warn('[realtime] Channel closed');
        this.scheduleReconnect(this.currentUserId!);
      }
    });
  }
}

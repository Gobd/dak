import { create } from 'zustand';
import { getRelayUrl } from './config-store';

export interface DueNotification {
  id: number;
  type: string;
  name: string;
  due_date: string;
  data: Record<string, unknown> | null;
  is_overdue: boolean;
  is_today: boolean;
  is_tomorrow: boolean;
}

export interface TypePreference {
  type: string;
  enabled: boolean;
  first_seen: string;
  is_known: boolean;
}

interface NotificationsState {
  notifications: DueNotification[];
  isOpen: boolean;
  typePreferences: TypePreference[];
  unconfiguredCount: number;
  showPreferences: boolean;

  // Actions
  setNotifications: (notifications: DueNotification[]) => void;
  addNotifications: (notifications: DueNotification[]) => void;
  removeNotification: (id: number) => void;
  setOpen: (open: boolean) => void;
  setShowPreferences: (show: boolean) => void;

  // API calls
  fetchDue: () => Promise<void>;
  fetchPreferences: () => Promise<void>;
  setTypeEnabled: (type: string, enabled: boolean) => Promise<void>;
  dismiss: (id: number, hours: number, permanent?: boolean) => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  isOpen: false,
  typePreferences: [],
  unconfiguredCount: 0,
  showPreferences: false,

  setNotifications: (notifications) => {
    set({ notifications });
    // Auto-open if there are notifications
    if (notifications.length > 0) {
      set({ isOpen: true });
    }
  },

  addNotifications: (newNotifications) => {
    const current = get().notifications;
    // Only add notifications that aren't already shown
    const toAdd = newNotifications.filter((n) => !current.some((c) => c.id === n.id));
    if (toAdd.length > 0) {
      set({ notifications: [...current, ...toAdd], isOpen: true });
    }
  },

  removeNotification: (id) => {
    const remaining = get().notifications.filter((n) => n.id !== id);
    set({ notifications: remaining });
    // Auto-close if no notifications left
    if (remaining.length === 0) {
      set({ isOpen: false });
    }
  },

  setOpen: (open) => set({ isOpen: open }),
  setShowPreferences: (show) => set({ showPreferences: show }),

  fetchDue: async () => {
    try {
      const res = await fetch(`${getRelayUrl()}/notifications/due`);
      if (res.ok) {
        const data = (await res.json()) as DueNotification[];
        get().setNotifications(data);
      }
    } catch {
      // Relay not available
    }
  },

  fetchPreferences: async () => {
    try {
      const res = await fetch(`${getRelayUrl()}/notifications/preferences`);
      if (res.ok) {
        const data = (await res.json()) as {
          types: TypePreference[];
          unconfigured_count: number;
        };
        set({
          typePreferences: data.types,
          unconfiguredCount: data.unconfigured_count,
        });
      }
    } catch {
      // Relay not available
    }
  },

  setTypeEnabled: async (type, enabled) => {
    try {
      const res = await fetch(
        `${getRelayUrl()}/notifications/preferences/${encodeURIComponent(type)}?enabled=${enabled}`,
        { method: 'POST' },
      );
      if (res.ok) {
        // Refresh preferences and due notifications
        get().fetchPreferences();
        get().fetchDue();
      }
    } catch {
      // Ignore errors
    }
  },

  dismiss: async (id, hours, permanent = false) => {
    try {
      let body: Record<string, unknown>;
      if (permanent) {
        body = { permanent: true };
      } else if (hours === -1) {
        body = { until_midnight: true };
      } else {
        body = { hours };
      }

      const res = await fetch(`${getRelayUrl()}/notifications/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        get().removeNotification(id);
      }
    } catch {
      // Still remove from local state
      get().removeNotification(id);
    }
  },
}));

// Expose notify function for iframed apps
if (typeof window !== 'undefined') {
  (window as Window & { notify?: (data: unknown) => void }).notify = async (data: unknown) => {
    const payload = data as { type?: string; name?: string; due?: string; data?: unknown };
    if (!payload.type || !payload.name || !payload.due) {
      console.warn('notify: type, name, and due are required');
      return;
    }
    try {
      await fetch(`${getRelayUrl()}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('Notification registered:', payload);
    } catch (err) {
      console.warn('Failed to register notification:', err);
    }
  };
}

import { create } from 'zustand';
import {
  getDueNotificationsDueGet,
  getPreferencesNotificationsPreferencesGet,
  setPreferenceNotificationsPreferencesEventTypePost,
  deletePreferenceNotificationsPreferencesEventTypeDelete,
  dismissEventNotificationsEventIdDismissPost,
  addEventNotificationsPost,
  type DueNotification,
} from '@dak/api-client';
import { getRelayUrl } from './config-store';

export type { DueNotification };

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
  deleteType: (type: string) => Promise<void>;
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
      const { data } = await getDueNotificationsDueGet({ baseUrl: getRelayUrl() });
      if (Array.isArray(data)) {
        get().setNotifications(data);
      }
    } catch {
      // Relay not available
    }
  },

  fetchPreferences: async () => {
    try {
      const { data } = await getPreferencesNotificationsPreferencesGet({ baseUrl: getRelayUrl() });
      if (data) {
        const prefs = data as { types: TypePreference[]; unconfigured_count: number };
        set({
          typePreferences: prefs.types,
          unconfiguredCount: prefs.unconfigured_count,
        });
      }
    } catch {
      // Relay not available
    }
  },

  setTypeEnabled: async (type, enabled) => {
    try {
      const { response } = await setPreferenceNotificationsPreferencesEventTypePost({
        baseUrl: getRelayUrl(),
        path: { event_type: type },
        query: { enabled },
      });
      if (response.ok) {
        // Refresh preferences and due notifications
        get().fetchPreferences();
        get().fetchDue();
      }
    } catch {
      // Ignore errors
    }
  },

  deleteType: async (type) => {
    try {
      const { response } = await deletePreferenceNotificationsPreferencesEventTypeDelete({
        baseUrl: getRelayUrl(),
        path: { event_type: type },
      });
      if (response.ok) {
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
      const body = permanent
        ? { permanent: true }
        : hours === -1
          ? { until_midnight: true }
          : { hours };

      const { response } = await dismissEventNotificationsEventIdDismissPost({
        baseUrl: getRelayUrl(),
        path: { event_id: id },
        body,
      });
      if (response.ok) {
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
      await addEventNotificationsPost({
        baseUrl: getRelayUrl(),
        body: {
          type: payload.type,
          name: payload.name,
          due: payload.due,
          data: payload.data as Record<string, unknown> | null,
        },
      });
      console.log('Notification registered:', payload);
    } catch (err) {
      console.warn('Failed to register notification:', err);
    }
  };
}

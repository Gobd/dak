import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type SyncEvent =
  | { type: "shots" }
  | { type: "medicine" }
  | { type: "prn" }
  | { type: "people" }
  | { type: "sharing" };

type SyncHandler = (event: SyncEvent) => void;

let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let deviceId: string | null = null;
const handlers = new Set<SyncHandler>();

// Track how many devices are connected (via presence)
let otherDevicesOnline = 0;

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

  if (channel) {
    supabase.removeChannel(channel);
  }

  currentUserId = userId;
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
    .on("broadcast", { event: "sync" }, ({ payload }) => {
      const event = payload as SyncEvent;
      handlers.forEach((handler) => handler(event));
    })
    .on("presence", { event: "sync" }, () => {
      // Count other devices (exclude our own deviceId)
      const state = channel?.presenceState() ?? {};
      otherDevicesOnline = Object.keys(state).filter(
        (key) => key !== deviceId,
      ).length;
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel?.track({ device_id: deviceId });
      }
    });

  return () => {
    handlers.delete(onEvent);
    if (handlers.size === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
      currentUserId = null;
      deviceId = null;
      otherDevicesOnline = 0;
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
    type: "broadcast",
    event: "sync",
    payload: event,
  });
}

/**
 * Cleanup on logout
 */
export function unsubscribeFromSync() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  currentUserId = null;
  deviceId = null;
  otherDevicesOnline = 0;
  handlers.clear();
}

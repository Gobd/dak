# Realtime Ping-Pong Heartbeat

## Current Approach

The current heartbeat checks local channel state every 30 seconds:

```typescript
if (channelState !== 'joined' && channelState !== 'joining') {
  scheduleReconnect(userId);
}
```

**Limitation:** Silent disconnects (where TCP dies without notification) leave the state as `'joined'` even though the connection is dead.

## Ping-Pong Approach

A more robust heartbeat actually sends a message and verifies it succeeds:

```typescript
function startHeartbeat(userId: string) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(async () => {
    if (!presenceChannel || presenceChannel.state !== 'joined') {
      console.warn('[realtime] Heartbeat: channel not joined, reconnecting');
      scheduleReconnect(userId);
      return;
    }

    // Actually send something and check if it works
    const result = await presenceChannel.track({
      user_id: userId,
      ts: Date.now()
    });

    if (result !== 'ok') {
      console.warn('[realtime] Heartbeat: track failed, reconnecting');
      scheduleReconnect(userId);
    }
  }, HEARTBEAT_INTERVAL_MS);
}
```

## Cost

- ~2 messages per minute (track call + ack)
- ~86,400 messages/month per always-on client
- Supabase free tier: 2 million messages/month
- Cost is negligible unless you have many concurrent users

## When to Add This

Consider adding ping-pong if:
- Realtime still stops working after deploying the current fixes
- You see no console warnings when it stops (indicates silent disconnect)
- Running on devices that sleep/wake frequently or have unstable networks

## Architecture Note

- `notes-app` uses two channels (userChannel + presenceChannel) due to its sharing model
- `health-tracker` and `family-chores` use a single channel with presence built-in
- If adding ping-pong to notes-app, do it on presenceChannel since it's global

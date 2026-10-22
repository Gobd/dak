import type { VoiceDecision, VoiceState } from '../shared/voice.ts';

interface Call {
  expiresAt: number;
  replies: number;
  playback: boolean;
}

// Only active calls are retained. Ambient transcripts are never stored.
export function createVoiceGate(timeoutSeconds = 10, now = Date.now) {
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600)
    throw new Error('REX_VOICE_IDLE_SECONDS must be between 1 and 3600.');
  const calls = new Map<string, Call>();
  const timeout = timeoutSeconds * 1000;
  function current(id: string) {
    const call = calls.get(id);
    if (call && !call.replies && call.expiresAt <= now()) {
      calls.delete(id);
      return undefined;
    }
    return call;
  }
  function state(id: string): VoiceState {
    const call = current(id);
    return {
      active: !!call,
      expiresAt: call ? (call.replies || call.playback ? null : call.expiresAt) : null,
      timeoutSeconds,
    };
  }
  function end(id: string) {
    calls.delete(id);
    return state(id);
  }
  function consume(id: string, transcript: string): VoiceDecision {
    let call = current(id);
    let message = transcript.trim();
    // Controls must address Rex at the start of the utterance, not appear in a quote later.
    const wake = /^hey[\s,]+rex\b[\s,.:;!?-]*/i.exec(message);
    if (wake) {
      if (!call) {
        for (const key of calls.keys()) current(key);
        if (calls.size >= 256) throw new Error('Too many active voice calls.');
        call = { expiresAt: now() + timeout, replies: 0, playback: false };
        calls.set(id, call);
      }
      message = message.slice(wake[0].length).trim();
    }
    if (/^(?:thanks|thank you)[\s,]+rex\b[\s,.:;!?-]*/i.test(message)) return end(id);
    if (!call) return state(id);
    call.expiresAt = now() + timeout;
    return { ...state(id), ...(message ? { message } : {}) };
  }
  function hold(id: string) {
    const call = current(id);
    if (!call) return undefined;
    call.replies++;
    return () => {
      if (calls.get(id) !== call) return;
      call.replies--;
      call.expiresAt = now() + timeout;
    };
  }
  function playback(id: string, speaking: boolean) {
    const call = current(id);
    if (call) {
      call.playback = speaking;
      // A disappeared browser cannot leave a playback hold active forever.
      call.expiresAt = now() + (speaking ? 180000 : timeout);
    }
    return state(id);
  }
  return { state, consume, end, hold, playback };
}

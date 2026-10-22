export interface VoiceState {
  active: boolean;
  expiresAt: number | null;
  timeoutSeconds: number;
}

export interface VoiceDecision extends VoiceState {
  message?: string;
}

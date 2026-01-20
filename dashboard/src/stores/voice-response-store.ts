/**
 * Store for managing voice response display (toast/modal).
 * Used by PTT widget and wake word SSE listener to show responses.
 */

import { create } from 'zustand';

interface VoiceResponse {
  id: string;
  text: string;
  command?: string;
}

interface VoiceResponseStore {
  response: VoiceResponse | null;
  showResponse: (text: string, command?: string) => void;
  clearResponse: () => void;
}

export const useVoiceResponseStore = create<VoiceResponseStore>((set) => ({
  response: null,

  showResponse: (text: string, command?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set({ response: { id, text, command } });
  },

  clearResponse: () => {
    set({ response: null });
  },
}));

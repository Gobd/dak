/**
 * Toast component for displaying voice command responses.
 * Auto-dismisses after a few seconds.
 */

import { useEffect, useRef } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@dak/ui';
import { useVoiceResponseStore } from '../../stores/voice-response-store';
import { useConfigStore } from '../../stores/config-store';

const AUTO_DISMISS_MS = 5000;

export function VoiceResponseToast() {
  const response = useVoiceResponseStore((s) => s.response);
  const clearResponse = useVoiceResponseStore((s) => s.clearResponse);
  const globalSettings = useConfigStore((s) => s.globalSettings);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const responseMode = globalSettings?.voiceResponseMode ?? 'both';
  const showModal = responseMode === 'modal' || responseMode === 'both';

  // Auto-dismiss timer
  useEffect(() => {
    if (response && showModal) {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      // Set new timer
      timerRef.current = setTimeout(() => {
        clearResponse();
      }, AUTO_DISMISS_MS);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [response, showModal, clearResponse]);

  if (!response || !showModal) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-surface-raised text-text rounded-xl shadow-2xl px-5 py-4 max-w-md flex items-start gap-3 border border-border">
        <MessageCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {response.command && (
            <p className="text-xs text-text-muted mb-1 uppercase tracking-wide">
              {response.command.replace(/_/g, ' ')}
            </p>
          )}
          <p className="text-sm leading-relaxed">{response.text}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clearResponse}
          className="text-text-muted flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Voice command relay - receives commands from home-relay via SSE
 * and forwards them to the notes-app iframe via postMessage.
 */

import { useEffect, useRef, useCallback } from 'react';
import { getRelayUrl } from '../stores/config-store';
import { useVoiceResponseStore } from '../stores/voice-response-store';

// Target origins for postMessage (notes-app URLs)
const NOTES_APP_ORIGINS = [
  'http://localhost:8081', // Local dev
  'https://dak.bkemper.me', // Prod
];

function findNotesAppIframe(): HTMLIFrameElement | null {
  // Find iframe with notes-app in src
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    if (iframe.src.includes('notes-app') || iframe.src.includes('localhost:8081')) {
      return iframe;
    }
  }
  return null;
}

interface VoiceCommand {
  type: string;
  [key: string]: unknown;
}

export function useVoiceCommandRelay() {
  const showResponse = useVoiceResponseStore((s) => s.showResponse);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const handleCommand = useCallback(
    (command: VoiceCommand) => {
      console.log('[voice-relay] Received command:', command);

      // Voice result - show in modal
      if (command.type === 'voice-result') {
        const text = command.text as string;
        const cmdName = command.command as string | undefined;
        if (text) {
          showResponse(text, cmdName);
        }
        return;
      }

      // Timer commands are handled by the Timer widget
      if (
        command.type === 'timer' ||
        command.type === 'stop-timer' ||
        command.type === 'adjust-timer'
      ) {
        window.dispatchEvent(new CustomEvent('voice-timer', { detail: command }));
        return;
      }

      // List commands go to notes-app iframe
      if (command.type === 'add-to-list') {
        const iframe = findNotesAppIframe();
        if (!iframe?.contentWindow) {
          console.log('[voice-relay] Notes app iframe not found');
          return;
        }

        // Try each origin (we don't know which one the iframe is using)
        for (const origin of NOTES_APP_ORIGINS) {
          try {
            iframe.contentWindow.postMessage(command, origin);
          } catch {
            // Origin mismatch, try next
          }
        }
        console.log('[voice-relay] Forwarded command to notes-app');
      }
    },
    [showResponse]
  );

  useEffect(() => {
    const relayUrl = getRelayUrl();

    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const url = `${relayUrl}/voice/subscribe`;
      console.log('[voice-relay] Connecting to', url);

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[voice-relay] Connected');
        retryCountRef.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const command = JSON.parse(event.data) as VoiceCommand;
          handleCommand(command);
        } catch (err) {
          console.error('[voice-relay] Failed to parse command:', err);
        }
      };

      es.onerror = () => {
        console.log('[voice-relay] Disconnected, will retry...');
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff
        retryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 30000);
        retryTimeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [handleCommand]);
}

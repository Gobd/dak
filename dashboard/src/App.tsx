import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMediaQuery, useKeyPress } from '@dak/hooks';
import { useConfigStore } from './stores/config-store';
import { useVoiceCommandRelay } from './hooks/useVoiceCommandRelay';
import { Screen } from './components/layout/Screen';
import { VoiceResponseToast } from './components/shared/VoiceResponseToast';
import { MqttModal } from './components/shared/MqttModal';
import { NotificationToast } from './components/shared/NotificationToast';

// Initialize notifications store (exposes window.notify for iframed apps)
import './stores/notifications-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const globalSettings = useConfigStore((s) => s.globalSettings);
  const setDark = useConfigStore((s) => s.setDark);
  const updateGlobalSettings = useConfigStore((s) => s.updateGlobalSettings);

  const theme = globalSettings?.theme ?? 'dark';
  const hideCursor = globalSettings?.hideCursor ?? false;

  // System theme detection
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  // Relay voice commands from home-relay to notes-app iframe
  useVoiceCommandRelay();

  // Apply dark mode to document based on theme setting
  useEffect(() => {
    const isDark = theme === 'system' ? prefersDark : theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    setDark(isDark);
  }, [theme, prefersDark, setDark]);

  // Apply cursor hiding for kiosk mode
  useEffect(() => {
    document.documentElement.classList.toggle('hide-cursor', hideCursor);
  }, [hideCursor]);

  // Keyboard shortcut: Ctrl+Shift+H to toggle cursor hiding
  useKeyPress('H', () => updateGlobalSettings({ hideCursor: !hideCursor }), {
    ctrl: true,
    shift: true,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Screen />
      <VoiceResponseToast />
      <MqttModal />
      <NotificationToast />
    </QueryClientProvider>
  );
}

export default App;

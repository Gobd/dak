import { useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConfigStore } from './stores/config-store';
import { useVoiceCommandRelay } from './hooks/useVoiceCommandRelay';
import { Screen } from './components/layout/Screen';
import { VoiceResponseToast } from './components/shared/VoiceResponseToast';

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

  const theme = globalSettings?.theme ?? 'dark';
  const hideCursor = globalSettings?.hideCursor ?? false;

  // Relay voice commands from home-relay to notes-app iframe
  useVoiceCommandRelay();

  // Apply dark mode to document based on theme setting
  useEffect(() => {
    function applyTheme(isDark: boolean) {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);
      setDark(mediaQuery.matches);

      function handleChange(e: MediaQueryListEvent) {
        applyTheme(e.matches);
        setDark(e.matches);
      }

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      const isDark = theme === 'dark';
      applyTheme(isDark);
      setDark(isDark);
    }
  }, [theme, setDark]);

  // Apply cursor hiding for kiosk mode
  useEffect(() => {
    if (hideCursor) {
      document.documentElement.classList.add('hide-cursor');
    } else {
      document.documentElement.classList.remove('hide-cursor');
    }
  }, [hideCursor]);

  // Keyboard shortcut: Ctrl+Shift+H to toggle cursor hiding
  const updateGlobalSettings = useConfigStore((s) => s.updateGlobalSettings);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        updateGlobalSettings({ hideCursor: !hideCursor });
      }
    },
    [hideCursor, updateGlobalSettings],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <QueryClientProvider client={queryClient}>
      <Screen />
      <VoiceResponseToast />
    </QueryClientProvider>
  );
}

export default App;

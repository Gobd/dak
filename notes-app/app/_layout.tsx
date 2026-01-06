import '../global.css';

import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, router, useSegments, useRootNavigationState } from 'expo-router';
import { preventAutoHideAsync, hideAsync } from 'expo-splash-screen';
import { Platform } from 'react-native';

// Only import reanimated on native - not needed on web and saves ~28% bundle size
if (Platform.OS !== 'web') {
  require('react-native-reanimated');
}

import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ToastContainer } from '@/components/ui/toast';

export { ErrorBoundary } from 'expo-router';

preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const { session, isInitialized, initialize } = useAuthStore();
  const { theme } = useThemeStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle font loading error
  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  // Hide splash screen when ready
  useEffect(() => {
    if (fontsLoaded && isInitialized) {
      hideAsync();
    }
  }, [fontsLoaded, isInitialized]);

  // Set body styles for web (background color + prevent window scroll for virtual keyboard)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const bgColor = theme === 'dark' ? '#09090b' : '#ffffff';
      document.body.style.backgroundColor = bgColor;
      document.documentElement.style.backgroundColor = bgColor;
      // Prevent window-level scrolling - let flex containers handle their own scroll
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.height = '100%';
      document.documentElement.style.height = '100%';
      // Add dark class for CSS selectors (scrollbar styling, etc.)
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  // Handle auth state routing
  useEffect(() => {
    if (!isInitialized || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inMainGroup = segments[0] === '(main)';
    const currentRoute = segments.join('/');

    // Allow set-password and reset-password even when authenticated
    // (user just verified email or clicked reset link)
    const isPasswordRoute =
      currentRoute.includes('set-password') || currentRoute.includes('reset-password');

    if (session && inAuthGroup && !isPasswordRoute) {
      // User is signed in but on auth screen (not password screens), redirect to main
      router.replace('/(main)');
    } else if (!session && inMainGroup) {
      // User is not signed in but on main screen, redirect to login
      router.replace('/(auth)/login');
    } else if (!session && !inAuthGroup) {
      // User is not signed in and not on auth screen, redirect to login
      router.replace('/(auth)/login');
    }
  }, [session, segments, isInitialized, navigationState?.key]);

  // Show loading while initializing
  if (!fontsLoaded || !isInitialized) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Slot />
      <ToastContainer />
    </ThemeProvider>
  );
}

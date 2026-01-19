import { Stack } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVoiceCommands } from '@/hooks/useVoiceCommands';

export default function MainLayout() {
  const colors = useThemeColors();

  // Listen for voice commands from dashboard via postMessage
  useVoiceCommands();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="trash" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="about" />
    </Stack>
  );
}

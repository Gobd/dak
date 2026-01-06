import { useThemeStore } from '@/stores/theme-store';

export interface ThemeColors {
  // Backgrounds
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgSelected: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;

  // Borders
  border: string;
  borderLight: string;

  // Icons
  icon: string;
  iconMuted: string;

  // Input
  inputBg: string;
  inputText: string;
  inputPlaceholder: string;

  // Primary accent
  primary: string;
  primaryText: string;

  // Status colors (same in both themes)
  success: string;
  error: string;
  warning: string;
  info: string;

  // Search
  searchHighlight: string;
}

const darkColors: ThemeColors = {
  // Backgrounds
  bg: '#000000',
  bgSecondary: '#18181b', // zinc-900
  bgTertiary: '#27272a', // zinc-800
  bgHover: '#3f3f46', // zinc-700
  bgSelected: '#27272a', // zinc-800

  // Text
  text: '#ffffff',
  textSecondary: '#e4e4e7', // zinc-200
  textTertiary: '#a1a1aa', // zinc-400
  textMuted: '#71717a', // zinc-500

  // Borders
  border: '#27272a', // zinc-800
  borderLight: '#3f3f46', // zinc-700

  // Icons
  icon: '#a1a1aa', // zinc-400
  iconMuted: '#71717a', // zinc-500

  // Input
  inputBg: '#27272a', // zinc-800
  inputText: '#ffffff',
  inputPlaceholder: '#71717a', // zinc-500

  // Primary accent (amber/yellow)
  primary: '#fbbf24', // amber-400
  primaryText: '#000000',

  // Status
  success: '#22c55e', // green-500
  error: '#ef4444', // red-500
  warning: '#f97316', // orange-500
  info: '#3b82f6', // blue-500

  // Search
  searchHighlight: '#fef08a', // yellow-200
};

const lightColors: ThemeColors = {
  // Backgrounds
  bg: '#ffffff',
  bgSecondary: '#f4f4f5', // zinc-100
  bgTertiary: '#e4e4e7', // zinc-200
  bgHover: '#d4d4d8', // zinc-300
  bgSelected: '#e4e4e7', // zinc-200

  // Text
  text: '#09090b', // zinc-950
  textSecondary: '#27272a', // zinc-800
  textTertiary: '#52525b', // zinc-600
  textMuted: '#71717a', // zinc-500

  // Borders
  border: '#e4e4e7', // zinc-200
  borderLight: '#d4d4d8', // zinc-300

  // Icons
  icon: '#52525b', // zinc-600
  iconMuted: '#71717a', // zinc-500

  // Input
  inputBg: '#f4f4f5', // zinc-100
  inputText: '#09090b', // zinc-950
  inputPlaceholder: '#a1a1aa', // zinc-400

  // Primary accent (amber - slightly darker for light mode)
  primary: '#f59e0b', // amber-500
  primaryText: '#000000',

  // Status (same)
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f97316',
  info: '#3b82f6', // blue-500

  // Search
  searchHighlight: '#fef08a', // yellow-200
};

export function useThemeColors(): ThemeColors {
  const { theme } = useThemeStore();
  return theme === 'dark' ? darkColors : lightColors;
}

// For components that need raw theme value
export function useTheme() {
  const { theme, toggleTheme, setTheme } = useThemeStore();
  return { theme, toggleTheme, setTheme, isDark: theme === 'dark' };
}

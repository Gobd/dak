import { Login as SharedLogin } from '@dak/ui';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';

export function Login() {
  return (
    <SharedLogin
      appName="Health Tracker"
      useAuthStore={useAuthStore}
      useThemeStore={useThemeStore}
    />
  );
}

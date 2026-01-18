import { ForgotPassword as SharedForgotPassword } from '@dak/ui';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';

export function ForgotPassword() {
  return (
    <SharedForgotPassword
      appName="Health Tracker"
      useAuthStore={useAuthStore}
      useThemeStore={useThemeStore}
    />
  );
}

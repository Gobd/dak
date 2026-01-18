import { ResetPassword as SharedResetPassword } from '@dak/ui';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';

export function ResetPassword() {
  return (
    <SharedResetPassword
      appName="Health Tracker"
      useAuthStore={useAuthStore}
      useThemeStore={useThemeStore}
    />
  );
}

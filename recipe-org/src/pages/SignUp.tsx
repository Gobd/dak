import { SignUp as SharedSignUp } from '@dak/ui';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';

export function SignUp() {
  return (
    <SharedSignUp
      appName="Recipe Organizer"
      useAuthStore={useAuthStore}
      useThemeStore={useThemeStore}
    />
  );
}

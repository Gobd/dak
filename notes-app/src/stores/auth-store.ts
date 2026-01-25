import { createAuthStore } from '@dak/ui';
import { supabase } from '../lib/supabase';
import { unsubscribeFromSync } from '../lib/realtime';

export const useAuthStore = createAuthStore({
  supabase,
  onSignOut: unsubscribeFromSync,
  basePath: '/notes-app',
});

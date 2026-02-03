import { createAuthStore } from '@dak/ui';
import { supabase } from '../lib/supabase';

export const useAuthStore = createAuthStore({
  supabase,
  basePath: '/recipe-org',
});

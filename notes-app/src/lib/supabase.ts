import { createSupabaseClient } from '@dak/ui';

export const supabase = createSupabaseClient({ pkce: true });

import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';

interface CreateSupabaseClientOptions {
  /** Enable PKCE auth flow (recommended for public clients) */
  pkce?: boolean;
}

/**
 * Create a Supabase client with standard configuration.
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from environment.
 *
 * @example
 * // Basic usage
 * export const supabase = createSupabaseClient();
 *
 * @example
 * // With PKCE auth flow
 * export const supabase = createSupabaseClient({ pkce: true });
 */
export function createSupabaseClient(options?: CreateSupabaseClientOptions): SupabaseClient {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)',
    );
  }

  const clientOptions: SupabaseClientOptions<'public'> = {};

  if (options?.pkce) {
    clientOptions.auth = {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    };
  }

  return createClient(supabaseUrl, supabaseAnonKey, clientOptions);
}

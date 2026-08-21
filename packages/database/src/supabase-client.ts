import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseBrowserEnv } from './env';

export function createBrowserSupabaseClient(env: Record<string, unknown>): SupabaseClient {
  const parsed = parseBrowserEnv(env);

  if (!parsed.VITE_SUPABASE_URL || !parsed.VITE_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase browser client cannot be created without DEV connection variables.');
  }

  return createClient(parsed.VITE_SUPABASE_URL, parsed.VITE_SUPABASE_PUBLISHABLE_KEY);
}

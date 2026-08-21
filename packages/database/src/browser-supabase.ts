import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from './supabase-client';

let browserClient: SupabaseClient | undefined;

/**
 * Returns one browser Supabase client so Auth and repositories share the same session.
 */
export function getBrowserSupabaseClient(
  env: Record<string, unknown>,
): SupabaseClient {
  browserClient ??= createBrowserSupabaseClient(env);
  return browserClient;
}

export function resetBrowserSupabaseClientForTests(): void {
  browserClient = undefined;
}

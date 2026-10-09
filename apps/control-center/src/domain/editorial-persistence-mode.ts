export function editorialDevSyncEnabled(env: Record<string, unknown>): boolean {
  const url = env.VITE_SUPABASE_URL;
  const isDevProject =
    typeof url === 'string' &&
    url.replace(/\/$/, '') === 'https://vnmkupzptujtywnnabkp.supabase.co';

  return env.VITE_EDITORIAL_DEV_SYNC_ENABLED === 'true'
    && env.VITE_PRODUCT_READ_SOURCE === 'supabase'
    && isDevProject;
}

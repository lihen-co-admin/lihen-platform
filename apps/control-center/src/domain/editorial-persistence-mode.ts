export function editorialDevSyncEnabled(env: Record<string, unknown>): boolean {
  return env.DEV === true && env.VITE_EDITORIAL_DEV_SYNC_ENABLED === 'true';
}

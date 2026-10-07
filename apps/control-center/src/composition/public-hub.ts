import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';
import { GetPublicHubBlocksHandler, ReorderPublicHubBlocksHandler, SavePublicHubBlockHandler, SetPublicHubBlockStatusHandler, SupabasePublicHubRepository, type PublicHubRepository } from '@lihen/public-hub';

export function createPublicHubComposition(raw: Record<string, unknown> = import.meta.env, clientFactory = () => getBrowserSupabaseClient(raw)) {
  const env = parseBrowserEnv(raw);
  const enabled = env.VITE_PUBLIC_HUB_MODE === 'controlled' && env.VITE_AUTH_MODE === 'supabase' && env.VITE_PRODUCT_READ_SOURCE === 'supabase';
  function getRepository() {
    if (!enabled) throw new Error('Hub bloqueado: requiere controlled, fuente Supabase y autenticación Supabase.');
    return new SupabasePublicHubRepository(clientFactory(), true);
  }
  const repository: PublicHubRepository = {
    listAdminBlocks: async () => getRepository().listAdminBlocks(),
    saveBlock: async (draft, key) => getRepository().saveBlock(draft, key),
    setStatus: async (id, status, key) => getRepository().setStatus(id, status, key),
    reorder: async (ids, key) => getRepository().reorder(ids, key),
  };
  return { enabled, getBlocks: new GetPublicHubBlocksHandler(repository), saveBlock: new SavePublicHubBlockHandler(repository), setStatus: new SetPublicHubBlockStatusHandler(repository), reorder: new ReorderPublicHubBlocksHandler(repository) };
}
export const publicHubComposition = createPublicHubComposition();

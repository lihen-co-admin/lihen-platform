import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';
import { GetPublicHubBlocksHandler, ReorderPublicHubBlocksHandler, SavePublicHubBlockHandler, SetPublicHubBlockStatusHandler, SupabasePublicHubRepository } from '@lihen/public-hub';
const env=parseBrowserEnv(import.meta.env); const enabled=env.VITE_PUBLIC_HUB_MODE==='controlled';
const repository=new SupabasePublicHubRepository(getBrowserSupabaseClient(import.meta.env),enabled);
export const publicHubComposition={enabled,getBlocks:new GetPublicHubBlocksHandler(repository),saveBlock:new SavePublicHubBlockHandler(repository),setStatus:new SetPublicHubBlockStatusHandler(repository),reorder:new ReorderPublicHubBlocksHandler(repository)};

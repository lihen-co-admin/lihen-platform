import type { PublicHubBlockDraft, PublicHubBlockProps, PublicHubBlockStatus } from '../domain/public-hub-block';

export interface PublicHubRepository {
  listAdminBlocks(): Promise<readonly PublicHubBlockProps[]>;
  saveBlock(draft: PublicHubBlockDraft, operationKey: string): Promise<string>;
  setStatus(id: string, status: PublicHubBlockStatus, operationKey: string): Promise<void>;
  reorder(ids: readonly string[], operationKey: string): Promise<void>;
}

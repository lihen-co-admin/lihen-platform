import type { PublicHubBlockProps } from '../../domain/public-hub-block';
import type { PublicHubRepository } from '../../ports/public-hub-repository';

export class GetPublicHubBlocksHandler {
  constructor(private readonly repository: PublicHubRepository) {}

  execute(): Promise<readonly PublicHubBlockProps[]> {
    return this.repository.listAdminBlocks();
  }
}

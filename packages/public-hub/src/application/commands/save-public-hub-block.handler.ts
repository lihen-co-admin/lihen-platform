import { validatePublicHubBlockDraft, type PublicHubBlockDraft } from '../../domain/public-hub-block';
import type { PublicHubRepository } from '../../ports/public-hub-repository';

export class SavePublicHubBlockHandler {
  constructor(private readonly repository: PublicHubRepository) {}

  execute(draft: PublicHubBlockDraft, operationKey: string): Promise<string> {
    validatePublicHubBlockDraft(draft);
    if (!operationKey.trim()) throw new Error('La operación necesita una clave de auditoría.');
    return this.repository.saveBlock(draft, operationKey);
  }
}

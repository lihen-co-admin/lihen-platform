import { publicHubBlockStatuses, type PublicHubBlockStatus } from '../../domain/public-hub-block';
import type { PublicHubRepository } from '../../ports/public-hub-repository';

export class SetPublicHubBlockStatusHandler {
  constructor(private readonly repository: PublicHubRepository) {}

  execute(id: string, status: PublicHubBlockStatus, operationKey: string): Promise<void> {
    if (!id.trim()) throw new Error('Bloque requerido.');
    if (!publicHubBlockStatuses.includes(status)) throw new Error('Estado no soportado.');
    if (!operationKey.trim()) throw new Error('La operación necesita una clave de auditoría.');
    return this.repository.setStatus(id, status, operationKey);
  }
}

import type { PublicHubRepository } from '../../ports/public-hub-repository';

export class ReorderPublicHubBlocksHandler {
  constructor(private readonly repository: PublicHubRepository) {}

  execute(ids: readonly string[], operationKey: string): Promise<void> {
    if (ids.length < 1) throw new Error('Se necesita al menos un bloque para ordenar.');
    if (new Set(ids).size !== ids.length) throw new Error('El orden no puede contener bloques duplicados.');
    if (!operationKey.trim()) throw new Error('La operación necesita una clave de auditoría.');
    return this.repository.reorder(ids, operationKey);
  }
}

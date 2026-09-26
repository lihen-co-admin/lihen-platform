import {
  resolvePublicationReconciliation,
  type PublicationReconciliationResolution,
} from '../../domain/publication-reconciliation-resolution';
import type {
  ResolvePublicationReconciliationCommand,
} from './resolve-publication-reconciliation.command';

export class ResolvePublicationReconciliationHandler {
  public async execute(
    command: ResolvePublicationReconciliationCommand,
  ): Promise<PublicationReconciliationResolution> {
    return resolvePublicationReconciliation(command);
  }
}

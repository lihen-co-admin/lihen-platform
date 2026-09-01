import type { ExistingControlPlanePort } from '@lihen/intelligence-core';
import { createOperationsComposition } from './operations';

/**
 * Composition-only adapter.
 *
 * It maps GAP-008's neutral ExistingControlPlanePort to the already-existing LIHEN
 * operations facade. It contains no canonical policy and no Supabase/RPC calls of its own.
 */
export function createExistingControlPlaneAdapter(
  operations: ReturnType<typeof createOperationsComposition>,
): ExistingControlPlanePort {
  return {
    async validateOperationPayload(operationCode, requestPayload) {
      const result = await operations.validateOperationPayload(
        operationCode,
        requestPayload,
      );

      return {
        operationCode: result.operationCode,
        valid: result.valid,
        missingRequiredKeys: result.missingRequiredKeys,
        unexpectedKeys: result.unexpectedKeys,
        executionEnabled: result.executionEnabled,
        validationNote: result.validationNote,
      };
    },

    async prepareOperation(operationKey, operationCode, requestPayload) {
      const result = await operations.prepareOperation(
        operationKey,
        operationCode,
        requestPayload,
      );

      return {
        intentId: result.intentId,
        operationKey: result.operationKey,
        operationCode: result.operationCode,
        domainCode: result.domainCode,
        riskLevel: result.riskLevel,
        requiresConfirmation: result.requiresConfirmation,
        executionEnabled: result.executionEnabled,
        status: result.status,
        confirmationToken: result.confirmationToken,
        previewSnapshot: result.previewSnapshot,
        expiresAt: result.expiresAt,
      };
    },

    async confirmOperation(intentId, confirmationToken) {
      return operations.confirmOperation(intentId, confirmationToken);
    },

    async getAuditTimeline(limit = 50, offset = 0, domainCode = null) {
      return operations.getControlCenterAuditTimeline(
        limit,
        offset,
        domainCode,
      );
    },
  };
}

export function createBrowserExistingControlPlaneAdapter(
  env: Record<string, unknown> = import.meta.env,
): ExistingControlPlanePort {
  return createExistingControlPlaneAdapter(createOperationsComposition(env));
}

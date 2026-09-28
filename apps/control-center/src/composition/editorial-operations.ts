import { getBrowserSupabaseClient } from '@lihen/database';
import { runtimeErrorMessage, type EditorialRuntimeClient } from './editorial-workspace';

export type EditorialOperationalAction =
  'CREATE_PUBLICATION_ATTEMPT' | 'EXECUTE_PUBLICATION_ATTEMPT';
export interface EditorialServerAssessment {
  snapshot: string;
  preparedPublicationId: string;
  productId: string;
  channel: string;
  copy: string;
  callToAction: string;
  hashtags: string[];
  creativeAssetIds: string[];
  attemptId: string | null;
  nextAction: EditorialOperationalAction | null;
  blockers: string[];
  assessedAt: string;
  executionAllowed: false;
}

export function createEditorialOperations(client: EditorialRuntimeClient, dev: boolean) {
  const invoke = async <T>(action: string, payload: Record<string, unknown>) => {
    if (!dev) throw new Error('Operación disponible exclusivamente en DEV.');
    const result = await client.functions.invoke<T>('marketing-social-runtime', {
      body: { action, payload },
    });
    if (result.error || !result.data?.data || typeof result.data.externalPublication !== 'boolean')
      throw new Error(
        result.error
          ? await runtimeErrorMessage(result.error)
          : 'Resultado no confirmado. Actualiza desde DEV; no reintentes.',
      );
    if (action !== 'EXECUTE_PUBLICATION_ATTEMPT' && result.data.externalPublication !== false)
      throw new Error('Respuesta operativa inconsistente. Requiere reconciliación.');
    return result.data;
  };
  return {
    async assess(preparedPublicationId: string, productId: string) {
      const result = await invoke<EditorialServerAssessment>('ASSESS_PUBLICATION_OPERATION', {
        preparedPublicationId,
        productId,
      });
      const assessment = result.data;
      if (
        assessment.preparedPublicationId !== preparedPublicationId ||
        assessment.productId !== productId ||
        !assessment.snapshot ||
        assessment.executionAllowed !== false ||
        !Array.isArray(assessment.blockers) ||
        !Array.isArray(assessment.hashtags) ||
        !Array.isArray(assessment.creativeAssetIds) ||
        (assessment.blockers.length > 0 && assessment.nextAction !== null) ||
        ![null, 'CREATE_PUBLICATION_ATTEMPT', 'EXECUTE_PUBLICATION_ATTEMPT'].includes(
          assessment.nextAction,
        )
      )
        throw new Error('Assessment inválido; operación bloqueada.');
      return assessment;
    },
    async confirm(
      assessment: EditorialServerAssessment,
      confirmedAction: EditorialOperationalAction,
    ) {
      if (
        !assessment.snapshot ||
        assessment.nextAction !== confirmedAction ||
        assessment.blockers.length ||
        (confirmedAction === 'EXECUTE_PUBLICATION_ATTEMPT' && !assessment.attemptId)
      )
        throw new Error('Se requiere assessment vigente y aprobación explícita de esta acción.');
      return invoke(confirmedAction, {
        preparedPublicationId: assessment.preparedPublicationId,
        productId: assessment.productId,
        attemptId: assessment.attemptId,
        expectedSnapshot: assessment.snapshot,
        confirmedAction,
      });
    },
  };
}

export function editorialOperationsInDev() {
  return createEditorialOperations(getBrowserSupabaseClient(import.meta.env), import.meta.env.DEV);
}

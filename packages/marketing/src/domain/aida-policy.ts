import type {
  MarketingChannel,
  MarketingObjective,
} from './campaign';

export const aidaStages = [
  'ATTENTION',
  'INTEREST',
  'DESIRE',
  'ACTION',
] as const;

export type AidaStage = (typeof aidaStages)[number];

export interface AidaStrategyInput {
  readonly objective: MarketingObjective;
  readonly channel: MarketingChannel;
  readonly audienceDescription: string;
  readonly productContext: string;
  readonly callToAction: string;
}

export interface AidaStrategy {
  readonly attention: string;
  readonly interest: string;
  readonly desire: string;
  readonly action: string;
  readonly channel: MarketingChannel;
  readonly objective: MarketingObjective;
}

function required(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

export function buildAidaStrategy(
  input: AidaStrategyInput,
): AidaStrategy {
  const audience = required(
    input.audienceDescription,
    'MARKETING_AUDIENCE_REQUIRED',
  );

  const product = required(
    input.productContext,
    'MARKETING_PRODUCT_CONTEXT_REQUIRED',
  );

  const cta = required(
    input.callToAction,
    'MARKETING_CTA_REQUIRED',
  );

  return {
    attention:
      `Captar la atención de ${audience} con una idea clara y relevante para ${product}.`,
    interest:
      `Explicar por qué ${product} es relevante para la necesidad o interés de la audiencia.`,
    desire:
      `Convertir beneficios y contexto de ${product} en una razón concreta para considerarlo.`,
    action: cta,
    channel: input.channel,
    objective: input.objective,
  };
}

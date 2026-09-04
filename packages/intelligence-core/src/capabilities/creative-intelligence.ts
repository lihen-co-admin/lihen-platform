import type {
  IntelligenceCandidate,
  IntelligenceCandidateType,
  IntelligenceContext,
  IntelligenceEvidence,
} from '../contracts';
import type {
  ImageGenerationPort,
  ProviderResult,
  GeneratedImage,
} from '../provider-ports';
import type {
  IntelligenceCapabilityExecutionInput,
  IntelligenceCapabilityExecutionOutput,
  IntelligenceCapabilityHandler,
} from '../orchestrator';

export interface CreativeBrief {
  readonly briefId: string;
  readonly instruction: string;
  readonly intendedUse: string;
  readonly sourceAssetRefs: readonly string[];
  readonly constraints: readonly string[];
}

export interface CreativeIntelligenceDependencies {
  readonly imageGeneration?: ImageGenerationPort;
}

export interface CreativeGenerationRequest {
  readonly correlationId: string;
  readonly requestedBy: string;
  readonly context: IntelligenceContext;
  readonly brief: CreativeBrief;
}

export type CreativeGenerationStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'NO_RESULT'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_FAILED';

export interface CreativeGenerationResult {
  readonly status: CreativeGenerationStatus;
  readonly evidence: readonly IntelligenceEvidence[];
  readonly candidates: readonly IntelligenceCandidate[];
  readonly messages: readonly string[];
}

function compactId(value: string): string {
  const compact = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return compact || 'generated';
}

function candidateTypeForContext(
  context: IntelligenceContext,
): IntelligenceCandidateType {
  return context.type === 'PRODUCT' ? 'PRODUCT_ASSET' : 'CATALOG_ASSET';
}

function generatedEvidence(
  request: CreativeGenerationRequest,
  image: GeneratedImage,
  providerName: string,
  index: number,
): IntelligenceEvidence {
  const ref = compactId(image.generatedRef);

  return {
    evidenceId: `creative-evidence-${request.brief.briefId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    context: request.context,
    capability: 'CREATIVE_INTELLIGENCE',
    sourceAuthority: {
      level: 'GENERATED',
      sourceName: providerName,
      rationale: [
        'Artifact was produced by an injected ImageGenerationPort.',
        'GENERATED provenance is not canonical business authority.',
      ],
    },
    observation: `Generated creative artifact candidate for ${request.brief.intendedUse}.`,
    payload: {
      generatedRef: image.generatedRef,
      provenance: image.provenance,
      mimeType: image.mimeType,
      ...(image.width === undefined ? {} : { width: image.width }),
      ...(image.height === undefined ? {} : { height: image.height }),
      intendedUse: request.brief.intendedUse,
      sourceAssetRefs: request.brief.sourceAssetRefs,
      constraints: request.brief.constraints,
    },
    confidence: {
      score: 0.5,
      band: 'MEDIUM',
      rationale: [
        'Generation completed, but creative suitability requires human review.',
        'Confidence does not grant permission to publish or replace canonical assets.',
      ],
    },
    fingerprint: `generated:${request.brief.briefId}:${index + 1}:${image.generatedRef}`,
    createdAt: new Date().toISOString(),
  };
}

function generatedCandidate(
  request: CreativeGenerationRequest,
  image: GeneratedImage,
  evidence: IntelligenceEvidence,
  index: number,
): IntelligenceCandidate {
  const ref = compactId(image.generatedRef);

  return {
    candidateId: `creative-candidate-${request.brief.briefId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    type: candidateTypeForContext(request.context),
    context: request.context,
    payload: {
      generatedRef: image.generatedRef,
      provenance: 'GENERATED',
      mimeType: image.mimeType,
      ...(image.width === undefined ? {} : { width: image.width }),
      ...(image.height === undefined ? {} : { height: image.height }),
      intendedUse: request.brief.intendedUse,
      instruction: request.brief.instruction,
      constraints: request.brief.constraints,
    },
    evidenceIds: [evidence.evidenceId],
    confidence: evidence.confidence,
    status: 'PENDING',
    createdAt: evidence.createdAt,
  };
}

function providerFailureMessage(
  result: ProviderResult<readonly GeneratedImage[]>,
): string {
  return [
    `Image generation provider returned ${result.status}.`,
    ...result.messages,
  ].join(' ');
}

export async function generateCreativeCandidates(
  dependencies: CreativeIntelligenceDependencies,
  request: CreativeGenerationRequest,
): Promise<CreativeGenerationResult> {
  const instruction = request.brief.instruction.trim();
  const intendedUse = request.brief.intendedUse.trim();

  if (!instruction || !intendedUse) {
    return {
      status: 'NO_RESULT',
      evidence: [],
      candidates: [],
      messages: ['Creative brief requires instruction and intendedUse.'],
    };
  }

  if (!dependencies.imageGeneration) {
    return {
      status: 'PROVIDER_NOT_CONFIGURED',
      evidence: [],
      candidates: [],
      messages: [
        'No ImageGenerationPort is configured.',
        'No generated artifact, persistence or publication occurred.',
      ],
    };
  }

  const result = await dependencies.imageGeneration.generate({
    correlationId: request.correlationId,
    requestedBy: request.requestedBy,
    context: request.context,
    instruction,
    sourceAssetRefs: request.brief.sourceAssetRefs,
    intendedUse,
    constraints: request.brief.constraints,
  });

  if (
    result.status !== 'SUCCESS'
    && result.status !== 'PARTIAL'
  ) {
    return {
      status: 'PROVIDER_FAILED',
      evidence: [],
      candidates: [],
      messages: [providerFailureMessage(result)],
    };
  }

  const generated = result.data ?? [];
  if (generated.length === 0) {
    return {
      status: 'NO_RESULT',
      evidence: [],
      candidates: [],
      messages: [
        ...result.messages,
        'Provider returned no generated artifacts.',
      ],
    };
  }

  const providerName = dependencies.imageGeneration.descriptor.name;
  const evidence = generated.map((image, index) =>
    generatedEvidence(request, image, providerName, index),
  );
  const candidates = generated.map((image, index) =>
    generatedCandidate(request, image, evidence[index]!, index),
  );

  return {
    status: result.status === 'PARTIAL' ? 'PARTIAL_SUCCESS' : 'SUCCESS',
    evidence,
    candidates,
    messages: [
      ...result.messages,
      `${generated.length} generated creative candidate(s) require human review before canonical use or publication.`,
    ],
  };
}

function readCreativeBrief(
  input: IntelligenceCapabilityExecutionInput,
): CreativeBrief {
  const raw = input.context.attributes.creativeBrief;

  if (
    raw === null
    || typeof raw !== 'object'
    || Array.isArray(raw)
  ) {
    throw new Error('CREATIVE_BRIEF_REQUIRED');
  }

  const value = raw as Record<string, unknown>;

  if (
    typeof value.briefId !== 'string'
    || typeof value.instruction !== 'string'
    || typeof value.intendedUse !== 'string'
    || !Array.isArray(value.sourceAssetRefs)
    || !value.sourceAssetRefs.every((item) => typeof item === 'string')
    || !Array.isArray(value.constraints)
    || !value.constraints.every((item) => typeof item === 'string')
  ) {
    throw new Error('CREATIVE_BRIEF_INVALID');
  }

  return {
    briefId: value.briefId,
    instruction: value.instruction,
    intendedUse: value.intendedUse,
    sourceAssetRefs: value.sourceAssetRefs as string[],
    constraints: value.constraints as string[],
  };
}

export function createCreativeIntelligenceHandler(
  dependencies: CreativeIntelligenceDependencies,
): IntelligenceCapabilityHandler {
  return {
    capability: 'CREATIVE_INTELLIGENCE',
    async execute(
      input: IntelligenceCapabilityExecutionInput,
    ): Promise<IntelligenceCapabilityExecutionOutput> {
      const creative = await generateCreativeCandidates(
        dependencies,
        {
          correlationId: input.correlationId,
          requestedBy: input.requestedBy,
          context: input.context,
          brief: readCreativeBrief(input),
        },
      );

      if (creative.status === 'PROVIDER_NOT_CONFIGURED') {
        throw new Error('CREATIVE_IMAGE_PROVIDER_NOT_CONFIGURED');
      }

      if (creative.status === 'PROVIDER_FAILED') {
        throw new Error(
          `CREATIVE_IMAGE_PROVIDER_FAILED: ${creative.messages.join(' ')}`,
        );
      }

      return {
        capability: 'CREATIVE_INTELLIGENCE',
        evidence: creative.evidence,
        candidates: creative.candidates,
        recommendations: [],
        messages: creative.messages,
      };
    },
  };
}

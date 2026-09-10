import type {
  IntelligenceCandidate,
  IntelligenceContext,
  IntelligenceEvidence,
} from '../contracts';
import type {
  ImageTransformationPort,
  ProviderResult,
  TransformedImage,
} from '../provider-ports';
import type {
  IntelligenceCapabilityExecutionInput,
  IntelligenceCapabilityExecutionOutput,
  IntelligenceCapabilityHandler,
} from '../orchestrator';

export interface BackgroundRemovalBrief {
  readonly briefId: string;
  readonly sourceAssetRef: string;
  readonly intendedUse: string;
  readonly constraints: readonly string[];
}

export interface BackgroundRemovalDependencies {
  readonly imageTransformation?: ImageTransformationPort;
}

export interface BackgroundRemovalRequest {
  readonly correlationId: string;
  readonly requestedBy: string;
  readonly context: IntelligenceContext;
  readonly brief: BackgroundRemovalBrief;
}

export type BackgroundRemovalStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'NO_RESULT'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_FAILED';

export interface BackgroundRemovalResult {
  readonly status: BackgroundRemovalStatus;
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

  return compact || 'transformed';
}

function transformedEvidence(
  request: BackgroundRemovalRequest,
  image: TransformedImage,
  providerName: string,
  index: number,
): IntelligenceEvidence {
  const ref = compactId(image.transformedRef);
  const createdAt = new Date().toISOString();

  return {
    evidenceId:
      `background-removal-evidence-${request.brief.briefId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    context: request.context,
    capability: 'CREATIVE_INTELLIGENCE',
    sourceAuthority: {
      level: 'GENERATED',
      sourceName: providerName,
      rationale: [
        'Transformation evidence was produced by an injected ImageTransformationPort.',
        'The transformed derivative is not canonical business authority.',
      ],
    },
    observation:
      `Background-removal derivative candidate for ${request.brief.intendedUse}.`,
    payload: {
      transformedRef: image.transformedRef,
      sourceAssetRef: image.sourceAssetRef,
      provenance: image.provenance,
      mimeType: image.mimeType,
      ...(image.width === undefined ? {} : { width: image.width }),
      ...(image.height === undefined ? {} : { height: image.height }),
      operation: 'REMOVE_BACKGROUND',
      intendedUse: request.brief.intendedUse,
      constraints: request.brief.constraints,
    },
    confidence: {
      score: 0.5,
      band: 'MEDIUM',
      rationale: [
        'Transformation completed, but identity preservation requires human review.',
        'Confidence does not authorize publication or replacement of canonical assets.',
      ],
    },
    fingerprint:
      `transformed:${request.brief.briefId}:${index + 1}:${image.transformedRef}`,
    createdAt,
  };
}

function transformedCandidate(
  request: BackgroundRemovalRequest,
  image: TransformedImage,
  evidence: IntelligenceEvidence,
  index: number,
): IntelligenceCandidate {
  const ref = compactId(image.transformedRef);

  return {
    candidateId:
      `background-removal-candidate-${request.brief.briefId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    type:
      request.context.type === 'PRODUCT'
        ? 'PRODUCT_ASSET'
        : 'CATALOG_ASSET',
    context: request.context,
    payload: {
      transformedRef: image.transformedRef,
      sourceAssetRef: image.sourceAssetRef,
      provenance: 'TRANSFORMED',
      mimeType: image.mimeType,
      ...(image.width === undefined ? {} : { width: image.width }),
      ...(image.height === undefined ? {} : { height: image.height }),
      operation: 'REMOVE_BACKGROUND',
      intendedUse: request.brief.intendedUse,
      constraints: request.brief.constraints,
    },
    evidenceIds: [evidence.evidenceId],
    confidence: evidence.confidence,
    status: 'PENDING',
    createdAt: evidence.createdAt,
  };
}

function providerFailureMessage(
  result: ProviderResult<readonly TransformedImage[]>,
): string {
  return [
    `Image transformation provider returned ${result.status}.`,
    ...result.messages,
  ].join(' ');
}

export async function removeImageBackground(
  dependencies: BackgroundRemovalDependencies,
  request: BackgroundRemovalRequest,
): Promise<BackgroundRemovalResult> {
  const sourceAssetRef = request.brief.sourceAssetRef.trim();
  const intendedUse = request.brief.intendedUse.trim();

  if (!sourceAssetRef || !intendedUse) {
    return {
      status: 'NO_RESULT',
      evidence: [],
      candidates: [],
      messages: [
        'Background removal requires sourceAssetRef and intendedUse.',
      ],
    };
  }

  if (!dependencies.imageTransformation) {
    return {
      status: 'PROVIDER_NOT_CONFIGURED',
      evidence: [],
      candidates: [],
      messages: [
        'No ImageTransformationPort is configured.',
        'No transformed artifact, persistence or publication occurred.',
      ],
    };
  }

  const result = await dependencies.imageTransformation.transform({
    correlationId: request.correlationId,
    requestedBy: request.requestedBy,
    context: request.context,
    operation: 'REMOVE_BACKGROUND',
    sourceAssetRef,
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

  const transformed = result.data ?? [];

  if (transformed.length === 0) {
    return {
      status: 'NO_RESULT',
      evidence: [],
      candidates: [],
      messages: [
        ...result.messages,
        'Provider returned no transformed artifacts.',
      ],
    };
  }

  const providerName =
    dependencies.imageTransformation.descriptor.name;

  const evidence = transformed.map((image, index) =>
    transformedEvidence(request, image, providerName, index),
  );

  const candidates = transformed.map((image, index) =>
    transformedCandidate(
      request,
      image,
      evidence[index]!,
      index,
    ),
  );

  return {
    status:
      result.status === 'PARTIAL'
        ? 'PARTIAL_SUCCESS'
        : 'SUCCESS',
    evidence,
    candidates,
    messages: [
      ...result.messages,
      `${transformed.length} transformed candidate(s) require human review before canonical use or publication.`,
    ],
  };
}

function readBackgroundRemovalBrief(
  input: IntelligenceCapabilityExecutionInput,
): BackgroundRemovalBrief {
  const raw = input.context.attributes.backgroundRemovalBrief;

  if (
    raw === null
    || typeof raw !== 'object'
    || Array.isArray(raw)
  ) {
    throw new Error('BACKGROUND_REMOVAL_BRIEF_REQUIRED');
  }

  const value = raw as Record<string, unknown>;

  if (
    typeof value.briefId !== 'string'
    || typeof value.sourceAssetRef !== 'string'
    || typeof value.intendedUse !== 'string'
    || !Array.isArray(value.constraints)
    || !value.constraints.every((item) => typeof item === 'string')
  ) {
    throw new Error('BACKGROUND_REMOVAL_BRIEF_INVALID');
  }

  return {
    briefId: value.briefId,
    sourceAssetRef: value.sourceAssetRef,
    intendedUse: value.intendedUse,
    constraints: value.constraints as string[],
  };
}

export function createImageTransformationHandler(
  dependencies: BackgroundRemovalDependencies,
): IntelligenceCapabilityHandler {
  return {
    capability: 'IMAGE_TRANSFORMATION',
    async execute(
      input: IntelligenceCapabilityExecutionInput,
    ): Promise<IntelligenceCapabilityExecutionOutput> {
      const result = await removeImageBackground(
        dependencies,
        {
          correlationId: input.correlationId,
          requestedBy: input.requestedBy,
          context: input.context,
          brief: readBackgroundRemovalBrief(input),
        },
      );

      if (result.status === 'PROVIDER_NOT_CONFIGURED') {
        throw new Error('IMAGE_TRANSFORMATION_PROVIDER_NOT_CONFIGURED');
      }

      if (result.status === 'PROVIDER_FAILED') {
        throw new Error(
          `IMAGE_TRANSFORMATION_PROVIDER_FAILED: ${result.messages.join(' ')}`,
        );
      }

      return {
        capability: 'IMAGE_TRANSFORMATION',
        evidence: result.evidence,
        candidates: result.candidates,
        recommendations: [],
        messages: result.messages,
      };
    },
  };
}

import type {
  CorrelationId,
  IntelligenceContext,
  IntelligenceRecommendation,
  IntelligenceResultStatus,
} from './contracts';
import {
  resolveAssistantContext,
} from './context-resolver';
import type {
  AssistantContextQuery,
  AssistantContextResolverDependencies,
} from './context-resolver';
import {
  orchestrateIntelligenceRequest,
} from './orchestrator';
import type {
  IntelligenceCapabilityExecutionInput,
  IntelligenceCapabilityExecutionOutput,
  IntelligenceIntent,
  IntelligenceOrchestratorDependencies,
  IntelligenceOrchestratorExecution,
} from './orchestrator';
import type {
  ModelPort,
  ModelMessage,
  ProviderResult,
} from './provider-ports';
import type {
  PermissionPrincipal,
} from './permission-model';
import {
  prepareApprovedRecommendationForControlPlane,
} from './control-plane';
import type {
  ControlledActionPreparation,
  ExistingControlPlanePort,
  RecommendationOperationMapping,
} from './control-plane';
import type {
  IntelligenceDecision,
} from './contracts';

export interface LihenAssistantTurnRequest {
  readonly requestId: string;
  readonly correlationId: CorrelationId;
  readonly requestedBy: string;
  readonly principal: PermissionPrincipal;
  readonly prompt: string;
  readonly contextQuery: AssistantContextQuery;
}

export interface LihenAssistantTurnDependencies {
  readonly context: AssistantContextResolverDependencies;
  readonly model?: ModelPort;
}

export type LihenAssistantTurnStatus =
  | 'SUCCESS'
  | 'NO_RESULT'
  | 'REQUIRES_REVIEW'
  | 'PERMISSION_DENIED'
  | 'DEPENDENCY_FAILED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_FAILED';

export interface LihenAssistantTurn {
  readonly status: LihenAssistantTurnStatus;
  readonly answer?: string;
  readonly context?: IntelligenceContext;
  readonly contextSource?: string;
  readonly orchestration?: IntelligenceOrchestratorExecution;
  readonly recommendations: readonly IntelligenceRecommendation[];
  readonly messages: readonly string[];
}

function assistantIntent(prompt: string): IntelligenceIntent {
  return {
    intentId: 'lihen-assistant-answer',
    name: 'LIHEN Assistant answer',
    description: prompt,
    requestedCapabilities: ['ASSISTANT'],
    requiresVerification: false,
    expectedOutput: 'ANSWER',
  };
}

function modelMessages(prompt: string): readonly ModelMessage[] {
  return [
    {
      role: 'SYSTEM',
      content:
        'You are LIHEN Assistant. Use only the governed context supplied to you. '
        + 'Do not claim authority to mutate master data, publish, post finance, '
        + 'change inventory or execute controlled operations.',
    },
    {
      role: 'USER',
      content: prompt,
    },
  ];
}

function providerFailureStatus(
  result: ProviderResult<unknown>,
): LihenAssistantTurnStatus {
  return result.status === 'UNAVAILABLE'
    || result.status === 'RATE_LIMITED'
    ? 'PROVIDER_FAILED'
    : 'PROVIDER_FAILED';
}

function mapOrchestrationStatus(
  status: IntelligenceResultStatus,
): LihenAssistantTurnStatus {
  switch (status) {
    case 'SUCCESS':
      return 'SUCCESS';
    case 'NO_RESULT':
      return 'NO_RESULT';
    case 'REQUIRES_REVIEW':
      return 'REQUIRES_REVIEW';
    case 'PERMISSION_DENIED':
    case 'POLICY_BLOCKED':
      return 'PERMISSION_DENIED';
    default:
      return 'DEPENDENCY_FAILED';
  }
}

export async function runLihenAssistantTurn(
  dependencies: LihenAssistantTurnDependencies,
  request: LihenAssistantTurnRequest,
): Promise<LihenAssistantTurn> {
  const prompt = request.prompt.trim();
  if (!prompt) {
    return {
      status: 'NO_RESULT',
      recommendations: [],
      messages: ['Assistant prompt is required.'],
    };
  }

  const contextResolution = await resolveAssistantContext(
    dependencies.context,
    {
      requestedBy: request.requestedBy,
      principal: request.principal,
      query: request.contextQuery,
    },
  );

  if (
    contextResolution.status !== 'SUCCESS'
    || contextResolution.context === undefined
  ) {
    return {
      status:
        contextResolution.status === 'PERMISSION_DENIED'
          ? 'PERMISSION_DENIED'
          : 'DEPENDENCY_FAILED',
      recommendations: [],
      messages: contextResolution.messages,
    };
  }

  if (!dependencies.model) {
    return {
      status: 'PROVIDER_NOT_CONFIGURED',
      context: contextResolution.context,
      ...(contextResolution.source === undefined
        ? {}
        : { contextSource: contextResolution.source }),
      recommendations: [],
      messages: [
        'LIHEN Assistant context is ready, but no ModelPort adapter is configured.',
        'No provider call, recommendation or controlled action was executed.',
      ],
    };
  }

  let answer = '';
  let providerMessages: readonly string[] = [];

  const assistantHandler = {
    capability: 'ASSISTANT' as const,
    async execute(
      input: IntelligenceCapabilityExecutionInput,
    ): Promise<IntelligenceCapabilityExecutionOutput> {
      const result = await dependencies.model!.complete({
        correlationId: input.correlationId,
        requestedBy: input.requestedBy,
        context: input.context,
        messages: modelMessages(prompt),
        responseFormat: 'TEXT',
        temperature: 0.2,
      });

      providerMessages = result.messages;

      if (result.status !== 'SUCCESS' || result.data === undefined) {
        throw new Error(
          `ASSISTANT_MODEL_${providerFailureStatus(result)}: `
          + `${result.messages.join(' ') || result.status}`,
        );
      }

      answer = result.data.text;

      return {
        capability: 'ASSISTANT',
        evidence: [],
        candidates: [],
        recommendations: [],
        messages: result.messages,
      };
    },
  };

  const orchestratorDependencies: IntelligenceOrchestratorDependencies = {
    handlers: [assistantHandler],
  };

  const orchestration = await orchestrateIntelligenceRequest(
    orchestratorDependencies,
    {
      requestId: request.requestId,
      correlationId: request.correlationId,
      requestedBy: request.requestedBy,
      principal: request.principal,
      context: contextResolution.context,
      intent: assistantIntent(prompt),
    },
  );

  const status = mapOrchestrationStatus(orchestration.result.status);

  if (
    orchestration.result.status === 'DEPENDENCY_FAILED'
    && orchestration.result.messages.some((message) =>
      message.includes('ASSISTANT_MODEL_'),
    )
  ) {
    return {
      status: 'PROVIDER_FAILED',
      context: contextResolution.context,
      ...(contextResolution.source === undefined
        ? {}
        : { contextSource: contextResolution.source }),
      orchestration,
      recommendations: orchestration.recommendations,
      messages: [
        ...providerMessages,
        ...orchestration.result.messages,
      ],
    };
  }

  return {
    status,
    ...(answer.trim() ? { answer } : {}),
    context: contextResolution.context,
    ...(contextResolution.source === undefined
      ? {}
      : { contextSource: contextResolution.source }),
    orchestration,
    recommendations: orchestration.recommendations,
    messages: orchestration.result.messages,
  };
}

export interface LihenAssistantControlledHandoffRequest {
  readonly recommendation: IntelligenceRecommendation;
  readonly decision: IntelligenceDecision;
  readonly mapping: RecommendationOperationMapping;
  readonly controlPlane: ExistingControlPlanePort;
}

export async function prepareLihenAssistantRecommendation(
  request: LihenAssistantControlledHandoffRequest,
): Promise<ControlledActionPreparation> {
  return prepareApprovedRecommendationForControlPlane(request);
}

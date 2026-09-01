import type {
  CorrelationId,
  IntelligenceCandidate,
  IntelligenceCapabilityName,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
  IntelligenceResult,
  IntelligenceResultStatus,
} from './contracts';
import {
  evaluatePermission,
  INTELLIGENCE_PERMISSION,
} from './permission-model';
import type {
  PermissionActionClass,
  PermissionDecision,
  PermissionPrincipal,
  PermissionRequest,
  PermissionScope,
} from './permission-model';

/**
 * LIHEN Intelligence Orchestrator — GAP-006
 *
 * Application-neutral coordination for Intelligence.
 *
 * This module:
 * - resolves the minimum Intelligence permissions for context + capabilities;
 * - preflights capability handlers before executing work;
 * - executes capabilities sequentially under one correlation id;
 * - accumulates evidence/candidates/recommendations;
 * - forces VERIFICATION into plans that explicitly require it;
 * - returns governed review/read-only outcomes.
 *
 * This module does NOT:
 * - know SQL, Supabase, RPCs, React, HTTP or provider SDKs;
 * - approve human decisions;
 * - execute controlled commands;
 * - mutate canonical domains.
 *
 * GAP-007 will define provider/tool ports and adapters. GAP-008 will connect approved
 * recommendations to the existing LIHEN Control Plane.
 */

export type IntelligenceExpectedOutput =
  | 'ANSWER'
  | 'REPORT'
  | 'EVIDENCE'
  | 'CANDIDATE'
  | 'RECOMMENDATION'
  | 'PREPARED_ACTION';

export interface IntelligenceIntent {
  readonly intentId: string;
  readonly name: string;
  readonly description: string;
  readonly requestedCapabilities: readonly IntelligenceCapabilityName[];
  readonly requiresVerification: boolean;
  readonly expectedOutput: IntelligenceExpectedOutput;
}

export interface IntelligenceOrchestratorRequest {
  readonly requestId: string;
  readonly correlationId: CorrelationId;
  readonly requestedBy: string;
  readonly principal: PermissionPrincipal;
  readonly context: IntelligenceContext;
  readonly intent: IntelligenceIntent;
}

export interface IntelligenceCapabilityExecutionInput {
  readonly requestId: string;
  readonly correlationId: CorrelationId;
  readonly requestedBy: string;
  readonly context: IntelligenceContext;
  readonly intent: IntelligenceIntent;
  readonly priorEvidence: readonly IntelligenceEvidence[];
}

export interface IntelligenceCapabilityExecutionOutput {
  readonly capability: IntelligenceCapabilityName;
  readonly evidence: readonly IntelligenceEvidence[];
  readonly candidates: readonly IntelligenceCandidate[];
  readonly recommendations: readonly IntelligenceRecommendation[];
  readonly messages: readonly string[];
}

export interface IntelligenceCapabilityHandler {
  readonly capability: IntelligenceCapabilityName;
  execute(
    input: IntelligenceCapabilityExecutionInput,
  ): Promise<IntelligenceCapabilityExecutionOutput>;
}

export interface IntelligenceOrchestratorDependencies {
  readonly handlers: readonly IntelligenceCapabilityHandler[];
}

export interface IntelligenceOrchestrationPlan {
  readonly capabilities: readonly IntelligenceCapabilityName[];
  readonly permissionRequests: readonly PermissionRequest[];
}

export interface IntelligenceOrchestratorExecution {
  readonly plan: IntelligenceOrchestrationPlan;
  readonly permissionDecisions: readonly PermissionDecision[];
  readonly executedCapabilities: readonly IntelligenceCapabilityName[];
  readonly evidence: readonly IntelligenceEvidence[];
  readonly candidates: readonly IntelligenceCandidate[];
  readonly recommendations: readonly IntelligenceRecommendation[];
  readonly result: IntelligenceResult<{
    readonly requestId: string;
    readonly expectedOutput: IntelligenceExpectedOutput;
  }>;
}

const CAPABILITY_PERMISSION = {
  VISION: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: 'ANALYZE',
  },
  SEARCH: {
    permission: INTELLIGENCE_PERMISSION.SEARCH_EXTERNAL,
    actionClass: 'READ',
  },
  VERIFICATION: {
    permission: INTELLIGENCE_PERMISSION.VERIFY,
    actionClass: 'ANALYZE',
  },
  PRODUCT_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: 'ANALYZE',
  },
  BRAND_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: 'ANALYZE',
  },
  CATALOG_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: 'ANALYZE',
  },
  DOCUMENT_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.EXTRACT,
    actionClass: 'ANALYZE',
  },
  CREATIVE_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.GENERATE,
    actionClass: 'PROPOSE',
  },
  ANALYTICS: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: 'ANALYZE',
  },
  AUTOMATION: {
    permission: INTELLIGENCE_PERMISSION.PREPARE_ACTION,
    actionClass: 'PROPOSE',
  },
  AUDIT_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: 'ANALYZE',
  },
  ASSISTANT: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: 'ANALYZE',
  },
} as const satisfies Readonly<
  Record<
    IntelligenceCapabilityName,
    {
      readonly permission: PermissionRequest['permission'];
      readonly actionClass: PermissionActionClass;
    }
  >
>;

function scopeFromContext(context: IntelligenceContext): PermissionScope {
  return {
    ...(context.businessLine === undefined
      ? {}
      : { businessLine: context.businessLine }),
    ...(context.type === 'GLOBAL'
      ? {}
      : { domain: context.type.toLowerCase() }),
    ...(context.type === 'GLOBAL'
      ? {}
      : { entityType: context.type }),
    ...(context.entityId === undefined
      ? {}
      : { entityId: context.entityId }),
  };
}

function uniqueCapabilities(
  capabilities: readonly IntelligenceCapabilityName[],
): readonly IntelligenceCapabilityName[] {
  return [...new Set(capabilities)];
}

export function buildIntelligenceOrchestrationPlan(
  context: IntelligenceContext,
  intent: IntelligenceIntent,
): IntelligenceOrchestrationPlan {
  const requested = uniqueCapabilities(intent.requestedCapabilities);
  const capabilities: readonly IntelligenceCapabilityName[] =
    intent.requiresVerification && !requested.includes('VERIFICATION')
      ? [...requested, 'VERIFICATION' as IntelligenceCapabilityName]
      : requested;

  const scope = scopeFromContext(context);
  const permissionRequests: PermissionRequest[] = [
    {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      actionClass: 'READ',
      scope,
    },
  ];

  for (const capability of capabilities) {
    const requirement = CAPABILITY_PERMISSION[capability];

    if (
      !permissionRequests.some(
        (request) =>
          request.permission === requirement.permission
          && request.actionClass === requirement.actionClass,
      )
    ) {
      permissionRequests.push({
        permission: requirement.permission,
        actionClass: requirement.actionClass,
        scope,
      });
    }
  }

  return {
    capabilities,
    permissionRequests,
  };
}

function emptyExecution(
  plan: IntelligenceOrchestrationPlan,
  permissionDecisions: readonly PermissionDecision[],
  request: IntelligenceOrchestratorRequest,
  status: IntelligenceResultStatus,
  messages: readonly string[],
): IntelligenceOrchestratorExecution {
  return {
    plan,
    permissionDecisions,
    executedCapabilities: [],
    evidence: [],
    candidates: [],
    recommendations: [],
    result: {
      correlationId: request.correlationId,
      status,
      data: {
        requestId: request.requestId,
        expectedOutput: request.intent.expectedOutput,
      },
      evidenceIds: [],
      candidateIds: [],
      recommendationIds: [],
      messages,
    },
  };
}

function findHandler(
  handlers: readonly IntelligenceCapabilityHandler[],
  capability: IntelligenceCapabilityName,
): IntelligenceCapabilityHandler | undefined {
  return handlers.find((handler) => handler.capability === capability);
}

export async function orchestrateIntelligenceRequest(
  dependencies: IntelligenceOrchestratorDependencies,
  request: IntelligenceOrchestratorRequest,
): Promise<IntelligenceOrchestratorExecution> {
  const plan = buildIntelligenceOrchestrationPlan(request.context, request.intent);

  const permissionDecisions = plan.permissionRequests.map((permissionRequest) =>
    evaluatePermission(request.principal, permissionRequest),
  );

  const denied = permissionDecisions.find((decision) => !decision.allowed);
  if (denied) {
    return emptyExecution(
      plan,
      permissionDecisions,
      request,
      'PERMISSION_DENIED',
      [
        `Permission denied: ${denied.permission} (${denied.reason}).`,
        'No Intelligence capability was executed.',
      ],
    );
  }

  const duplicateHandlerCapability = dependencies.handlers.find(
    (handler, index, all) =>
      all.findIndex((candidate) => candidate.capability === handler.capability) !== index,
  );

  if (duplicateHandlerCapability) {
    return emptyExecution(
      plan,
      permissionDecisions,
      request,
      'DEPENDENCY_FAILED',
      [
        `Duplicate capability handler: ${duplicateHandlerCapability.capability}.`,
        'No Intelligence capability was executed.',
      ],
    );
  }

  const missingCapability = plan.capabilities.find(
    (capability) => !findHandler(dependencies.handlers, capability),
  );

  if (missingCapability) {
    return emptyExecution(
      plan,
      permissionDecisions,
      request,
      'DEPENDENCY_FAILED',
      [
        `Missing capability handler: ${missingCapability}.`,
        'No Intelligence capability was executed.',
      ],
    );
  }

  const evidence: IntelligenceEvidence[] = [];
  const candidates: IntelligenceCandidate[] = [];
  const recommendations: IntelligenceRecommendation[] = [];
  const executedCapabilities: IntelligenceCapabilityName[] = [];
  const messages: string[] = [];

  for (const capability of plan.capabilities) {
    const handler = findHandler(dependencies.handlers, capability);
    if (!handler) {
      // Defensive only: handler presence was preflighted above.
      return emptyExecution(
        plan,
        permissionDecisions,
        request,
        'DEPENDENCY_FAILED',
        [`Capability handler disappeared during orchestration: ${capability}.`],
      );
    }

    let output: IntelligenceCapabilityExecutionOutput;
    try {
      output = await handler.execute({
        requestId: request.requestId,
        correlationId: request.correlationId,
        requestedBy: request.requestedBy,
        context: request.context,
        intent: request.intent,
        priorEvidence: [...evidence],
      });
    } catch (error) {
      return {
        plan,
        permissionDecisions,
        executedCapabilities,
        evidence,
        candidates,
        recommendations,
        result: {
          correlationId: request.correlationId,
          status: 'DEPENDENCY_FAILED',
          data: {
            requestId: request.requestId,
            expectedOutput: request.intent.expectedOutput,
          },
          evidenceIds: evidence.map((item) => item.evidenceId),
          candidateIds: candidates.map((item) => item.candidateId),
          recommendationIds: recommendations.map(
            (item) => item.recommendationId,
          ),
          messages: [
            ...messages,
            `Capability failed: ${capability}.`,
            error instanceof Error ? error.message : 'Unknown capability failure.',
          ],
        },
      };
    }

    if (output.capability !== capability) {
      return {
        plan,
        permissionDecisions,
        executedCapabilities,
        evidence,
        candidates,
        recommendations,
        result: {
          correlationId: request.correlationId,
          status: 'DEPENDENCY_FAILED',
          data: {
            requestId: request.requestId,
            expectedOutput: request.intent.expectedOutput,
          },
          evidenceIds: evidence.map((item) => item.evidenceId),
          candidateIds: candidates.map((item) => item.candidateId),
          recommendationIds: recommendations.map(
            (item) => item.recommendationId,
          ),
          messages: [
            ...messages,
            `Capability handler mismatch: expected ${capability}, received ${output.capability}.`,
          ],
        },
      };
    }

    executedCapabilities.push(capability);
    evidence.push(...output.evidence);
    candidates.push(...output.candidates);
    recommendations.push(...output.recommendations);
    messages.push(...output.messages);
  }

  const hasHumanReview = recommendations.some(
    (recommendation) => recommendation.risk.requiresHumanReview,
  );

  const hasAnyOutput =
    evidence.length > 0
    || candidates.length > 0
    || recommendations.length > 0
    || messages.length > 0;

  const status: IntelligenceResultStatus = hasHumanReview
    ? 'REQUIRES_REVIEW'
    : hasAnyOutput
      ? 'SUCCESS'
      : 'NO_RESULT';

  return {
    plan,
    permissionDecisions,
    executedCapabilities,
    evidence,
    candidates,
    recommendations,
    result: {
      correlationId: request.correlationId,
      status,
      data: {
        requestId: request.requestId,
        expectedOutput: request.intent.expectedOutput,
      },
      evidenceIds: evidence.map((item) => item.evidenceId),
      candidateIds: candidates.map((item) => item.candidateId),
      recommendationIds: recommendations.map((item) => item.recommendationId),
      messages,
    },
  };
}

import type {
  IntelligenceContext,
  IntelligenceDecision,
  IntelligenceRecommendation,
} from '../contracts';
import type {
  IntelligenceCapabilityExecutionInput,
  IntelligenceCapabilityExecutionOutput,
  IntelligenceCapabilityHandler,
} from '../orchestrator';
import {
  prepareApprovedRecommendationForControlPlane,
} from '../control-plane';
import type {
  ControlledActionPreparation,
  ExistingControlPlanePort,
  RecommendationOperationMapping,
} from '../control-plane';

export type ControlledAutomationTriggerKind =
  | 'MANUAL'
  | 'EVENT'
  | 'CONDITION'
  | 'TIME_WINDOW';

export interface ControlledAutomationTrigger {
  readonly kind: ControlledAutomationTriggerKind;
  readonly description: string;
  readonly source: string;
}

export interface ControlledAutomationAction {
  readonly operationCode: string;
  readonly operationKey: string;
  readonly requestPayload: Readonly<Record<string, unknown>>;
}

export interface ControlledAutomationPlan {
  readonly automationId: string;
  readonly title: string;
  readonly purpose: string;
  readonly trigger: ControlledAutomationTrigger;
  readonly action: ControlledAutomationAction;
  readonly approvalMode: 'ALWAYS_REQUIRED';
  readonly enabled: boolean;
}

export interface ControlledAutomationEvaluation {
  readonly plan: ControlledAutomationPlan;
  readonly recommendation: IntelligenceRecommendation;
  readonly messages: readonly string[];
}

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

export function evaluateControlledAutomationPlan(input: {
  readonly correlationId: string;
  readonly context: IntelligenceContext;
  readonly plan: ControlledAutomationPlan;
}): ControlledAutomationEvaluation {
  const automationId = requiredText(
    input.plan.automationId,
    'AUTOMATION_ID_REQUIRED',
  );
  const title = requiredText(input.plan.title, 'AUTOMATION_TITLE_REQUIRED');
  const purpose = requiredText(
    input.plan.purpose,
    'AUTOMATION_PURPOSE_REQUIRED',
  );
  const triggerDescription = requiredText(
    input.plan.trigger.description,
    'AUTOMATION_TRIGGER_DESCRIPTION_REQUIRED',
  );
  const triggerSource = requiredText(
    input.plan.trigger.source,
    'AUTOMATION_TRIGGER_SOURCE_REQUIRED',
  );
  const operationCode = requiredText(
    input.plan.action.operationCode,
    'AUTOMATION_OPERATION_CODE_REQUIRED',
  );
  const operationKey = requiredText(
    input.plan.action.operationKey,
    'AUTOMATION_OPERATION_KEY_REQUIRED',
  );

  if (input.plan.approvalMode !== 'ALWAYS_REQUIRED') {
    throw new Error('AUTOMATION_APPROVAL_BYPASS_FORBIDDEN');
  }

  const plan: ControlledAutomationPlan = {
    automationId,
    title,
    purpose,
    trigger: {
      kind: input.plan.trigger.kind,
      description: triggerDescription,
      source: triggerSource,
    },
    action: {
      operationCode,
      operationKey,
      requestPayload: input.plan.action.requestPayload,
    },
    approvalMode: 'ALWAYS_REQUIRED',
    enabled: input.plan.enabled,
  };

  const recommendation: IntelligenceRecommendation = {
    recommendationId: `automation-review:${automationId}`,
    correlationId: input.correlationId,
    context: input.context,
    actionType: 'PREPARE_CONTROLLED_AUTOMATION',
    title: `Review controlled automation: ${title}`,
    explanation:
      'Automation may prepare a controlled operation only after explicit human approval; it cannot confirm or execute the operation autonomously.',
    priority: 'P2',
    severity: 'WARNING',
    source: 'AUTOMATION',
    rationale: [
      `Purpose: ${purpose}.`,
      `Trigger: ${plan.trigger.kind} — ${plan.trigger.description}.`,
      `Trigger source: ${plan.trigger.source}.`,
      `Controlled operation: ${operationCode}.`,
      plan.enabled
        ? 'Plan is enabled for review, not autonomous execution.'
        : 'Plan is disabled and cannot proceed to controlled preparation.',
      'Human approval remains mandatory before Control Plane preparation.',
      'Control Plane confirmation remains a separate explicit human/application step.',
    ],
    evidenceIds: [],
    confidence: {
      score: 1,
      band: 'VERY_HIGH',
      rationale: [
        'The recommendation is derived deterministically from the declared automation plan.',
        'Confidence does not authorize approval, confirmation or execution.',
      ],
    },
    risk: {
      level: 'R3',
      reasons: [
        'The proposed automation targets a controlled domain operation.',
        'Automation must never bypass human approval or Control Plane confirmation.',
      ],
      requiresHumanReview: true,
    },
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };

  return {
    plan,
    recommendation,
    messages: [
      'Controlled automation plan evaluated.',
      'No trigger runtime, scheduler, mutation or confirmation was executed.',
    ],
  };
}

function readAutomationPlan(
  input: IntelligenceCapabilityExecutionInput,
): ControlledAutomationPlan {
  const raw = input.context.attributes.automationPlan;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('AUTOMATION_PLAN_REQUIRED');
  }

  const value = raw as Record<string, unknown>;
  const trigger = value.trigger;
  const action = value.action;

  if (
    typeof value.automationId !== 'string'
    || typeof value.title !== 'string'
    || typeof value.purpose !== 'string'
    || value.approvalMode !== 'ALWAYS_REQUIRED'
    || typeof value.enabled !== 'boolean'
    || !trigger
    || typeof trigger !== 'object'
    || Array.isArray(trigger)
    || !action
    || typeof action !== 'object'
    || Array.isArray(action)
  ) {
    throw new Error('AUTOMATION_PLAN_INVALID');
  }

  const triggerValue = trigger as Record<string, unknown>;
  const actionValue = action as Record<string, unknown>;
  const validTriggerKinds: readonly ControlledAutomationTriggerKind[] = [
    'MANUAL',
    'EVENT',
    'CONDITION',
    'TIME_WINDOW',
  ];

  if (
    typeof triggerValue.kind !== 'string'
    || !validTriggerKinds.includes(
      triggerValue.kind as ControlledAutomationTriggerKind,
    )
    || typeof triggerValue.description !== 'string'
    || typeof triggerValue.source !== 'string'
    || typeof actionValue.operationCode !== 'string'
    || typeof actionValue.operationKey !== 'string'
    || !actionValue.requestPayload
    || typeof actionValue.requestPayload !== 'object'
    || Array.isArray(actionValue.requestPayload)
  ) {
    throw new Error('AUTOMATION_PLAN_INVALID');
  }

  return {
    automationId: value.automationId,
    title: value.title,
    purpose: value.purpose,
    trigger: {
      kind: triggerValue.kind as ControlledAutomationTriggerKind,
      description: triggerValue.description,
      source: triggerValue.source,
    },
    action: {
      operationCode: actionValue.operationCode,
      operationKey: actionValue.operationKey,
      requestPayload:
        actionValue.requestPayload as Readonly<Record<string, unknown>>,
    },
    approvalMode: 'ALWAYS_REQUIRED',
    enabled: value.enabled,
  };
}

export function createControlledAutomationHandler(): IntelligenceCapabilityHandler {
  return {
    capability: 'AUTOMATION',
    async execute(
      input: IntelligenceCapabilityExecutionInput,
    ): Promise<IntelligenceCapabilityExecutionOutput> {
      const evaluated = evaluateControlledAutomationPlan({
        correlationId: input.correlationId,
        context: input.context,
        plan: readAutomationPlan(input),
      });

      return {
        capability: 'AUTOMATION',
        evidence: [],
        candidates: [],
        recommendations: [evaluated.recommendation],
        messages: evaluated.messages,
      };
    },
  };
}

export async function prepareControlledAutomationForControlPlane(input: {
  readonly plan: ControlledAutomationPlan;
  readonly recommendation: IntelligenceRecommendation;
  readonly decision: IntelligenceDecision;
  readonly controlPlane: ExistingControlPlanePort;
}): Promise<ControlledActionPreparation> {
  if (!input.plan.enabled) {
    return {
      status: 'BLOCKED',
      reasons: ['AUTOMATION_PLAN_DISABLED'],
    };
  }

  if (input.plan.approvalMode !== 'ALWAYS_REQUIRED') {
    return {
      status: 'BLOCKED',
      reasons: ['AUTOMATION_APPROVAL_BYPASS_FORBIDDEN'],
    };
  }

  const mapping: RecommendationOperationMapping = {
    operationCode: input.plan.action.operationCode,
    operationKey: input.plan.action.operationKey,
    requestPayload: { ...input.plan.action.requestPayload },
  };

  return prepareApprovedRecommendationForControlPlane({
    recommendation: input.recommendation,
    decision: input.decision,
    mapping,
    controlPlane: input.controlPlane,
  });
}

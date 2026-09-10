// packages/intelligence-core/src/permission-model.ts
var INTELLIGENCE_PERMISSION = {
  READ_CONTEXT: "intelligence.read_context",
  SEARCH_EXTERNAL: "intelligence.search_external",
  ANALYZE: "intelligence.analyze",
  EXTRACT: "intelligence.extract",
  COMPARE: "intelligence.compare",
  VERIFY: "intelligence.verify",
  GENERATE: "intelligence.generate",
  CREATE_EVIDENCE: "intelligence.create_evidence",
  CREATE_CANDIDATE: "intelligence.create_candidate",
  CREATE_RECOMMENDATION: "intelligence.create_recommendation",
  CREATE_REPORT: "intelligence.create_report",
  PREPARE_ACTION: "intelligence.prepare_action"
};
var GOVERNED_PERMISSION = {
  APPROVE_CHANGE: "governance.approve_change",
  MUTATE_MASTER_DATA: "governance.mutate_master_data",
  CHANGE_PRICE: "pricing.change_sale_price",
  POST_INVENTORY: "inventory.post_movement",
  POST_PURCHASE: "procurement.post_purchase",
  POST_SALE: "sales.post_sale",
  POST_FINANCE: "finance.post_entry",
  CHANGE_LIFECYCLE: "governance.change_lifecycle",
  PUBLISH: "publication.publish",
  DELETE_CANONICAL_DATA: "governance.delete_canonical_data",
  BYPASS_RLS: "security.bypass_rls"
};
var INTELLIGENCE_AUTONOMY_ALLOWED_CLASSES = [
  "READ",
  "ANALYZE",
  "PROPOSE"
];
function scopeMatches(grantScope, requestScope) {
  if (!grantScope) return true;
  if (!requestScope) return false;
  return (grantScope.domain === void 0 || grantScope.domain === requestScope.domain) && (grantScope.businessLine === void 0 || grantScope.businessLine === requestScope.businessLine) && (grantScope.entityType === void 0 || grantScope.entityType === requestScope.entityType) && (grantScope.entityId === void 0 || grantScope.entityId === requestScope.entityId);
}
function matchingGrants(principal, request) {
  return principal.grants.filter(
    (grant) => grant.permission === request.permission && scopeMatches(grant.scope, request.scope)
  );
}
function evaluatePermission(principal, request) {
  const matches = matchingGrants(principal, request);
  const denied = matches.find((grant) => grant.effect === "DENY");
  if (denied) {
    return {
      allowed: false,
      permission: request.permission,
      actionClass: request.actionClass,
      reason: "EXPLICIT_DENY",
      matchedGrant: denied
    };
  }
  if (principal.actorType === "INTELLIGENCE" && !INTELLIGENCE_AUTONOMY_ALLOWED_CLASSES.includes(
    request.actionClass
  )) {
    return {
      allowed: false,
      permission: request.permission,
      actionClass: request.actionClass,
      reason: "INTELLIGENCE_AUTONOMY_BLOCK"
    };
  }
  const allowed = matches.find((grant) => grant.effect === "ALLOW");
  if (!allowed) {
    return {
      allowed: false,
      permission: request.permission,
      actionClass: request.actionClass,
      reason: "MISSING_GRANT"
    };
  }
  return {
    allowed: true,
    permission: request.permission,
    actionClass: request.actionClass,
    reason: "GRANT_ALLOWED",
    matchedGrant: allowed
  };
}
function definePermissionKey(domain, action) {
  const normalizedDomain = domain.trim().toLowerCase();
  const normalizedAction = action.trim().toLowerCase();
  if (!normalizedDomain || !normalizedAction || normalizedDomain.includes(".") || normalizedAction.includes(".")) {
    throw new Error("Permission key requires non-empty dot-free domain and action segments.");
  }
  return `${normalizedDomain}.${normalizedAction}`;
}

// packages/intelligence-core/src/assurance.ts
function evaluateRecommendationAssurance(recommendations, options = {}) {
  const issues = [];
  const requireExecutionGuard = options.requireExecutionGuard ?? true;
  if (recommendations.length === 0) {
    issues.push({
      code: "RECOMMENDATION_SET_EMPTY",
      severity: "WARNING",
      message: "No hay recomendaciones disponibles para evaluar."
    });
  }
  const seenIds = /* @__PURE__ */ new Set();
  for (const recommendation of recommendations) {
    if (seenIds.has(recommendation.id)) {
      issues.push({
        code: "DUPLICATE_RECOMMENDATION_ID",
        severity: "CRITICAL",
        message: `La recomendaci\xF3n ${recommendation.id} aparece m\xE1s de una vez.`,
        recommendationId: recommendation.id
      });
    }
    seenIds.add(recommendation.id);
    if (!recommendation.source.trim()) {
      issues.push({
        code: "MISSING_SOURCE",
        severity: "CRITICAL",
        message: "La recomendaci\xF3n no declara su fuente.",
        recommendationId: recommendation.id
      });
    }
    if (recommendation.rationale.length === 0 || recommendation.rationale.some((item) => !item.trim())) {
      issues.push({
        code: "MISSING_RATIONALE",
        severity: "CRITICAL",
        message: "La recomendaci\xF3n no contiene rationale explicable completo.",
        recommendationId: recommendation.id
      });
    }
    const hasActionLabel = Boolean(recommendation.actionLabel);
    const hasTargetRoute = Boolean(recommendation.targetRoute);
    if (hasActionLabel !== hasTargetRoute) {
      issues.push({
        code: "ACTION_ROUTE_MISMATCH",
        severity: "WARNING",
        message: "La acci\xF3n sugerida debe declarar label y ruta juntos, o ninguno.",
        recommendationId: recommendation.id
      });
    }
  }
  if (requireExecutionGuard && recommendations.length > 0 && !recommendations.some((item) => item.executionGuard)) {
    issues.push({
      code: "EXECUTION_GUARD_MISSING",
      severity: "CRITICAL",
      message: "Falta una se\xF1al expl\xEDcita que mantenga la ejecuci\xF3n sensible bajo gobierno."
    });
  }
  const criticalIssueCount = issues.filter((issue) => issue.severity === "CRITICAL").length;
  const warningIssueCount = issues.filter((issue) => issue.severity === "WARNING").length;
  const status = criticalIssueCount > 0 ? "BLOCKED" : warningIssueCount > 0 ? "REVIEW" : "PASS";
  return {
    status,
    checkedRecommendations: recommendations.length,
    issueCount: issues.length,
    criticalIssueCount,
    warningIssueCount,
    issues,
    explanation: status === "PASS" ? "Las recomendaciones son coherentes, explicables, trazables y mantienen la ejecuci\xF3n bajo gobierno." : status === "REVIEW" ? "Las recomendaciones son utilizables, pero requieren revisi\xF3n de calidad antes de ampliar su uso." : "La capa de Intelligence presenta inconsistencias que deben resolverse antes de confiar en sus recomendaciones."
  };
}

// packages/intelligence-core/src/orchestrator.ts
var CAPABILITY_PERMISSION = {
  VISION: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  },
  SEARCH: {
    permission: INTELLIGENCE_PERMISSION.SEARCH_EXTERNAL,
    actionClass: "READ"
  },
  VERIFICATION: {
    permission: INTELLIGENCE_PERMISSION.VERIFY,
    actionClass: "ANALYZE"
  },
  PRODUCT_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  },
  BRAND_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  },
  CATALOG_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  },
  DOCUMENT_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.EXTRACT,
    actionClass: "ANALYZE"
  },
  REPORT_GENERATION: {
    permission: INTELLIGENCE_PERMISSION.GENERATE,
    actionClass: "PROPOSE"
  },
  CREATIVE_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.GENERATE,
    actionClass: "PROPOSE"
  },
  IMAGE_TRANSFORMATION: {
    permission: INTELLIGENCE_PERMISSION.GENERATE,
    actionClass: "PROPOSE"
  },
  CUSTOMER_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  },
  MARKETING_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  },
  CONVERSATION_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  },
  ANALYTICS: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  },
  AUTOMATION: {
    permission: INTELLIGENCE_PERMISSION.PREPARE_ACTION,
    actionClass: "PROPOSE"
  },
  AUDIT_INTELLIGENCE: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  },
  ASSISTANT: {
    permission: INTELLIGENCE_PERMISSION.ANALYZE,
    actionClass: "ANALYZE"
  }
};
function scopeFromContext(context) {
  return {
    ...context.businessLine === void 0 ? {} : { businessLine: context.businessLine },
    ...context.type === "GLOBAL" ? {} : { domain: context.type.toLowerCase() },
    ...context.type === "GLOBAL" ? {} : { entityType: context.type },
    ...context.entityId === void 0 ? {} : { entityId: context.entityId }
  };
}
function uniqueCapabilities(capabilities) {
  return [...new Set(capabilities)];
}
function buildIntelligenceOrchestrationPlan(context, intent) {
  const requested = uniqueCapabilities(intent.requestedCapabilities);
  const capabilities = intent.requiresVerification && !requested.includes("VERIFICATION") ? [...requested, "VERIFICATION"] : requested;
  const scope = scopeFromContext(context);
  const permissionRequests = [
    {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      actionClass: "READ",
      scope
    }
  ];
  for (const capability of capabilities) {
    const requirement = CAPABILITY_PERMISSION[capability];
    if (!permissionRequests.some(
      (request) => request.permission === requirement.permission && request.actionClass === requirement.actionClass
    )) {
      permissionRequests.push({
        permission: requirement.permission,
        actionClass: requirement.actionClass,
        scope
      });
    }
  }
  return {
    capabilities,
    permissionRequests
  };
}
function emptyExecution(plan, permissionDecisions, request, status, messages) {
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
        expectedOutput: request.intent.expectedOutput
      },
      evidenceIds: [],
      candidateIds: [],
      recommendationIds: [],
      messages
    }
  };
}
function findHandler(handlers, capability) {
  return handlers.find((handler) => handler.capability === capability);
}
async function orchestrateIntelligenceRequest(dependencies, request) {
  const plan = buildIntelligenceOrchestrationPlan(request.context, request.intent);
  const permissionDecisions = plan.permissionRequests.map(
    (permissionRequest) => evaluatePermission(request.principal, permissionRequest)
  );
  const denied = permissionDecisions.find((decision) => !decision.allowed);
  if (denied) {
    return emptyExecution(
      plan,
      permissionDecisions,
      request,
      "PERMISSION_DENIED",
      [
        `Permission denied: ${denied.permission} (${denied.reason}).`,
        "No Intelligence capability was executed."
      ]
    );
  }
  const duplicateHandlerCapability = dependencies.handlers.find(
    (handler, index, all) => all.findIndex((candidate) => candidate.capability === handler.capability) !== index
  );
  if (duplicateHandlerCapability) {
    return emptyExecution(
      plan,
      permissionDecisions,
      request,
      "DEPENDENCY_FAILED",
      [
        `Duplicate capability handler: ${duplicateHandlerCapability.capability}.`,
        "No Intelligence capability was executed."
      ]
    );
  }
  const missingCapability = plan.capabilities.find(
    (capability) => !findHandler(dependencies.handlers, capability)
  );
  if (missingCapability) {
    return emptyExecution(
      plan,
      permissionDecisions,
      request,
      "DEPENDENCY_FAILED",
      [
        `Missing capability handler: ${missingCapability}.`,
        "No Intelligence capability was executed."
      ]
    );
  }
  const evidence = [];
  const candidates = [];
  const recommendations = [];
  const executedCapabilities = [];
  const messages = [];
  for (const capability of plan.capabilities) {
    const handler = findHandler(dependencies.handlers, capability);
    if (!handler) {
      return emptyExecution(
        plan,
        permissionDecisions,
        request,
        "DEPENDENCY_FAILED",
        [`Capability handler disappeared during orchestration: ${capability}.`]
      );
    }
    let output;
    try {
      output = await handler.execute({
        requestId: request.requestId,
        correlationId: request.correlationId,
        requestedBy: request.requestedBy,
        context: request.context,
        intent: request.intent,
        priorEvidence: [...evidence]
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
          status: "DEPENDENCY_FAILED",
          data: {
            requestId: request.requestId,
            expectedOutput: request.intent.expectedOutput
          },
          evidenceIds: evidence.map((item) => item.evidenceId),
          candidateIds: candidates.map((item) => item.candidateId),
          recommendationIds: recommendations.map(
            (item) => item.recommendationId
          ),
          messages: [
            ...messages,
            `Capability failed: ${capability}.`,
            error instanceof Error ? error.message : "Unknown capability failure."
          ]
        }
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
          status: "DEPENDENCY_FAILED",
          data: {
            requestId: request.requestId,
            expectedOutput: request.intent.expectedOutput
          },
          evidenceIds: evidence.map((item) => item.evidenceId),
          candidateIds: candidates.map((item) => item.candidateId),
          recommendationIds: recommendations.map(
            (item) => item.recommendationId
          ),
          messages: [
            ...messages,
            `Capability handler mismatch: expected ${capability}, received ${output.capability}.`
          ]
        }
      };
    }
    executedCapabilities.push(capability);
    evidence.push(...output.evidence);
    candidates.push(...output.candidates);
    recommendations.push(...output.recommendations);
    messages.push(...output.messages);
  }
  const hasHumanReview = recommendations.some(
    (recommendation) => recommendation.risk.requiresHumanReview
  );
  const hasAnyOutput = evidence.length > 0 || candidates.length > 0 || recommendations.length > 0 || messages.length > 0;
  const status = hasHumanReview ? "REQUIRES_REVIEW" : hasAnyOutput ? "SUCCESS" : "NO_RESULT";
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
        expectedOutput: request.intent.expectedOutput
      },
      evidenceIds: evidence.map((item) => item.evidenceId),
      candidateIds: candidates.map((item) => item.candidateId),
      recommendationIds: recommendations.map((item) => item.recommendationId),
      messages
    }
  };
}

// packages/intelligence-core/src/provider-ports.ts
function validateToolDescriptor(descriptor, expectedKind) {
  const issues = [];
  if (!descriptor.toolId.trim()) issues.push("TOOL_ID_REQUIRED");
  if (!descriptor.name.trim()) issues.push("TOOL_NAME_REQUIRED");
  if (!descriptor.version.trim()) issues.push("TOOL_VERSION_REQUIRED");
  if (!descriptor.description.trim()) issues.push("TOOL_DESCRIPTION_REQUIRED");
  if (descriptor.kind !== expectedKind) issues.push("TOOL_KIND_MISMATCH");
  return issues;
}

// packages/intelligence-core/src/provider-capability-matrix.ts
var PROVIDER_CAPABILITY_MATRIX = {
  VISION: {
    implementation: "ABSTRACT_ONLY",
    requiredPorts: [],
    optionalPorts: []
  },
  SEARCH: {
    implementation: "ABSTRACT_ONLY",
    requiredPorts: [],
    optionalPorts: []
  },
  VERIFICATION: {
    implementation: "ABSTRACT_ONLY",
    requiredPorts: [],
    optionalPorts: []
  },
  PRODUCT_INTELLIGENCE: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: []
  },
  BRAND_INTELLIGENCE: {
    implementation: "IMPLEMENTED",
    requiredPorts: ["SearchPort", "VisionPort"],
    optionalPorts: []
  },
  CATALOG_INTELLIGENCE: {
    implementation: "ABSTRACT_ONLY",
    requiredPorts: [],
    optionalPorts: []
  },
  DOCUMENT_INTELLIGENCE: {
    implementation: "IMPLEMENTED",
    requiredPorts: ["DocumentExtractionPort"],
    optionalPorts: ["VisionPort", "SearchPort"]
  },
  REPORT_GENERATION: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: ["ReportGenerationPort"]
  },
  CREATIVE_INTELLIGENCE: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: ["ImageGenerationPort"]
  },
  IMAGE_TRANSFORMATION: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: ["ImageTransformationPort"]
  },
  CUSTOMER_INTELLIGENCE: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: []
  },
  MARKETING_INTELLIGENCE: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: []
  },
  CONVERSATION_INTELLIGENCE: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: []
  },
  ANALYTICS: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: []
  },
  AUTOMATION: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: []
  },
  AUDIT_INTELLIGENCE: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: []
  },
  ASSISTANT: {
    implementation: "IMPLEMENTED",
    requiredPorts: [],
    optionalPorts: ["ModelPort"]
  }
};
function getProviderCapabilityBinding(capability) {
  return PROVIDER_CAPABILITY_MATRIX[capability];
}

// packages/intelligence-core/src/control-plane.ts
function buildControlledActionRequest(recommendation, decision, mapping) {
  const reasons = [];
  if (decision.decision !== "APPROVE") {
    reasons.push("HUMAN_DECISION_NOT_APPROVED");
  }
  if (!decision.recommendationId) {
    reasons.push("DECISION_RECOMMENDATION_REQUIRED");
  } else if (decision.recommendationId !== recommendation.recommendationId) {
    reasons.push("DECISION_RECOMMENDATION_MISMATCH");
  }
  if (decision.correlationId !== recommendation.correlationId) {
    reasons.push("CORRELATION_MISMATCH");
  }
  if (recommendation.status === "REJECTED" || recommendation.status === "SUPERSEDED") {
    reasons.push("RECOMMENDATION_NOT_ACTIONABLE");
  }
  if (!mapping.operationCode.trim()) {
    reasons.push("OPERATION_CODE_REQUIRED");
  }
  if (!mapping.operationKey.trim()) {
    reasons.push("OPERATION_KEY_REQUIRED");
  }
  if (reasons.length > 0) {
    return { ok: false, reasons };
  }
  return {
    ok: true,
    request: {
      correlationId: recommendation.correlationId,
      recommendationId: recommendation.recommendationId,
      decisionId: decision.decisionId,
      operationCode: mapping.operationCode,
      operationKey: mapping.operationKey,
      requestPayload: mapping.requestPayload
    }
  };
}
async function prepareApprovedRecommendationForControlPlane(input) {
  const built = buildControlledActionRequest(
    input.recommendation,
    input.decision,
    input.mapping
  );
  if (!built.ok) {
    return {
      status: "BLOCKED",
      reasons: built.reasons
    };
  }
  const validation = await input.controlPlane.validateOperationPayload(
    built.request.operationCode,
    built.request.requestPayload
  );
  if (!validation.valid) {
    return {
      status: "BLOCKED",
      request: built.request,
      validation,
      reasons: ["CONTROL_PLANE_PAYLOAD_INVALID"]
    };
  }
  const preview = await input.controlPlane.prepareOperation(
    built.request.operationKey,
    built.request.operationCode,
    built.request.requestPayload
  );
  return {
    status: "READY_FOR_CONFIRMATION",
    request: built.request,
    validation,
    preview,
    reasons: []
  };
}
async function confirmPreparedControlPlaneIntent(input) {
  if (input.preparation.status !== "READY_FOR_CONFIRMATION" || !input.preparation.preview) {
    throw new Error("CONTROL_PLANE_PREPARATION_NOT_CONFIRMABLE");
  }
  if (!input.confirmationToken.trim()) {
    throw new Error("CONFIRMATION_TOKEN_REQUIRED");
  }
  if (input.confirmationToken !== input.preparation.preview.confirmationToken) {
    throw new Error("CONFIRMATION_TOKEN_MISMATCH");
  }
  return input.controlPlane.confirmOperation(
    input.preparation.preview.intentId,
    input.confirmationToken
  );
}

// packages/intelligence-core/src/review-queue.ts
var PRIORITY_WEIGHT = {
  P0: 4,
  P1: 3,
  P2: 2,
  P3: 1,
  P4: 0
};
function decisionToStatus(decision) {
  if (decision === "APPROVE") return "APPROVED";
  if (decision === "REJECT") return "REJECTED";
  if (decision === "REPLACE") return "REPLACED";
  return "DEFERRED";
}
function recommendationStatus(recommendation, decision) {
  if (decision) return decisionToStatus(decision.decision);
  if (recommendation.status === "SUPERSEDED") return "SUPERSEDED";
  if (recommendation.status === "REJECTED") return "REJECTED";
  if (recommendation.status === "APPROVED") return "APPROVED";
  return "PENDING";
}
function recommendationDecisionRef(decision) {
  return {
    decisionId: decision.decisionId,
    decision: decision.decision,
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
    reason: decision.reason
  };
}
function reviewItemFromRecommendation(input) {
  const { recommendation, decision } = input;
  if (decision && decision.recommendationId && decision.recommendationId !== recommendation.recommendationId) {
    throw new Error("REVIEW_DECISION_RECOMMENDATION_MISMATCH");
  }
  if (decision && decision.correlationId !== recommendation.correlationId) {
    throw new Error("REVIEW_DECISION_CORRELATION_MISMATCH");
  }
  return {
    reviewId: `INTELLIGENCE_RECOMMENDATION:${recommendation.recommendationId}`,
    sourceKind: "INTELLIGENCE_RECOMMENDATION",
    sourceRecordId: recommendation.recommendationId,
    correlationId: recommendation.correlationId,
    title: recommendation.title,
    summary: recommendation.explanation,
    priority: recommendation.priority,
    riskLevel: recommendation.risk.level,
    status: recommendationStatus(recommendation, decision),
    requiresHumanDecision: recommendation.risk.requiresHumanReview,
    entity: recommendation.context.entityId ? {
      entityType: recommendation.context.type,
      entityId: recommendation.context.entityId
    } : {
      entityType: recommendation.context.type
    },
    evidence: recommendation.evidenceIds.map((evidenceId) => ({ evidenceId })),
    ...decision ? { existingDecision: recommendationDecisionRef(decision) } : {},
    createdAt: recommendation.createdAt,
    sourceMetadata: {
      actionType: recommendation.actionType,
      source: recommendation.source,
      confidence: recommendation.confidence.score
    }
  };
}
function reviewItemFromReconciliation(input) {
  return {
    reviewId: `PRODUCT_RECONCILIATION:${input.resultId}`,
    sourceKind: "PRODUCT_RECONCILIATION",
    sourceRecordId: input.resultId,
    correlationId: input.correlationId,
    title: input.title,
    summary: input.summary,
    priority: input.reviewRequired && (input.confidence ?? 0) < 0.7 ? "P1" : "P2",
    riskLevel: input.reviewRequired ? "R3" : "R1",
    status: input.status,
    requiresHumanDecision: input.reviewRequired,
    ...input.entity ? { entity: input.entity } : {},
    evidence: input.evidence ?? [],
    ...input.existingDecision ? { existingDecision: input.existingDecision } : {},
    createdAt: input.createdAt,
    sourceMetadata: {
      ...input.sourceMetadata ?? {},
      ...input.confidence === void 0 ? {} : { confidence: input.confidence }
    }
  };
}
function reviewItemFromGenericSource(input) {
  return {
    reviewId: `${input.sourceKind}:${input.sourceRecordId}`,
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    correlationId: input.correlationId,
    title: input.title,
    summary: input.summary,
    priority: input.priority ?? "P2",
    riskLevel: input.riskLevel ?? "UNKNOWN",
    status: input.status,
    requiresHumanDecision: input.requiresHumanDecision,
    ...input.entity ? { entity: input.entity } : {},
    evidence: input.evidence ?? [],
    ...input.existingDecision ? { existingDecision: input.existingDecision } : {},
    createdAt: input.createdAt,
    sourceMetadata: input.sourceMetadata ?? {}
  };
}
function buildUnifiedHumanReviewQueue(input) {
  const items = [
    ...(input.recommendations ?? []).map(reviewItemFromRecommendation),
    ...(input.reconciliations ?? []).map(reviewItemFromReconciliation),
    ...(input.otherSources ?? []).map(reviewItemFromGenericSource)
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (seen.has(item.reviewId)) {
      throw new Error(`DUPLICATE_REVIEW_ID:${item.reviewId}`);
    }
    seen.add(item.reviewId);
  }
  const filter = input.filter;
  const filtered = items.filter((item) => {
    if (filter?.sourceKinds && !filter.sourceKinds.includes(item.sourceKind)) {
      return false;
    }
    if (filter?.statuses && !filter.statuses.includes(item.status)) {
      return false;
    }
    if (filter?.minimumPriority && PRIORITY_WEIGHT[item.priority] < PRIORITY_WEIGHT[filter.minimumPriority]) {
      return false;
    }
    if (filter?.requiresHumanDecisionOnly && !item.requiresHumanDecision) {
      return false;
    }
    return true;
  });
  return filtered.sort((a, b) => {
    const priorityDelta = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return a.createdAt.localeCompare(b.createdAt);
  });
}
function assertReviewItemDoesNotAuthorizeExecution(item) {
  if ("execute" in item.sourceMetadata || "publish" in item.sourceMetadata) {
    throw new Error("REVIEW_ITEM_EXECUTION_AUTHORITY_FORBIDDEN");
  }
  return true;
}

// packages/intelligence-core/src/context-resolver.ts
var ASSISTANT_CONTEXT_TYPES = [
  "PRODUCT",
  "BRAND",
  "SUPPLIER",
  "CATALOG",
  "INVENTORY",
  "PRICING",
  "PURCHASE",
  "SALE",
  "FINANCE",
  "AUDIT",
  "CUSTOMER",
  "MARKETING",
  "CONVERSATION"
];
function scopeFromQuery(query) {
  return {
    domain: query.type.toLowerCase(),
    entityType: query.type,
    ...query.entityId === void 0 ? {} : { entityId: query.entityId },
    ...query.businessLine === void 0 ? {} : { businessLine: query.businessLine }
  };
}
function readPermissionRequest(query) {
  return {
    permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
    actionClass: "READ",
    scope: scopeFromQuery(query)
  };
}
function sourcesForType(sources, type) {
  return sources.filter((source) => source.type === type);
}
async function resolveAssistantContext(dependencies, request) {
  const permissionDecision = evaluatePermission(
    request.principal,
    readPermissionRequest(request.query)
  );
  if (!permissionDecision.allowed) {
    return {
      status: "PERMISSION_DENIED",
      query: request.query,
      permissionDecision,
      messages: [
        `Context read denied: ${permissionDecision.permission} (${permissionDecision.reason}).`,
        "No context source was executed."
      ]
    };
  }
  const matchingSources = sourcesForType(
    dependencies.sources,
    request.query.type
  );
  if (matchingSources.length === 0) {
    return {
      status: "DEPENDENCY_FAILED",
      query: request.query,
      permissionDecision,
      messages: [
        `Missing context source for ${request.query.type}.`,
        "No context projection was produced."
      ]
    };
  }
  if (matchingSources.length > 1) {
    return {
      status: "DEPENDENCY_FAILED",
      query: request.query,
      permissionDecision,
      messages: [
        `Duplicate context sources for ${request.query.type}.`,
        "Context resolution requires exactly one source per type."
      ]
    };
  }
  const source = matchingSources[0];
  if (!source) {
    return {
      status: "DEPENDENCY_FAILED",
      query: request.query,
      permissionDecision,
      messages: ["Context source disappeared during resolution."]
    };
  }
  let projection;
  try {
    projection = await source.resolve({
      requestedBy: request.requestedBy,
      query: request.query
    });
  } catch (error) {
    return {
      status: "DEPENDENCY_FAILED",
      query: request.query,
      permissionDecision,
      messages: [
        `Context source failed for ${request.query.type}.`,
        error instanceof Error ? error.message : "Unknown context source failure."
      ]
    };
  }
  const context = {
    contextId: request.query.contextId,
    type: request.query.type,
    ...request.query.entityId === void 0 ? {} : { entityId: request.query.entityId },
    ...request.query.businessLine === void 0 ? {} : { businessLine: request.query.businessLine },
    attributes: projection.attributes
  };
  return {
    status: "SUCCESS",
    query: request.query,
    permissionDecision,
    context,
    source: projection.source,
    messages: [`Context resolved from ${projection.source}.`]
  };
}
async function resolveAssistantContextBundle(dependencies, request) {
  if (request.queries.length === 0) {
    return {
      status: "NO_CONTEXT",
      resolutions: [],
      contexts: [],
      messages: ["No context queries were requested."]
    };
  }
  const resolutions = [];
  for (const query of request.queries) {
    resolutions.push(
      await resolveAssistantContext(dependencies, {
        requestedBy: request.requestedBy,
        principal: request.principal,
        query
      })
    );
  }
  const successful = resolutions.filter(
    (resolution) => resolution.status === "SUCCESS"
  );
  const contexts = successful.flatMap(
    (resolution) => resolution.context === void 0 ? [] : [resolution.context]
  );
  if (successful.length === resolutions.length) {
    return {
      status: "SUCCESS",
      resolutions,
      contexts,
      messages: ["All requested contexts were resolved."]
    };
  }
  if (successful.length > 0) {
    return {
      status: "PARTIAL_SUCCESS",
      resolutions,
      contexts,
      messages: [
        `${successful.length} of ${resolutions.length} requested contexts were resolved.`
      ]
    };
  }
  const hasPermissionDenied = resolutions.some(
    (resolution) => resolution.status === "PERMISSION_DENIED"
  );
  return {
    status: hasPermissionDenied ? "PERMISSION_DENIED" : "DEPENDENCY_FAILED",
    resolutions,
    contexts: [],
    messages: hasPermissionDenied ? ["No requested context could be resolved because at least one read was denied."] : ["No requested context could be resolved because context dependencies failed."]
  };
}

// packages/intelligence-core/src/assistant.ts
function assistantIntent(prompt) {
  return {
    intentId: "lihen-assistant-answer",
    name: "LIHEN Assistant answer",
    description: prompt,
    requestedCapabilities: ["ASSISTANT"],
    requiresVerification: false,
    expectedOutput: "ANSWER"
  };
}
function modelMessages(prompt, context) {
  const governedContext = JSON.stringify(
    context,
    null,
    2
  );
  return [
    {
      role: "SYSTEM",
      content: [
        "You are LIHEN Assistant.",
        "Use only the governed context supplied below.",
        "Do not invent missing business facts.",
        "Do not claim authority to mutate master data, publish, post finance, change inventory or execute controlled operations.",
        "",
        "GOVERNED_CONTEXT:",
        governedContext
      ].join("\n")
    },
    {
      role: "USER",
      content: prompt
    }
  ];
}
function providerFailureStatus(result) {
  return result.status === "UNAVAILABLE" || result.status === "RATE_LIMITED" ? "PROVIDER_FAILED" : "PROVIDER_FAILED";
}
function mapOrchestrationStatus(status) {
  switch (status) {
    case "SUCCESS":
      return "SUCCESS";
    case "NO_RESULT":
      return "NO_RESULT";
    case "REQUIRES_REVIEW":
      return "REQUIRES_REVIEW";
    case "PERMISSION_DENIED":
    case "POLICY_BLOCKED":
      return "PERMISSION_DENIED";
    default:
      return "DEPENDENCY_FAILED";
  }
}
async function runLihenAssistantTurn(dependencies, request) {
  const prompt = request.prompt.trim();
  if (!prompt) {
    return {
      status: "NO_RESULT",
      recommendations: [],
      messages: ["Assistant prompt is required."]
    };
  }
  const contextResolution = await resolveAssistantContext(
    dependencies.context,
    {
      requestedBy: request.requestedBy,
      principal: request.principal,
      query: request.contextQuery
    }
  );
  if (contextResolution.status !== "SUCCESS" || contextResolution.context === void 0) {
    return {
      status: contextResolution.status === "PERMISSION_DENIED" ? "PERMISSION_DENIED" : "DEPENDENCY_FAILED",
      recommendations: [],
      messages: contextResolution.messages
    };
  }
  if (!dependencies.model) {
    return {
      status: "PROVIDER_NOT_CONFIGURED",
      context: contextResolution.context,
      ...contextResolution.source === void 0 ? {} : { contextSource: contextResolution.source },
      recommendations: [],
      messages: [
        "LIHEN Assistant context is ready, but no ModelPort adapter is configured.",
        "No provider call, recommendation or controlled action was executed."
      ]
    };
  }
  let answer = "";
  let providerMessages = [];
  const assistantHandler = {
    capability: "ASSISTANT",
    async execute(input) {
      const result = await dependencies.model.complete({
        correlationId: input.correlationId,
        requestedBy: input.requestedBy,
        context: input.context,
        messages: modelMessages(
          prompt,
          input.context
        ),
        responseFormat: "TEXT",
        temperature: 0.2
      });
      providerMessages = result.messages;
      if (result.status !== "SUCCESS" || result.data === void 0) {
        throw new Error(
          `ASSISTANT_MODEL_${providerFailureStatus(result)}: ${result.messages.join(" ") || result.status}`
        );
      }
      answer = result.data.text;
      return {
        capability: "ASSISTANT",
        evidence: [],
        candidates: [],
        recommendations: [],
        messages: [
          ...result.messages,
          "Assistant answer generated from governed context."
        ]
      };
    }
  };
  const orchestratorDependencies = {
    handlers: [assistantHandler]
  };
  const orchestration = await orchestrateIntelligenceRequest(
    orchestratorDependencies,
    {
      requestId: request.requestId,
      correlationId: request.correlationId,
      requestedBy: request.requestedBy,
      principal: request.principal,
      context: contextResolution.context,
      intent: assistantIntent(prompt)
    }
  );
  const status = mapOrchestrationStatus(orchestration.result.status);
  if (orchestration.result.status === "DEPENDENCY_FAILED" && orchestration.result.messages.some(
    (message) => message.includes("ASSISTANT_MODEL_")
  )) {
    return {
      status: "PROVIDER_FAILED",
      context: contextResolution.context,
      ...contextResolution.source === void 0 ? {} : { contextSource: contextResolution.source },
      orchestration,
      recommendations: orchestration.recommendations,
      messages: [
        ...providerMessages,
        ...orchestration.result.messages
      ]
    };
  }
  return {
    status,
    ...answer.trim() ? { answer } : {},
    context: contextResolution.context,
    ...contextResolution.source === void 0 ? {} : { contextSource: contextResolution.source },
    orchestration,
    recommendations: orchestration.recommendations,
    messages: orchestration.result.messages
  };
}
async function prepareLihenAssistantRecommendation(request) {
  return prepareApprovedRecommendationForControlPlane(request);
}

// packages/intelligence-core/src/capabilities/brand-intelligence.ts
function requireText(value, label) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}
function confidenceFrom(score) {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error("Brand Intelligence confidenceScore must be between 0 and 1.");
  }
  const band = score >= 0.9 ? "VERY_HIGH" : score >= 0.75 ? "HIGH" : score >= 0.5 ? "MEDIUM" : score >= 0.25 ? "LOW" : "VERY_LOW";
  return {
    score,
    band,
    rationale: [`Normalized Brand Intelligence confidence: ${score.toFixed(2)}.`]
  };
}
function sourceAuthorityLevel(source) {
  if (source.status === "INACTIVE") return "UNVERIFIED";
  if (source.sourceRole === "OFFICIAL_BRAND") {
    return source.trustTier === "TIER_3" ? "FIRST_PARTY" : "OFFICIAL";
  }
  if (source.sourceRole === "OFFICIAL_PRODUCT_COLLECTION") {
    return source.trustTier === "TIER_3" ? "TRUSTED_SECONDARY" : "FIRST_PARTY";
  }
  if (source.sourceRole === "AUTHORIZED_SUPPLIER") {
    return source.trustTier === "TIER_3" ? "SUPPLIER" : "VERIFIED_PARTNER";
  }
  return source.trustTier === "TIER_3" ? "UNVERIFIED" : "TRUSTED_SECONDARY";
}
function resolveBrandSourceAuthority(source) {
  const sourceName = requireText(source.sourceName, "Brand source name");
  const sourceUri = requireText(source.sourceUrl, "Brand source URL");
  const level = sourceAuthorityLevel(source);
  return {
    level,
    sourceName,
    sourceUri,
    rationale: [
      `Role=${source.sourceRole}.`,
      `Trust=${source.trustTier}.`,
      `Rights=${source.mediaRightsBasis}.`,
      `Status=${source.status}.`
    ]
  };
}
function findProtectedManualAsset(brandId, kind, existingAssets) {
  return existingAssets.find(
    (asset) => asset.brandId === brandId && asset.kind === kind && asset.status === "ACTIVE" && asset.isPrimary && asset.approvalMode === "MANUAL_VERIFIED"
  );
}
function dispositionFor(source, confidenceScore, protectedManual, candidateUrl) {
  if (source.status !== "ACTIVE") return "REJECTED_SOURCE";
  if (protectedManual?.publicUrl === candidateUrl) {
    return "ALREADY_MANUAL_VERIFIED";
  }
  if (protectedManual) return "MANUAL_IDENTITY_PROTECTED";
  const authoritativeSource = source.sourceRole === "OFFICIAL_BRAND" && source.trustTier !== "TIER_3" && source.mediaRightsBasis === "BRAND_AUTHORIZED";
  if (authoritativeSource && confidenceScore >= 0.85) {
    return "VERIFICATION_ELIGIBLE";
  }
  return "REQUIRES_REVIEW";
}
function recommendationText(disposition) {
  switch (disposition) {
    case "REJECTED_SOURCE":
      return {
        actionType: "REVIEW_REJECTED_BRAND_ASSET_SOURCE",
        title: "Review rejected Brand Asset source",
        explanation: "The source is inactive and cannot support a canonical Brand Asset proposal.",
        priority: "P3",
        severity: "WARNING"
      };
    case "MANUAL_IDENTITY_PROTECTED":
      return {
        actionType: "REVIEW_MANUAL_BRAND_ASSET_REPLACEMENT",
        title: "Review proposed replacement of manual Brand identity",
        explanation: "An ACTIVE MANUAL_VERIFIED primary asset already exists for this kind. Intelligence may propose evidence but cannot silently replace it.",
        priority: "P1",
        severity: "WARNING"
      };
    case "ALREADY_MANUAL_VERIFIED":
      return {
        actionType: "KEEP_MANUAL_BRAND_ASSET",
        title: "Keep existing manual Brand identity",
        explanation: "The candidate resolves to the same URL as the ACTIVE MANUAL_VERIFIED primary asset. No canonical replacement is required.",
        priority: "P4",
        severity: "SUCCESS"
      };
    case "VERIFICATION_ELIGIBLE":
      return {
        actionType: "REVIEW_VERIFIED_BRAND_ASSET_CANDIDATE",
        title: "Review high-authority Brand Asset candidate",
        explanation: "The candidate has sufficient source authority and confidence to be verification-eligible, but canonical Brand Asset mutation still requires governed human review.",
        priority: "P2",
        severity: "INFO"
      };
    case "REQUIRES_REVIEW":
      return {
        actionType: "REVIEW_BRAND_ASSET_CANDIDATE",
        title: "Review Brand Asset candidate",
        explanation: "The candidate is evidence-backed but does not satisfy the strict high-authority verification threshold.",
        priority: "P2",
        severity: "INFO"
      };
  }
}
function prepareBrandAssetCandidate(input) {
  const correlationId = requireText(input.correlationId, "Correlation ID");
  const evidenceId = requireText(input.evidenceId, "Evidence ID");
  const candidateId = requireText(input.candidateId, "Candidate ID");
  const recommendationId = requireText(
    input.recommendationId,
    "Recommendation ID"
  );
  const brandId = requireText(input.brandId, "Brand ID");
  const candidateUrl = requireText(input.candidateUrl, "Candidate URL");
  const fingerprint = requireText(input.fingerprint, "Evidence fingerprint");
  const observation = requireText(input.observation, "Evidence observation");
  const createdAt = requireText(input.createdAt, "Created at");
  const mismatchedAsset = input.existingAssets.find(
    (asset) => asset.brandId !== brandId
  );
  if (mismatchedAsset) {
    throw new Error(
      "All existing Brand Asset snapshots must belong to the requested brandId."
    );
  }
  const confidence = confidenceFrom(input.confidenceScore);
  const sourceAuthority3 = resolveBrandSourceAuthority(input.source);
  const protectedManual = findProtectedManualAsset(
    brandId,
    input.assetKind,
    input.existingAssets
  );
  const disposition = dispositionFor(
    input.source,
    confidence.score,
    protectedManual,
    candidateUrl
  );
  const context = {
    contextId: `brand:${brandId}`,
    type: "BRAND",
    entityId: brandId,
    attributes: {}
  };
  const evidence = {
    evidenceId,
    correlationId,
    context,
    capability: "BRAND_INTELLIGENCE",
    sourceAuthority: sourceAuthority3,
    observation,
    payload: {
      brandId,
      assetKind: input.assetKind,
      candidateUrl,
      sourceRole: input.source.sourceRole,
      trustTier: input.source.trustTier,
      mediaRightsBasis: input.source.mediaRightsBasis,
      disposition
    },
    confidence,
    fingerprint,
    createdAt
  };
  const candidatePayload = {
    brandId,
    assetKind: input.assetKind,
    candidateUrl,
    sourceUrl: input.source.sourceUrl,
    sourceRole: input.source.sourceRole,
    trustTier: input.source.trustTier,
    mediaRightsBasis: input.source.mediaRightsBasis,
    disposition
  };
  if (protectedManual) {
    candidatePayload.protectedManualAssetId = protectedManual.id;
  }
  const candidate = {
    candidateId,
    correlationId,
    type: "BRAND_ASSET",
    context,
    payload: candidatePayload,
    evidenceIds: [evidenceId],
    confidence,
    status: "IN_REVIEW",
    createdAt
  };
  const message = recommendationText(disposition);
  const requiresHumanReview = disposition !== "ALREADY_MANUAL_VERIFIED";
  const recommendation = {
    recommendationId,
    correlationId,
    context,
    actionType: message.actionType,
    title: message.title,
    explanation: message.explanation,
    priority: message.priority,
    severity: message.severity,
    source: "BRAND_INTELLIGENCE",
    rationale: [
      ...sourceAuthority3.rationale,
      `Disposition=${disposition}.`,
      ...protectedManual ? [`Protected manual asset=${protectedManual.id}.`] : [],
      "Confidence is evidence quality, not authorization."
    ],
    evidenceIds: [evidenceId],
    confidence,
    risk: {
      level: requiresHumanReview ? "R3" : "R0",
      reasons: requiresHumanReview ? [
        "Canonical Brand Asset changes are governed mutations.",
        "Human review precedes any controlled mutation."
      ] : ["No canonical mutation is required."],
      requiresHumanReview
    },
    status: "OPEN",
    createdAt
  };
  const output = {
    disposition,
    sourceAuthority: sourceAuthority3,
    evidence,
    candidate,
    recommendation
  };
  if (protectedManual) {
    return { ...output, protectedManualAssetId: protectedManual.id };
  }
  return output;
}

// packages/intelligence-core/src/capabilities/document-intelligence.ts
var DEFAULT_REVIEW_THRESHOLD = 0.75;
var SUPPLIER_RECORD_EXTRACTION_SCHEMA = Object.freeze({
  type: "object",
  required: ["records"],
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        required: ["sourceRowKey"],
        properties: {
          sourceRowKey: { type: "string" },
          sourcePage: { type: ["integer", "null"] },
          sourceSlot: { type: ["string", "null"] },
          rawText: { type: ["string", "null"] },
          supplierReference: { type: ["string", "null"] },
          productName: { type: ["string", "null"] },
          brandText: { type: ["string", "null"] },
          categoryText: { type: ["string", "null"] },
          subcategoryText: { type: ["string", "null"] },
          businessLine: {
            type: ["string", "null"],
            enum: ["BEAUTY_CARE", "STYLE", null]
          },
          unitCost: { type: ["number", "null"], minimum: 0 },
          suggestedSalePrice: { type: ["number", "null"], minimum: 0 },
          quantityHint: { type: ["integer", "null"], minimum: 0 },
          imageReference: { type: ["string", "null"] },
          extractionConfidence: {
            type: ["number", "null"],
            minimum: 0,
            maximum: 1
          }
        }
      }
    }
  }
});
function requiredText(value, code) {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function nullableText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}
function nullableNonNegativeNumber(value, code) {
  if (value === null || value === void 0) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(code);
  }
  return value;
}
function nullableInteger(value, code) {
  if (value === null || value === void 0) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(code);
  }
  return value;
}
function confidenceFrom2(score) {
  const normalized = score ?? 0;
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    throw new Error("DOCUMENT_INTELLIGENCE_CONFIDENCE_INVALID");
  }
  const band = normalized >= 0.9 ? "VERY_HIGH" : normalized >= 0.75 ? "HIGH" : normalized >= 0.5 ? "MEDIUM" : normalized >= 0.25 ? "LOW" : "VERY_LOW";
  return {
    score: normalized,
    band,
    rationale: [
      `Normalized Document Intelligence confidence: ${normalized.toFixed(2)}.`,
      "Confidence is evidence quality, not authorization."
    ]
  };
}
function normalizeBusinessLine(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (value === "BEAUTY_CARE" || value === "STYLE") return value;
  throw new Error("DOCUMENT_INTELLIGENCE_BUSINESS_LINE_INVALID");
}
function normalizeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("DOCUMENT_INTELLIGENCE_RECORD_INVALID");
  }
  const record = value;
  const sourceRowKey = requiredText(
    typeof record.sourceRowKey === "string" ? record.sourceRowKey : "",
    "DOCUMENT_INTELLIGENCE_SOURCE_ROW_KEY_REQUIRED"
  );
  const sourcePage = nullableInteger(
    record.sourcePage,
    "DOCUMENT_INTELLIGENCE_SOURCE_PAGE_INVALID"
  );
  if (sourcePage !== null && sourcePage < 0) {
    throw new Error("DOCUMENT_INTELLIGENCE_SOURCE_PAGE_INVALID");
  }
  const quantityHint = nullableInteger(
    record.quantityHint,
    "DOCUMENT_INTELLIGENCE_QUANTITY_INVALID"
  );
  if (quantityHint !== null && quantityHint < 0) {
    throw new Error("DOCUMENT_INTELLIGENCE_QUANTITY_INVALID");
  }
  const extractionConfidence = nullableNonNegativeNumber(
    record.extractionConfidence,
    "DOCUMENT_INTELLIGENCE_CONFIDENCE_INVALID"
  );
  if (extractionConfidence !== null && extractionConfidence > 1) {
    throw new Error("DOCUMENT_INTELLIGENCE_CONFIDENCE_INVALID");
  }
  return {
    sourceRowKey,
    sourcePage,
    sourceSlot: nullableText(record.sourceSlot),
    rawText: nullableText(record.rawText),
    supplierReference: nullableText(record.supplierReference),
    productName: nullableText(record.productName),
    brandText: nullableText(record.brandText),
    categoryText: nullableText(record.categoryText),
    subcategoryText: nullableText(record.subcategoryText),
    businessLine: normalizeBusinessLine(record.businessLine),
    unitCost: nullableNonNegativeNumber(
      record.unitCost,
      "DOCUMENT_INTELLIGENCE_UNIT_COST_INVALID"
    ),
    suggestedSalePrice: nullableNonNegativeNumber(
      record.suggestedSalePrice,
      "DOCUMENT_INTELLIGENCE_SUGGESTED_SALE_PRICE_INVALID"
    ),
    quantityHint,
    imageReference: nullableText(record.imageReference),
    extractionConfidence
  };
}
function recordsFromExtraction(extraction) {
  const rawRecords = extraction.fields.records;
  if (!Array.isArray(rawRecords)) {
    throw new Error("DOCUMENT_INTELLIGENCE_RECORDS_ARRAY_REQUIRED");
  }
  const records = rawRecords.map(normalizeRecord);
  const rowKeys = /* @__PURE__ */ new Set();
  for (const record of records) {
    if (rowKeys.has(record.sourceRowKey)) {
      throw new Error("DOCUMENT_INTELLIGENCE_SOURCE_ROW_KEY_DUPLICATE");
    }
    rowKeys.add(record.sourceRowKey);
  }
  return records;
}
function stableFingerprint(parts) {
  return parts.map((part) => part.trim()).join("|").toLowerCase();
}
function recordStatus(record, threshold) {
  if (!record.productName) return "REVIEW_REQUIRED";
  if (record.extractionConfidence === null || record.extractionConfidence < threshold) {
    return "REVIEW_REQUIRED";
  }
  return "EXTRACTED";
}
function supplierSourceAuthority(sourceName, sourceUri) {
  return {
    level: "SUPPLIER",
    sourceName,
    ...sourceUri ? { sourceUri } : {},
    rationale: [
      "The document is supplier-origin evidence.",
      "Supplier evidence does not become canonical Product/Pricing authority."
    ]
  };
}
function reviewRecommendation(input) {
  return {
    recommendationId: `document-review:${input.correlationId}`,
    correlationId: input.correlationId,
    context: input.context,
    actionType: "REVIEW_DOCUMENT_EXTRACTION",
    title: "Review supplier document extraction",
    explanation: "Document Intelligence produced extraction evidence that requires human review before downstream reconciliation or controlled ingestion decisions.",
    priority: "P2",
    severity: "WARNING",
    source: "DOCUMENT_INTELLIGENCE",
    rationale: [...input.reasons, "No canonical mutation is authorized."],
    evidenceIds: input.evidenceIds,
    confidence: input.confidence,
    risk: {
      level: "R2",
      reasons: [
        "Extraction evidence may contain ambiguity or incomplete product identity.",
        "Review precedes downstream reconciliation and governed mutation."
      ],
      requiresHumanReview: true
    },
    status: "OPEN",
    createdAt: input.createdAt
  };
}
async function executeDocumentIntelligence(tools, input) {
  const correlationId = requiredText(
    input.correlationId,
    "DOCUMENT_INTELLIGENCE_CORRELATION_ID_REQUIRED"
  );
  const documentId = requiredText(
    input.config.documentId,
    "DOCUMENT_INTELLIGENCE_DOCUMENT_ID_REQUIRED"
  );
  const sourceName = requiredText(
    input.config.sourceName,
    "DOCUMENT_INTELLIGENCE_SOURCE_NAME_REQUIRED"
  );
  const schemaVersion = requiredText(
    input.config.extractionSchemaVersion,
    "DOCUMENT_INTELLIGENCE_SCHEMA_VERSION_REQUIRED"
  );
  const createdAt = requiredText(
    input.createdAt,
    "DOCUMENT_INTELLIGENCE_CREATED_AT_REQUIRED"
  );
  if (input.context.type !== "DOCUMENT" && input.context.type !== "SUPPLIER") {
    throw new Error("DOCUMENT_INTELLIGENCE_CONTEXT_INVALID");
  }
  const threshold = input.config.reviewConfidenceThreshold ?? DEFAULT_REVIEW_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error("DOCUMENT_INTELLIGENCE_REVIEW_THRESHOLD_INVALID");
  }
  const providerResult = await tools.document.extract({
    correlationId,
    requestedBy: input.requestedBy,
    context: input.context,
    document: {
      documentRef: documentId,
      ...input.config.sourceUri ? { sourceUri: input.config.sourceUri } : {}
    },
    extractionSchema: {
      ...SUPPLIER_RECORD_EXTRACTION_SCHEMA,
      schemaVersion
    }
  });
  if (providerResult.status === "FAILED" || providerResult.status === "UNAVAILABLE" || providerResult.status === "RATE_LIMITED" || !providerResult.data) {
    throw new Error(
      `DOCUMENT_INTELLIGENCE_PROVIDER_${providerResult.status}`
    );
  }
  const sourceAuthority3 = supplierSourceAuthority(
    sourceName,
    input.config.sourceUri
  );
  const records = recordsFromExtraction(providerResult.data);
  const documentConfidenceScore = records.length === 0 ? 0 : records.reduce(
    (sum, record) => sum + (record.extractionConfidence ?? 0),
    0
  ) / records.length;
  const documentConfidence = confidenceFrom2(documentConfidenceScore);
  const documentEvidenceId = `document:${documentId}:extraction`;
  const documentEvidence = {
    evidenceId: documentEvidenceId,
    correlationId,
    context: input.context,
    capability: "DOCUMENT_INTELLIGENCE",
    sourceAuthority: sourceAuthority3,
    observation: `Structured supplier document extraction produced ${records.length} record(s).`,
    payload: {
      documentId,
      pages: providerResult.data.pages,
      providerStatus: providerResult.status,
      warningCount: providerResult.data.warnings.length,
      schemaVersion
    },
    confidence: documentConfidence,
    fingerprint: stableFingerprint([
      documentId,
      schemaVersion,
      String(records.length),
      ...providerResult.data.pages.map(String)
    ]),
    createdAt
  };
  const recordEvidence = [];
  const preparedRecords = [];
  for (const record of records) {
    const status = recordStatus(record, threshold);
    const evidenceId = `document:${documentId}:record:${record.sourceRowKey}`;
    const confidence = confidenceFrom2(record.extractionConfidence);
    const fingerprint = stableFingerprint([
      documentId,
      record.sourceRowKey,
      record.productName ?? "",
      record.supplierReference ?? "",
      String(record.sourcePage ?? ""),
      String(record.extractionConfidence ?? "")
    ]);
    recordEvidence.push({
      evidenceId,
      correlationId,
      context: input.context,
      capability: "DOCUMENT_INTELLIGENCE",
      sourceAuthority: sourceAuthority3,
      observation: status === "EXTRACTED" ? "Supplier source record extracted with sufficient identity evidence." : "Supplier source record requires review before downstream reconciliation.",
      payload: {
        documentId,
        sourceRowKey: record.sourceRowKey,
        productName: record.productName,
        supplierReference: record.supplierReference,
        sourcePage: record.sourcePage,
        extractionStatus: status
      },
      confidence,
      fingerprint,
      createdAt
    });
    preparedRecords.push({
      documentId,
      ...record,
      extractionStatus: status,
      evidence: {
        correlationId,
        evidenceId,
        fingerprint,
        schemaVersion,
        sourceAuthority: sourceAuthority3.level
      }
    });
  }
  const providerWarnings = [
    ...providerResult.messages,
    ...providerResult.data.warnings
  ];
  const requiresReview = providerResult.status === "PARTIAL" || providerWarnings.length > 0 || preparedRecords.length === 0 || preparedRecords.some((record) => record.extractionStatus !== "EXTRACTED");
  const allEvidenceIds = [
    documentEvidence.evidenceId,
    ...recordEvidence.map((item) => item.evidenceId)
  ];
  const recommendation = requiresReview ? reviewRecommendation({
    correlationId,
    context: input.context,
    evidenceIds: allEvidenceIds,
    createdAt,
    confidence: documentConfidence,
    reasons: [
      `Provider status=${providerResult.status}.`,
      `Warnings=${providerWarnings.length}.`,
      `Prepared records=${preparedRecords.length}.`,
      `Records requiring review=${preparedRecords.filter((record) => record.extractionStatus !== "EXTRACTED").length}.`
    ]
  }) : void 0;
  return {
    documentEvidence,
    recordEvidence,
    preparedRecords,
    ...recommendation ? { recommendation } : {},
    providerWarnings
  };
}
function createDocumentIntelligenceCapabilityHandler(input) {
  return {
    capability: "DOCUMENT_INTELLIGENCE",
    async execute(executionInput) {
      const result = await executeDocumentIntelligence(input.tools, {
        correlationId: executionInput.correlationId,
        requestedBy: executionInput.requestedBy,
        context: executionInput.context,
        config: input.config,
        createdAt: input.createdAt()
      });
      return {
        capability: "DOCUMENT_INTELLIGENCE",
        evidence: [
          result.documentEvidence,
          ...result.recordEvidence
        ],
        candidates: [],
        recommendations: result.recommendation ? [result.recommendation] : [],
        messages: [
          `Prepared ${result.preparedRecords.length} supplier source record(s).`,
          ...result.providerWarnings
        ]
      };
    }
  };
}

// packages/intelligence-core/src/capabilities/product-reconciliation.ts
function requiredText2(value, code) {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function validateScore(score, code) {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(code);
  }
  return score;
}
function confidenceFrom3(score, rationale) {
  const normalized = validateScore(score, "PRODUCT_RECONCILIATION_CONFIDENCE_INVALID");
  const band = normalized >= 0.9 ? "VERY_HIGH" : normalized >= 0.75 ? "HIGH" : normalized >= 0.5 ? "MEDIUM" : normalized >= 0.25 ? "LOW" : "VERY_LOW";
  return {
    score: normalized,
    band,
    rationale: [
      ...rationale,
      "Confidence is evidence quality, never mutation authorization."
    ]
  };
}
function normalizeMatch(match) {
  return {
    productId: requiredText2(
      match.productId,
      "PRODUCT_RECONCILIATION_PRODUCT_ID_REQUIRED"
    ),
    matchKind: match.matchKind,
    confidence: validateScore(
      match.confidence,
      "PRODUCT_RECONCILIATION_MATCH_CONFIDENCE_INVALID"
    ),
    reasons: [...match.reasons],
    ...match.evidenceIds ? { evidenceIds: [...match.evidenceIds] } : {}
  };
}
function uniqueMatches(matches) {
  const normalized = matches.map(normalizeMatch);
  const ids = /* @__PURE__ */ new Set();
  for (const match of normalized) {
    if (ids.has(match.productId)) {
      throw new Error("PRODUCT_RECONCILIATION_DUPLICATE_PRODUCT_CANDIDATE");
    }
    ids.add(match.productId);
  }
  return normalized.sort((left, right) => {
    if (left.confidence !== right.confidence) {
      return right.confidence - left.confidence;
    }
    return left.productId.localeCompare(right.productId);
  });
}
function classify(matches) {
  if (matches.length === 0) {
    return {
      classification: "NEW_PRODUCT",
      proposedProductId: null,
      requiresHumanReview: true,
      confidenceScore: 0,
      rationale: [
        "No Product Master candidate was observed for the supplier source record.",
        "A new-product possibility requires human review before Product Master creation."
      ]
    };
  }
  const conflicts = matches.filter((match2) => match2.matchKind === "CONFLICT");
  if (conflicts.length > 0) {
    return {
      classification: "CONFLICT",
      proposedProductId: null,
      requiresHumanReview: true,
      confidenceScore: Math.max(...conflicts.map((match2) => match2.confidence)),
      rationale: [
        "At least one reconciliation signal reports a product identity conflict.",
        "Conflicting evidence cannot authorize a Product Master assignment."
      ]
    };
  }
  const exact = matches.filter((match2) => match2.matchKind === "EXACT");
  if (exact.length === 1 && matches.length === 1) {
    return {
      classification: "EXACT_MATCH",
      proposedProductId: exact[0].productId,
      requiresHumanReview: true,
      confidenceScore: exact[0].confidence,
      rationale: [
        "A single exact Product Master candidate was observed.",
        "Exact match is still a proposal/evidence result; canonical assignment remains governed."
      ]
    };
  }
  if (exact.length > 1) {
    return {
      classification: "CONFLICT",
      proposedProductId: null,
      requiresHumanReview: true,
      confidenceScore: Math.max(...exact.map((match2) => match2.confidence)),
      rationale: [
        "Multiple exact Product Master candidates were observed.",
        "Multiple exact candidates are contradictory and require human review."
      ]
    };
  }
  const ambiguous = matches.filter((match2) => match2.matchKind === "AMBIGUOUS");
  if (ambiguous.length > 0 || matches.length > 1) {
    return {
      classification: "REVIEW_REQUIRED",
      proposedProductId: null,
      requiresHumanReview: true,
      confidenceScore: matches[0].confidence,
      rationale: [
        "Multiple or explicitly ambiguous Product Master candidates were observed.",
        "Ambiguous reconciliation never autoassigns product_id."
      ]
    };
  }
  const match = matches[0];
  if (match.matchKind === "FUZZY") {
    return {
      classification: "POSSIBLE_MATCH",
      proposedProductId: match.productId,
      requiresHumanReview: true,
      confidenceScore: match.confidence,
      rationale: [
        "A fuzzy Product Master candidate was observed.",
        "Fuzzy reconciliation never autoassigns product_id."
      ]
    };
  }
  return {
    classification: "REVIEW_REQUIRED",
    proposedProductId: null,
    requiresHumanReview: true,
    confidenceScore: match.confidence,
    rationale: [
      "The reconciliation signal cannot be resolved safely by policy.",
      "Human review is required."
    ]
  };
}
function evidenceIdsFor(source, matches) {
  return [
    .../* @__PURE__ */ new Set([
      ...source.evidenceIds,
      ...matches.flatMap((match) => match.evidenceIds ?? [])
    ])
  ];
}
function candidateTypeFor(classification) {
  return classification === "NEW_PRODUCT" ? "NEW_PRODUCT" : "PRODUCT_MATCH";
}
function recommendationAction(classification) {
  if (classification === "NEW_PRODUCT") return "REVIEW_NEW_PRODUCT_CANDIDATE";
  if (classification === "CONFLICT") return "REVIEW_PRODUCT_RECONCILIATION_CONFLICT";
  if (classification === "EXACT_MATCH") return "REVIEW_EXACT_PRODUCT_MATCH";
  return "REVIEW_POSSIBLE_PRODUCT_MATCH";
}
function prepareProductReconciliation(input) {
  const resultId = requiredText2(
    input.resultId,
    "PRODUCT_RECONCILIATION_RESULT_ID_REQUIRED"
  );
  const correlationId = requiredText2(
    input.correlationId,
    "PRODUCT_RECONCILIATION_CORRELATION_ID_REQUIRED"
  );
  const sourceRecordId = requiredText2(
    input.sourceRecord.sourceRecordId,
    "PRODUCT_RECONCILIATION_SOURCE_RECORD_ID_REQUIRED"
  );
  requiredText2(
    input.sourceRecord.sourceRowKey,
    "PRODUCT_RECONCILIATION_SOURCE_ROW_KEY_REQUIRED"
  );
  const createdAt = requiredText2(
    input.createdAt,
    "PRODUCT_RECONCILIATION_CREATED_AT_REQUIRED"
  );
  if (input.context.type !== "PRODUCT" && input.context.type !== "SUPPLIER" && input.context.type !== "DOCUMENT") {
    throw new Error("PRODUCT_RECONCILIATION_CONTEXT_INVALID");
  }
  if (input.sourceRecord.extractionConfidence !== null) {
    validateScore(
      input.sourceRecord.extractionConfidence,
      "PRODUCT_RECONCILIATION_SOURCE_CONFIDENCE_INVALID"
    );
  }
  const matches = uniqueMatches(input.matches);
  const decision = classify(matches);
  const evidenceIds = evidenceIdsFor(input.sourceRecord, matches);
  const confidence = confidenceFrom3(
    decision.confidenceScore,
    decision.rationale
  );
  const candidateId = `product-reconciliation:${resultId}:candidate`;
  const candidate = {
    candidateId,
    correlationId,
    type: candidateTypeFor(decision.classification),
    context: input.context,
    payload: {
      resultId,
      sourceRecordId,
      sourceRowKey: input.sourceRecord.sourceRowKey,
      classification: decision.classification,
      proposedProductId: decision.proposedProductId,
      canAutoAssignProductId: false,
      canAutoCreateProductMaster: false,
      observedMatches: matches.map((match) => ({
        productId: match.productId,
        matchKind: match.matchKind,
        confidence: match.confidence,
        reasons: [...match.reasons]
      }))
    },
    evidenceIds,
    confidence,
    status: "IN_REVIEW",
    createdAt
  };
  const recommendation = {
    recommendationId: `product-reconciliation:${resultId}:review`,
    correlationId,
    context: input.context,
    actionType: recommendationAction(decision.classification),
    title: decision.classification === "NEW_PRODUCT" ? "Review new product candidate" : "Review Product Master reconciliation",
    explanation: decision.rationale.join(" "),
    priority: decision.classification === "CONFLICT" || decision.classification === "REVIEW_REQUIRED" ? "P1" : "P2",
    severity: decision.classification === "CONFLICT" ? "CRITICAL" : "WARNING",
    source: "PRODUCT_RECONCILIATION",
    rationale: [
      ...decision.rationale,
      "The existing source-specific reconciliation decision path remains authoritative.",
      "Existing Control Plane is required for any governed canonical mutation."
    ],
    evidenceIds,
    confidence,
    risk: {
      level: "R3",
      reasons: [
        "Product Master identity is canonical master data.",
        "A reconciliation result cannot authorize mutation by itself."
      ],
      requiresHumanReview: true
    },
    status: "OPEN",
    createdAt
  };
  const reviewCandidate = {
    resultId,
    correlationId,
    title: recommendation.title,
    summary: recommendation.explanation,
    confidence: confidence.score,
    reviewRequired: true,
    status: "PENDING",
    createdAt,
    entity: decision.proposedProductId ? {
      entityType: "PRODUCT",
      entityId: decision.proposedProductId,
      ...input.sourceRecord.productName ? { label: input.sourceRecord.productName } : {}
    } : {
      entityType: "PRODUCT",
      ...input.sourceRecord.productName ? { label: input.sourceRecord.productName } : {}
    },
    evidence: evidenceIds.map((evidenceId) => ({ evidenceId })),
    sourceMetadata: {
      classification: decision.classification,
      sourceRecordId,
      sourceRowKey: input.sourceRecord.sourceRowKey,
      proposedProductId: decision.proposedProductId,
      canAutoAssignProductId: false,
      canAutoCreateProductMaster: false,
      decisionPath: "EXISTING_PRODUCT_RECONCILIATION_DECISIONS",
      mutationBoundary: "EXISTING_CONTROL_PLANE"
    }
  };
  return {
    resultId,
    sourceRecordId,
    classification: decision.classification,
    proposedProductId: decision.proposedProductId,
    canAutoAssignProductId: false,
    canAutoCreateProductMaster: false,
    requiresHumanReview: true,
    confidence,
    candidate,
    recommendation,
    reviewCandidate
  };
}
function evidenceFromPersistedReconciliation(input) {
  const resultId = requiredText2(
    input.resultId,
    "PRODUCT_RECONCILIATION_RESULT_ID_REQUIRED"
  );
  const correlationId = requiredText2(
    input.correlationId,
    "PRODUCT_RECONCILIATION_CORRELATION_ID_REQUIRED"
  );
  const createdAt = requiredText2(
    input.createdAt,
    "PRODUCT_RECONCILIATION_CREATED_AT_REQUIRED"
  );
  const score = input.confidence ?? 0;
  const confidence = confidenceFrom3(score, [
    `Persisted reconciliation classification: ${input.classification}.`
  ]);
  return {
    evidenceId: `product-reconciliation:${resultId}:evidence`,
    correlationId,
    context: input.context,
    capability: "PRODUCT_INTELLIGENCE",
    sourceAuthority: {
      level: "FIRST_PARTY",
      sourceName: "LIHEN Product Master Reconciliation",
      rationale: [
        "The observation comes from the existing LIHEN reconciliation foundation.",
        "Persisted reconciliation evidence is not mutation authorization."
      ]
    },
    observation: input.reason?.trim() || `Existing reconciliation result classified as ${input.classification}.`,
    payload: {
      resultId,
      classification: input.classification,
      observedProductId: input.productId,
      sourcePayload: input.sourcePayload,
      canAutoAssignProductId: false
    },
    confidence,
    fingerprint: [
      resultId,
      input.classification,
      input.productId ?? "",
      String(score)
    ].join("|").toLowerCase(),
    createdAt
  };
}

// packages/intelligence-core/src/capabilities/supplier-price-evidence.ts
function requiredText3(value, code) {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function nullableNonNegative(value, code) {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
  return value;
}
function validateConfidence(value) {
  if (value === null) return 0.5;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("SUPPLIER_PRICE_EVIDENCE_CONFIDENCE_INVALID");
  }
  return value;
}
function confidenceFrom4(score, rationale) {
  const band = score >= 0.9 ? "VERY_HIGH" : score >= 0.75 ? "HIGH" : score >= 0.5 ? "MEDIUM" : score >= 0.25 ? "LOW" : "VERY_LOW";
  return {
    score,
    band,
    rationale: [...rationale, "Confidence is evidence quality, never pricing authorization."]
  };
}
function stableFingerprint2(parts) {
  let hash = 2166136261;
  const value = parts.join("|");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `gap021-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function distinctEvidenceIds(ids) {
  return [...new Set(ids.map((id) => requiredText3(id, "SUPPLIER_PRICE_EVIDENCE_ID_REQUIRED")))];
}
function canonicalProductIdFor(ref) {
  if (ref.classification !== "EXACT_MATCH") return null;
  return ref.proposedProductId ? requiredText3(ref.proposedProductId, "SUPPLIER_PRICE_PRODUCT_ID_REQUIRED") : null;
}
function candidateProductIdFor(ref) {
  if (ref.classification !== "POSSIBLE_MATCH") return null;
  return ref.proposedProductId ? requiredText3(ref.proposedProductId, "SUPPLIER_PRICE_PRODUCT_ID_REQUIRED") : null;
}
function costReferenceFor(baseline) {
  return baseline.previousObservedUnitCost ?? baseline.supplierLastCost ?? baseline.currentCost;
}
function delta(observed, reference) {
  if (observed === null || reference === null) return null;
  return observed - reference;
}
function evidenceFor(input) {
  const payload = {
    kind: input.kind,
    amount: input.amount,
    currency: "COP",
    sourceRecordId: input.observation.sourceRecordId,
    documentId: input.observation.documentId,
    supplierId: input.observation.supplierId,
    canonicalProductId: input.canonicalProductId,
    candidateProductId: input.candidateProductId,
    supplierObservationOnly: true,
    canChangeSalePrice: false
  };
  return {
    evidenceId: input.evidenceId,
    correlationId: input.correlationId,
    context: input.context,
    capability: "PRODUCT_INTELLIGENCE",
    sourceAuthority: {
      level: "SUPPLIER",
      sourceName: "Supplier source document",
      rationale: [
        "The amount was observed in a supplier source record.",
        "Supplier pricing is evidence and not canonical commercial pricing authority."
      ]
    },
    observation: input.kind === "UNIT_COST" ? "Supplier document contains an observed unit cost." : "Supplier document contains a suggested sale price.",
    payload,
    confidence: input.confidence,
    fingerprint: stableFingerprint2([
      input.kind,
      input.observation.documentId,
      input.observation.sourceRecordId,
      String(input.amount),
      input.canonicalProductId ?? "",
      input.candidateProductId ?? ""
    ]),
    createdAt: input.createdAt
  };
}
function prepareSupplierPriceEvidence(input) {
  const correlationId = requiredText3(
    input.correlationId,
    "SUPPLIER_PRICE_CORRELATION_ID_REQUIRED"
  );
  const sourceRecordId = requiredText3(
    input.observation.sourceRecordId,
    "SUPPLIER_PRICE_SOURCE_RECORD_ID_REQUIRED"
  );
  const documentId = requiredText3(
    input.observation.documentId,
    "SUPPLIER_PRICE_DOCUMENT_ID_REQUIRED"
  );
  const observedAt = requiredText3(
    input.observation.observedAt,
    "SUPPLIER_PRICE_OBSERVED_AT_REQUIRED"
  );
  const createdAt = requiredText3(input.createdAt, "SUPPLIER_PRICE_CREATED_AT_REQUIRED");
  const supplierId = input.observation.supplierId?.trim() || null;
  const unitCost = nullableNonNegative(
    input.observation.unitCost,
    "SUPPLIER_PRICE_UNIT_COST_INVALID"
  );
  const suggestedSalePrice = nullableNonNegative(
    input.observation.suggestedSalePrice,
    "SUPPLIER_PRICE_SUGGESTED_SALE_PRICE_INVALID"
  );
  const baseline = {
    currency: input.baseline.currency,
    currentCost: nullableNonNegative(input.baseline.currentCost, "SUPPLIER_PRICE_CURRENT_COST_INVALID"),
    currentSalePrice: nullableNonNegative(
      input.baseline.currentSalePrice,
      "SUPPLIER_PRICE_CURRENT_SALE_PRICE_INVALID"
    ),
    supplierLastCost: nullableNonNegative(
      input.baseline.supplierLastCost,
      "SUPPLIER_PRICE_SUPPLIER_LAST_COST_INVALID"
    ),
    previousObservedUnitCost: nullableNonNegative(
      input.baseline.previousObservedUnitCost,
      "SUPPLIER_PRICE_PREVIOUS_OBSERVED_COST_INVALID"
    )
  };
  if (baseline.currency !== "COP") {
    throw new Error("SUPPLIER_PRICE_CURRENCY_UNSUPPORTED");
  }
  const confidence = confidenceFrom4(validateConfidence(input.observation.extractionConfidence), [
    "Confidence originates from supplier document extraction."
  ]);
  const canonicalProductId = canonicalProductIdFor(input.reconciliation);
  const candidateProductId = candidateProductIdFor(input.reconciliation);
  const sourceEvidenceIds = distinctEvidenceIds(input.observation.sourceEvidenceIds);
  const evidence = [];
  if (unitCost !== null) {
    evidence.push(
      evidenceFor({
        evidenceId: `${sourceRecordId}:UNIT_COST`,
        kind: "UNIT_COST",
        amount: unitCost,
        correlationId,
        context: input.context,
        observation: {
          sourceRecordId,
          documentId,
          supplierId,
          observedAt,
          unitCost,
          suggestedSalePrice,
          extractionConfidence: input.observation.extractionConfidence,
          sourceEvidenceIds
        },
        canonicalProductId,
        candidateProductId,
        confidence,
        createdAt
      })
    );
  }
  if (suggestedSalePrice !== null) {
    evidence.push(
      evidenceFor({
        evidenceId: `${sourceRecordId}:SUGGESTED_SALE_PRICE`,
        kind: "SUGGESTED_SALE_PRICE",
        amount: suggestedSalePrice,
        correlationId,
        context: input.context,
        observation: {
          sourceRecordId,
          documentId,
          supplierId,
          observedAt,
          unitCost,
          suggestedSalePrice,
          extractionConfidence: input.observation.extractionConfidence,
          sourceEvidenceIds
        },
        canonicalProductId,
        candidateProductId,
        confidence,
        createdAt
      })
    );
  }
  const costReferenceAmount = costReferenceFor(baseline);
  const unitCostDelta = delta(unitCost, costReferenceAmount);
  const suggestedSalePriceDelta = delta(suggestedSalePrice, baseline.currentSalePrice);
  const unresolvedIdentity = input.reconciliation.classification !== "EXACT_MATCH";
  const costChanged = unitCostDelta !== null && unitCostDelta !== 0;
  const suggestedSalePriceChanged = suggestedSalePriceDelta !== null && suggestedSalePriceDelta !== 0;
  const hasUnanchoredSuggestion = suggestedSalePrice !== null && baseline.currentSalePrice === null;
  const requiresHumanReview = evidence.length > 0 && (unresolvedIdentity || costChanged || suggestedSalePriceChanged || hasUnanchoredSuggestion);
  if (evidence.length === 0) {
    return {
      evidence: [],
      candidate: null,
      recommendation: null,
      canonicalProductId,
      candidateProductId,
      costReferenceAmount,
      unitCostDelta,
      suggestedSalePriceDelta,
      requiresHumanReview: false,
      canAutoUpdateSalePrice: false,
      canAutoWriteCostHistory: false,
      canAutoUpdateSupplierLastCost: false
    };
  }
  const evidenceIds = distinctEvidenceIds([
    ...sourceEvidenceIds,
    ...evidence.map((entry) => entry.evidenceId)
  ]);
  const candidate = {
    candidateId: `SUPPLIER_PRICE:${documentId}:${sourceRecordId}`,
    correlationId,
    type: "PRICE_REVIEW",
    context: input.context,
    payload: {
      supplierId,
      documentId,
      sourceRecordId,
      observedAt,
      currency: baseline.currency,
      unitCost,
      suggestedSalePrice,
      canonicalProductId,
      candidateProductId,
      reconciliationClassification: input.reconciliation.classification,
      costReferenceAmount,
      unitCostDelta,
      suggestedSalePriceDelta,
      supplierSuggestedSalePriceIsNonAuthoritative: true,
      canAutoUpdateSalePrice: false,
      canAutoWriteCostHistory: false,
      canAutoUpdateSupplierLastCost: false
    },
    evidenceIds,
    confidence,
    status: requiresHumanReview ? "IN_REVIEW" : "PENDING",
    createdAt
  };
  const recommendation = requiresHumanReview ? {
    recommendationId: `SUPPLIER_PRICE_REVIEW:${documentId}:${sourceRecordId}`,
    correlationId,
    context: input.context,
    actionType: "REVIEW_SUPPLIER_PRICE_EVIDENCE",
    title: "Review supplier price evidence",
    explanation: "Supplier cost/pricing observations require governed review before any commercial or operational pricing action.",
    priority: costChanged || suggestedSalePriceChanged ? "P1" : "P2",
    severity: costChanged || suggestedSalePriceChanged ? "WARNING" : "INFO",
    source: "SUPPLIER_DOCUMENT_PRICE_EVIDENCE",
    rationale: [
      unresolvedIdentity ? "Product identity is not an exact reconciliation match." : "An exact Product Master proposal is available as evidence only.",
      costChanged ? "Observed supplier unit cost differs from the best available comparison reference." : "No confirmed supplier unit-cost change was established against an available reference.",
      suggestedSalePriceChanged || hasUnanchoredSuggestion ? "Supplier suggested sale price is non-authoritative and must not change LIHEN sale_price automatically." : "No supplier suggested sale-price difference requires escalation.",
      "Any future sale-price mutation must use Human Decision + Existing Control Plane + PRODUCT_PRICE_CHANGE."
    ],
    evidenceIds,
    confidence,
    risk: {
      level: "R2",
      reasons: [
        "This recommendation requests review only and does not authorize a canonical price mutation.",
        "A future sale-price change is a separate governed R3/controlled operation."
      ],
      requiresHumanReview: true
    },
    status: "OPEN",
    createdAt
  } : null;
  return {
    evidence,
    candidate,
    recommendation,
    canonicalProductId,
    candidateProductId,
    costReferenceAmount,
    unitCostDelta,
    suggestedSalePriceDelta,
    requiresHumanReview,
    canAutoUpdateSalePrice: false,
    canAutoWriteCostHistory: false,
    canAutoUpdateSupplierLastCost: false
  };
}

// packages/intelligence-core/src/capabilities/inventory-intelligence.ts
function requireText2(value, label) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}
function requireFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
  return value;
}
function requirePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite positive number.`);
  }
  return value;
}
function parseDate(value, label) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid date.`);
  return parsed;
}
function validatePolicy(policy) {
  return Object.freeze({
    criticalAvailableThreshold: requireFiniteNonNegative(
      policy.criticalAvailableThreshold,
      "criticalAvailableThreshold"
    ),
    overstockDaysOfCoverThreshold: requirePositive(
      policy.overstockDaysOfCoverThreshold,
      "overstockDaysOfCoverThreshold"
    ),
    immobileDaysThreshold: requirePositive(
      policy.immobileDaysThreshold,
      "immobileDaysThreshold"
    ),
    replenishmentTargetDaysOfCover: requirePositive(
      policy.replenishmentTargetDaysOfCover,
      "replenishmentTargetDaysOfCover"
    )
  });
}
function confidenceFor(hasDemand, hasMovements) {
  const score = hasDemand && hasMovements ? 0.95 : hasDemand || hasMovements ? 0.9 : 0.85;
  return Object.freeze({
    score,
    band: score >= 0.9 ? "VERY_HIGH" : "HIGH",
    rationale: Object.freeze([
      "Inventory balance comes from the governed Inventory read model.",
      hasDemand ? "Demand observation is present for rotation and projection." : "Demand observation is absent; demand-based signals are not inferred.",
      hasMovements ? "Movement history is present for recency analysis." : "Movement history is empty; immobility is not inferred."
    ])
  });
}
function riskFor(kind) {
  if (kind === "INTEGRITY_ANOMALY") {
    return Object.freeze({
      level: "R4",
      reasons: Object.freeze([
        "Correcting an inventory anomaly may require a governed inventory mutation.",
        "Intelligence must not create or repair inventory movements automatically."
      ]),
      requiresHumanReview: true
    });
  }
  if (kind === "REPLENISHMENT_SUGGESTED") {
    return Object.freeze({
      level: "R3",
      reasons: Object.freeze([
        "A replenishment decision may create economic or procurement commitments.",
        "The recommendation is advisory and requires governed human execution."
      ]),
      requiresHumanReview: true
    });
  }
  return Object.freeze({
    level: "R1",
    reasons: Object.freeze([
      "This is a read-only analytical signal and does not mutate Inventory."
    ]),
    requiresHumanReview: false
  });
}
function actionTypeFor(kind) {
  switch (kind) {
    case "INTEGRITY_ANOMALY":
      return "REVIEW_INVENTORY_INTEGRITY";
    case "CRITICAL_STOCK":
      return "REVIEW_CRITICAL_STOCK";
    case "ROTATION_OBSERVED":
      return "REVIEW_INVENTORY_ROTATION";
    case "OVERSTOCK":
      return "REVIEW_OVERSTOCK";
    case "IMMOBILE_STOCK":
      return "REVIEW_IMMOBILE_STOCK";
    case "STOCKOUT_PROJECTION":
      return "REVIEW_STOCKOUT_PROJECTION";
    case "REPLENISHMENT_SUGGESTED":
      return "REVIEW_REPLENISHMENT_SUGGESTION";
  }
}
function priorityFor(kind) {
  switch (kind) {
    case "INTEGRITY_ANOMALY":
      return "P1";
    case "CRITICAL_STOCK":
    case "REPLENISHMENT_SUGGESTED":
      return "P2";
    case "OVERSTOCK":
    case "IMMOBILE_STOCK":
    case "STOCKOUT_PROJECTION":
      return "P3";
    case "ROTATION_OBSERVED":
      return "P4";
  }
}
function canonicalSignalOrder(kind) {
  return [
    "INTEGRITY_ANOMALY",
    "CRITICAL_STOCK",
    "REPLENISHMENT_SUGGESTED",
    "STOCKOUT_PROJECTION",
    "OVERSTOCK",
    "IMMOBILE_STOCK",
    "ROTATION_OBSERVED"
  ].indexOf(kind);
}
function daysBetween(later, earlier) {
  return Math.max(0, (later.getTime() - earlier.getTime()) / 864e5);
}
function analyzeInventoryIntelligence(input) {
  const productId = requireText2(input.productId, "productId");
  const correlationId = requireText2(input.correlationId, "correlationId");
  const createdAt = requireText2(input.createdAt, "createdAt");
  parseDate(createdAt, "createdAt");
  const asOf = parseDate(input.asOf, "asOf");
  const policy = validatePolicy(input.policy);
  if (input.balance.productId !== productId) {
    throw new Error("Inventory balance productId must match the requested productId.");
  }
  const stockOnHand = requireFiniteNonNegative(input.balance.stockOnHand, "stockOnHand");
  const stockReserved = requireFiniteNonNegative(input.balance.stockReserved, "stockReserved");
  const stockPending = requireFiniteNonNegative(input.balance.stockPending, "stockPending");
  const stockAvailable = requireFiniteNonNegative(
    input.balance.stockAvailable,
    "stockAvailable"
  );
  for (const movement of input.movements) {
    if (movement.productId !== productId) {
      throw new Error("Every Inventory movement must belong to the requested productId.");
    }
    if (!Number.isFinite(movement.quantityDelta)) {
      throw new Error("Inventory movement quantityDelta must be finite.");
    }
    parseDate(movement.occurredAt, "movement.occurredAt");
  }
  let averageDailyDemand = null;
  if (input.demand) {
    const unitsSold = requireFiniteNonNegative(input.demand.unitsSold, "demand.unitsSold");
    const windowDays = requirePositive(input.demand.windowDays, "demand.windowDays");
    averageDailyDemand = unitsSold / windowDays;
  }
  const latestMovement = input.movements.map((movement) => parseDate(movement.occurredAt, "movement.occurredAt")).sort((left, right) => right.getTime() - left.getTime())[0];
  const daysSinceLastMovement = latestMovement ? daysBetween(asOf, latestMovement) : null;
  const daysOfCover = averageDailyDemand !== null && averageDailyDemand > 0 ? stockAvailable / averageDailyDemand : null;
  const projectedStockoutDays = daysOfCover;
  const replenishmentBase = averageDailyDemand !== null && averageDailyDemand > 0 ? Math.ceil(averageDailyDemand * policy.replenishmentTargetDaysOfCover) : null;
  const suggestedReplenishmentQuantity = replenishmentBase === null ? null : Math.max(0, replenishmentBase - stockAvailable - stockPending);
  const signals = [];
  const expectedAvailable = stockOnHand - stockReserved;
  if (stockReserved > stockOnHand || stockAvailable !== expectedAvailable) {
    signals.push({
      kind: "INTEGRITY_ANOMALY",
      severity: "CRITICAL",
      title: "Inventory balance requires integrity review",
      explanation: "The governed balance is internally inconsistent and must be reviewed before any corrective inventory action.",
      rationale: Object.freeze([
        `ON_HAND=${stockOnHand}.`,
        `RESERVED=${stockReserved}.`,
        `AVAILABLE=${stockAvailable}.`,
        `Expected AVAILABLE from ON_HAND - RESERVED=${expectedAvailable}.`
      ])
    });
  }
  if (stockAvailable <= policy.criticalAvailableThreshold) {
    signals.push({
      kind: "CRITICAL_STOCK",
      severity: "WARNING",
      title: "Critical available stock detected",
      explanation: "Available stock is at or below the explicit critical-stock policy threshold.",
      rationale: Object.freeze([
        `AVAILABLE=${stockAvailable}.`,
        `Critical threshold=${policy.criticalAvailableThreshold}.`
      ])
    });
  }
  if (averageDailyDemand !== null) {
    signals.push({
      kind: "ROTATION_OBSERVED",
      severity: "INFO",
      title: "Inventory rotation observed",
      explanation: "Rotation is derived only from the supplied demand observation; no demand is invented from Inventory movements.",
      rationale: Object.freeze([
        `Average daily demand=${averageDailyDemand.toFixed(4)}.`,
        `Observation window=${input.demand.windowDays} days.`,
        `Units sold=${input.demand.unitsSold}.`
      ])
    });
  }
  if (daysOfCover !== null && daysOfCover >= policy.overstockDaysOfCoverThreshold && stockAvailable > policy.criticalAvailableThreshold) {
    signals.push({
      kind: "OVERSTOCK",
      severity: "WARNING",
      title: "Potential overstock detected",
      explanation: "Days of cover meet or exceed the explicit overstock policy threshold.",
      rationale: Object.freeze([
        `Days of cover=${daysOfCover.toFixed(2)}.`,
        `Overstock threshold=${policy.overstockDaysOfCoverThreshold} days.`
      ])
    });
  }
  if (stockOnHand > 0 && daysSinceLastMovement !== null && daysSinceLastMovement >= policy.immobileDaysThreshold) {
    signals.push({
      kind: "IMMOBILE_STOCK",
      severity: "WARNING",
      title: "Potential immobile inventory detected",
      explanation: "Stock exists and the last governed inventory movement is older than the explicit immobility threshold.",
      rationale: Object.freeze([
        `Days since last movement=${daysSinceLastMovement.toFixed(2)}.`,
        `Immobility threshold=${policy.immobileDaysThreshold} days.`
      ])
    });
  }
  if (projectedStockoutDays !== null) {
    signals.push({
      kind: "STOCKOUT_PROJECTION",
      severity: projectedStockoutDays <= policy.replenishmentTargetDaysOfCover ? "WARNING" : "INFO",
      title: "Stockout projection available",
      explanation: "Projected cover is derived from available stock and the supplied demand observation.",
      rationale: Object.freeze([
        `Projected stockout in ${projectedStockoutDays.toFixed(2)} days at observed demand.`
      ])
    });
  }
  if (suggestedReplenishmentQuantity !== null && suggestedReplenishmentQuantity > 0) {
    signals.push({
      kind: "REPLENISHMENT_SUGGESTED",
      severity: "WARNING",
      title: "Replenishment review suggested",
      explanation: "The suggested quantity restores the explicit target days of cover after considering available and pending stock. It is advisory only.",
      rationale: Object.freeze([
        `Suggested quantity=${suggestedReplenishmentQuantity}.`,
        `Target cover=${policy.replenishmentTargetDaysOfCover} days.`,
        `AVAILABLE=${stockAvailable}.`,
        `PENDING_IN=${stockPending}.`
      ])
    });
  }
  signals.sort(
    (left, right) => canonicalSignalOrder(left.kind) - canonicalSignalOrder(right.kind)
  );
  const context = Object.freeze({
    contextId: `inventory:${productId}`,
    type: "INVENTORY",
    entityId: productId,
    attributes: Object.freeze({
      productId,
      asOf: asOf.toISOString()
    })
  });
  const confidence = confidenceFor(Boolean(input.demand), input.movements.length > 0);
  const evidence = signals.map(
    (signal, index) => Object.freeze({
      evidenceId: `inventory:${productId}:${signal.kind.toLowerCase()}:${index + 1}`,
      correlationId,
      context,
      capability: "ANALYTICS",
      sourceAuthority: Object.freeze({
        level: "FIRST_PARTY",
        sourceName: "LIHEN Inventory Read Model",
        rationale: Object.freeze([
          "Balance and movement inputs originate from the governed Inventory read boundary.",
          "The capability is persistence-neutral and does not acquire write authority."
        ])
      }),
      observation: signal.explanation,
      payload: Object.freeze({
        signalKind: signal.kind,
        metrics: Object.freeze({
          averageDailyDemand,
          daysOfCover,
          daysSinceLastMovement,
          projectedStockoutDays,
          suggestedReplenishmentQuantity
        })
      }),
      confidence,
      fingerprint: [
        productId,
        signal.kind,
        stockOnHand,
        stockReserved,
        stockPending,
        stockAvailable,
        asOf.toISOString()
      ].join("|"),
      createdAt
    })
  );
  const recommendations = signals.map(
    (signal, index) => Object.freeze({
      recommendationId: `inventory:${productId}:${signal.kind.toLowerCase()}:recommendation:${index + 1}`,
      correlationId,
      context,
      actionType: actionTypeFor(signal.kind),
      title: signal.title,
      explanation: signal.explanation,
      priority: priorityFor(signal.kind),
      severity: signal.severity,
      source: "LIHEN Inventory Intelligence",
      rationale: signal.rationale,
      evidenceIds: Object.freeze([evidence[index].evidenceId]),
      confidence,
      risk: riskFor(signal.kind),
      status: "OPEN",
      createdAt
    })
  );
  return Object.freeze({
    productId,
    context,
    metrics: Object.freeze({
      averageDailyDemand,
      daysOfCover,
      daysSinceLastMovement,
      projectedStockoutDays,
      suggestedReplenishmentQuantity
    }),
    signals: Object.freeze(signals),
    evidence: Object.freeze(evidence),
    recommendations: Object.freeze(recommendations)
  });
}

// packages/intelligence-core/src/capabilities/procurement-intelligence.ts
function requireText3(value, label) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}
function requireFiniteNonNegative2(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
  return value;
}
function requirePercent(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be a finite percentage from 0 to 100.`);
  }
  return value;
}
function parseDate2(value, label) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid date.`);
  return parsed;
}
function parseOptionalDay(value, label) {
  if (value === null) return null;
  return parseDate2(`${value}T00:00:00.000Z`, label);
}
function validatePolicy2(policy) {
  return Object.freeze({
    overdueGraceDays: requireFiniteNonNegative2(
      policy.overdueGraceDays,
      "overdueGraceDays"
    ),
    costIncreaseWarningPercent: requirePercent(
      policy.costIncreaseWarningPercent,
      "costIncreaseWarningPercent"
    ),
    supplierOverdueRateWarningPercent: requirePercent(
      policy.supplierOverdueRateWarningPercent,
      "supplierOverdueRateWarningPercent"
    )
  });
}
function confidenceFor2(hasCostComparison, hasSupplierPerformance) {
  const score = hasCostComparison && hasSupplierPerformance ? 0.95 : hasCostComparison || hasSupplierPerformance ? 0.9 : 0.85;
  return Object.freeze({
    score,
    band: score >= 0.9 ? "VERY_HIGH" : "HIGH",
    rationale: Object.freeze([
      "Purchase and Purchase Item inputs come from the governed Procurement read boundary.",
      hasCostComparison ? "Quoted and final costs provide explicit comparable receipt evidence." : "No complete quoted/final receipt comparison is available; cost change is not invented.",
      hasSupplierPerformance ? "Supplier performance observation is explicitly supplied as a read model." : "Supplier history is absent; supplier performance patterns are not inferred from one purchase."
    ])
  });
}
function riskFor2(kind) {
  if (kind === "PURCHASE_INTEGRITY_ANOMALY") {
    return Object.freeze({
      level: "R4",
      reasons: Object.freeze([
        "Repairing purchase/inventory state may require governed operational mutations.",
        "Intelligence must not rewrite purchase receipts or inventory movements automatically."
      ]),
      requiresHumanReview: true
    });
  }
  if (kind === "RECEIPT_OVERDUE" || kind === "COST_INCREASE" || kind === "SUPPLIER_DELAY_PATTERN") {
    return Object.freeze({
      level: "R2",
      reasons: Object.freeze([
        "This finding may influence a procurement or supplier decision.",
        "The recommendation remains advisory and requires human review before governed action."
      ]),
      requiresHumanReview: true
    });
  }
  return Object.freeze({
    level: "R1",
    reasons: Object.freeze([
      "This is a read-only procurement observation and does not mutate canonical state."
    ]),
    requiresHumanReview: false
  });
}
function actionTypeFor2(kind) {
  switch (kind) {
    case "PURCHASE_INTEGRITY_ANOMALY":
      return "REVIEW_PURCHASE_INTEGRITY";
    case "RECEIPT_OVERDUE":
      return "REVIEW_OVERDUE_PURCHASE";
    case "PARTIAL_RECEIPT":
      return "REVIEW_PARTIAL_RECEIPT";
    case "COST_INCREASE":
      return "REVIEW_PURCHASE_COST_INCREASE";
    case "COST_DECREASE":
      return "REVIEW_PURCHASE_COST_DECREASE";
    case "SUPPLIER_DELAY_PATTERN":
      return "REVIEW_SUPPLIER_DELIVERY_PATTERN";
  }
}
function priorityFor2(kind) {
  switch (kind) {
    case "PURCHASE_INTEGRITY_ANOMALY":
      return "P1";
    case "RECEIPT_OVERDUE":
    case "COST_INCREASE":
    case "SUPPLIER_DELAY_PATTERN":
      return "P2";
    case "PARTIAL_RECEIPT":
      return "P3";
    case "COST_DECREASE":
      return "P4";
  }
}
function canonicalSignalOrder2(kind) {
  return [
    "PURCHASE_INTEGRITY_ANOMALY",
    "RECEIPT_OVERDUE",
    "SUPPLIER_DELAY_PATTERN",
    "COST_INCREASE",
    "PARTIAL_RECEIPT",
    "COST_DECREASE"
  ].indexOf(kind);
}
function stableFingerprint3(parts) {
  const text = parts.map((part) => String(part ?? "")).join("|");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function analyzeProcurementIntelligence(input) {
  const correlationId = requireText3(input.correlationId, "correlationId");
  const purchaseId = requireText3(input.purchase.id, "purchase.id");
  const purchaseNumber = requireText3(
    input.purchase.purchaseNumber,
    "purchase.purchaseNumber"
  );
  const supplierId = requireText3(input.purchase.supplierId, "purchase.supplierId");
  const createdAt = requireText3(input.createdAt, "createdAt");
  parseDate2(createdAt, "createdAt");
  const asOf = parseDate2(input.asOf, "asOf");
  const policy = validatePolicy2(input.policy);
  const expectedDate = parseOptionalDay(
    input.purchase.expectedDate,
    "purchase.expectedDate"
  );
  if (input.purchase.receivedAt !== null) {
    parseDate2(input.purchase.receivedAt, "purchase.receivedAt");
  }
  const seenItemIds = /* @__PURE__ */ new Set();
  let requestedUnits = 0;
  let receivedUnits = 0;
  let observedQuotedReceiptValue = 0;
  let observedFinalReceiptValue = 0;
  let comparableReceiptLines = 0;
  let integrityIssue = false;
  for (const item of input.items) {
    const itemId = requireText3(item.id, "item.id");
    if (seenItemIds.has(itemId)) {
      throw new Error("Purchase Item IDs must be unique.");
    }
    seenItemIds.add(itemId);
    if (item.purchaseId !== purchaseId) {
      throw new Error("Every Purchase Item must belong to the requested purchase.");
    }
    requireText3(item.productId, "item.productId");
    const requested = requireFiniteNonNegative2(
      item.quantityRequested,
      "item.quantityRequested"
    );
    const received = requireFiniteNonNegative2(
      item.quantityReceived,
      "item.quantityReceived"
    );
    if (!Number.isInteger(requested) || !Number.isInteger(received)) {
      throw new Error("Purchase quantities must be integers.");
    }
    if (received > requested) integrityIssue = true;
    if (item.quotedUnitCost !== null) {
      requireFiniteNonNegative2(item.quotedUnitCost, "item.quotedUnitCost");
    }
    if (item.finalUnitCost !== null) {
      requireFiniteNonNegative2(item.finalUnitCost, "item.finalUnitCost");
    }
    requestedUnits += requested;
    receivedUnits += received;
    if (received > 0 && item.quotedUnitCost !== null && item.finalUnitCost !== null) {
      observedQuotedReceiptValue += received * item.quotedUnitCost;
      observedFinalReceiptValue += received * item.finalUnitCost;
      comparableReceiptLines += 1;
    }
  }
  const remainingUnits = Math.max(0, requestedUnits - receivedUnits);
  const receiptProgressPercent = requestedUnits === 0 ? 0 : Math.min(100, Math.round(receivedUnits / requestedUnits * 100));
  if (input.items.length === 0 && input.purchase.status !== "CANCELLED") {
    integrityIssue = true;
  }
  if (input.purchase.status === "DRAFT" && receivedUnits > 0) {
    integrityIssue = true;
  }
  if (input.purchase.status === "RECEIVED" && remainingUnits > 0) {
    integrityIssue = true;
  }
  if (["CONFIRMED", "PARTIALLY_RECEIVED"].includes(input.purchase.status) && remainingUnits === 0 && requestedUnits > 0) {
    integrityIssue = true;
  }
  const hasCostComparison = comparableReceiptLines > 0;
  const quotedReceiptValue = hasCostComparison ? observedQuotedReceiptValue : null;
  const finalReceiptValue = hasCostComparison ? observedFinalReceiptValue : null;
  const observedCostVarianceAmount = hasCostComparison ? observedFinalReceiptValue - observedQuotedReceiptValue : null;
  const observedCostVariancePercent = hasCostComparison && observedQuotedReceiptValue > 0 ? (observedFinalReceiptValue - observedQuotedReceiptValue) / observedQuotedReceiptValue * 100 : null;
  let supplierOverdueRatePercent = null;
  let supplierAverageReceiptDelayDays = null;
  if (input.supplierPerformance) {
    if (input.supplierPerformance.supplierId !== supplierId) {
      throw new Error(
        "Supplier performance observation must belong to the purchase supplier."
      );
    }
    const purchaseCount = requireFiniteNonNegative2(
      input.supplierPerformance.purchaseCount,
      "supplierPerformance.purchaseCount"
    );
    const overduePurchaseCount = requireFiniteNonNegative2(
      input.supplierPerformance.overduePurchaseCount,
      "supplierPerformance.overduePurchaseCount"
    );
    const receivedPurchaseCount = requireFiniteNonNegative2(
      input.supplierPerformance.receivedPurchaseCount,
      "supplierPerformance.receivedPurchaseCount"
    );
    if (!Number.isInteger(purchaseCount) || !Number.isInteger(overduePurchaseCount) || !Number.isInteger(receivedPurchaseCount)) {
      throw new Error("Supplier performance counts must be integers.");
    }
    if (overduePurchaseCount > purchaseCount || receivedPurchaseCount > purchaseCount) {
      throw new Error(
        "Supplier performance counts cannot exceed purchaseCount."
      );
    }
    supplierOverdueRatePercent = purchaseCount === 0 ? null : overduePurchaseCount / purchaseCount * 100;
    if (input.supplierPerformance.averageReceiptDelayDays !== void 0 && input.supplierPerformance.averageReceiptDelayDays !== null) {
      supplierAverageReceiptDelayDays = requireFiniteNonNegative2(
        input.supplierPerformance.averageReceiptDelayDays,
        "supplierPerformance.averageReceiptDelayDays"
      );
    }
  }
  const signals = [];
  if (integrityIssue) {
    signals.push({
      kind: "PURCHASE_INTEGRITY_ANOMALY",
      severity: "CRITICAL",
      title: "Purchase state requires integrity review",
      explanation: "Purchase status, lines, or accumulated receipt quantities are internally inconsistent and must be reviewed before any corrective action.",
      rationale: Object.freeze([
        `Status=${input.purchase.status}.`,
        `Items=${input.items.length}.`,
        `Requested units=${requestedUnits}.`,
        `Received units=${receivedUnits}.`,
        `Remaining units=${remainingUnits}.`
      ])
    });
  }
  const overdue = expectedDate !== null && ["CONFIRMED", "PARTIALLY_RECEIVED"].includes(input.purchase.status) && remainingUnits > 0 && asOf.getTime() > expectedDate.getTime() + policy.overdueGraceDays * 864e5;
  if (overdue) {
    signals.push({
      kind: "RECEIPT_OVERDUE",
      severity: "WARNING",
      title: "Purchase receipt is overdue",
      explanation: "The purchase still has units pending after the explicit expected-date grace policy.",
      rationale: Object.freeze([
        `Expected date=${input.purchase.expectedDate}.`,
        `Grace days=${policy.overdueGraceDays}.`,
        `Remaining units=${remainingUnits}.`
      ])
    });
  }
  if (receivedUnits > 0 && remainingUnits > 0) {
    signals.push({
      kind: "PARTIAL_RECEIPT",
      severity: "INFO",
      title: "Purchase is partially received",
      explanation: "Receipt progress is incomplete; only physically received units may advance through governed inventory receipt.",
      rationale: Object.freeze([
        `Received units=${receivedUnits}.`,
        `Requested units=${requestedUnits}.`,
        `Receipt progress=${receiptProgressPercent}%.`
      ])
    });
  }
  if (observedCostVariancePercent !== null && observedCostVariancePercent >= policy.costIncreaseWarningPercent) {
    signals.push({
      kind: "COST_INCREASE",
      severity: "WARNING",
      title: "Observed purchase cost increased",
      explanation: "Comparable received lines show a final unit-cost increase against their quoted unit cost.",
      rationale: Object.freeze([
        `Observed variance=${observedCostVariancePercent.toFixed(2)}%.`,
        `Warning threshold=${policy.costIncreaseWarningPercent}%.`,
        "Only received lines with both quoted and final cost are compared."
      ])
    });
  } else if (observedCostVariancePercent !== null && observedCostVariancePercent < 0) {
    signals.push({
      kind: "COST_DECREASE",
      severity: "INFO",
      title: "Observed purchase cost decreased",
      explanation: "Comparable received lines show a lower final cost than their quoted cost.",
      rationale: Object.freeze([
        `Observed variance=${observedCostVariancePercent.toFixed(2)}%.`,
        "Only received lines with both quoted and final cost are compared."
      ])
    });
  }
  if (supplierOverdueRatePercent !== null && supplierOverdueRatePercent >= policy.supplierOverdueRateWarningPercent) {
    signals.push({
      kind: "SUPPLIER_DELAY_PATTERN",
      severity: "WARNING",
      title: "Supplier delivery pattern requires review",
      explanation: "The explicitly supplied supplier history meets or exceeds the overdue-rate warning policy.",
      rationale: Object.freeze([
        `Supplier overdue rate=${supplierOverdueRatePercent.toFixed(2)}%.`,
        `Warning threshold=${policy.supplierOverdueRateWarningPercent}%.`,
        `Historical purchases=${input.supplierPerformance.purchaseCount}.`
      ])
    });
  }
  signals.sort(
    (left, right) => canonicalSignalOrder2(left.kind) - canonicalSignalOrder2(right.kind)
  );
  const context = Object.freeze({
    contextId: `purchase:${purchaseId}`,
    type: "PURCHASE",
    entityId: purchaseId,
    attributes: Object.freeze({
      purchaseId,
      purchaseNumber,
      supplierId,
      status: input.purchase.status,
      asOf: asOf.toISOString()
    })
  });
  const confidence = confidenceFor2(
    hasCostComparison,
    input.supplierPerformance !== void 0
  );
  const evidence = signals.map(
    (signal, index) => Object.freeze({
      evidenceId: `procurement:${purchaseId}:${signal.kind.toLowerCase()}:${index + 1}`,
      correlationId,
      context,
      capability: "ANALYTICS",
      sourceAuthority: Object.freeze({
        level: "FIRST_PARTY",
        sourceName: "LIHEN Procurement Read Model",
        rationale: Object.freeze([
          "Purchase, items, and optional supplier history come from governed read boundaries.",
          "The capability is persistence-neutral and does not acquire operational write authority."
        ])
      }),
      observation: signal.explanation,
      payload: Object.freeze({
        signalKind: signal.kind,
        requestedUnits,
        receivedUnits,
        remainingUnits,
        observedCostVariancePercent,
        supplierOverdueRatePercent
      }),
      confidence,
      fingerprint: stableFingerprint3([
        purchaseId,
        supplierId,
        signal.kind,
        requestedUnits,
        receivedUnits,
        observedCostVariancePercent,
        supplierOverdueRatePercent
      ]),
      createdAt
    })
  );
  const recommendations = signals.map(
    (signal, index) => {
      const evidenceId = evidence[index].evidenceId;
      return Object.freeze({
        recommendationId: `procurement:${purchaseId}:${signal.kind.toLowerCase()}:recommendation`,
        correlationId,
        context,
        actionType: actionTypeFor2(signal.kind),
        title: signal.title,
        explanation: signal.explanation,
        priority: priorityFor2(signal.kind),
        severity: signal.severity,
        source: "LIHEN Procurement Intelligence",
        rationale: signal.rationale,
        evidenceIds: Object.freeze([evidenceId]),
        confidence,
        risk: riskFor2(signal.kind),
        status: "OPEN",
        createdAt
      });
    }
  );
  return Object.freeze({
    purchaseId,
    supplierId,
    context,
    metrics: Object.freeze({
      requestedUnits,
      receivedUnits,
      remainingUnits,
      receiptProgressPercent,
      observedQuotedReceiptValue: quotedReceiptValue,
      observedFinalReceiptValue: finalReceiptValue,
      observedCostVarianceAmount,
      observedCostVariancePercent,
      supplierOverdueRatePercent,
      supplierAverageReceiptDelayDays
    }),
    signals: Object.freeze(signals),
    evidence: Object.freeze(evidence),
    recommendations: Object.freeze(recommendations),
    governance: Object.freeze({
      canAutoConfirmPurchase: false,
      canAutoReceivePurchase: false,
      canAutoPostInventory: false,
      canAutoPostFinance: false,
      canAutoChangeSupplierCost: false
    })
  });
}

// packages/intelligence-core/src/capabilities/orders-sales-intelligence.ts
function requireText4(value, label) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}
function requireFiniteNonNegative3(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
  return value;
}
function requirePositive2(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite positive number.`);
  }
  return value;
}
function parseDate3(value, label) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid date.`);
  return parsed;
}
function stableFingerprint4(parts) {
  const text = parts.map((part) => String(part ?? "")).join("|");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function canonicalSignalOrder3(kind) {
  return [
    "ORDER_INTEGRITY_ANOMALY",
    "COMMERCE_RECONCILIATION_BLOCKED",
    "CANCELLATION_RECONCILIATION_BLOCKED",
    "REVERSED_SALE_AUDIT",
    "ORDER_ATTENTION_REQUIRED",
    "COMMERCE_RECONCILIATION_REVIEW",
    "ORDER_READY_FOR_SALE"
  ].indexOf(kind);
}
function priorityFor3(kind) {
  switch (kind) {
    case "ORDER_INTEGRITY_ANOMALY":
    case "COMMERCE_RECONCILIATION_BLOCKED":
    case "CANCELLATION_RECONCILIATION_BLOCKED":
      return "P1";
    case "REVERSED_SALE_AUDIT":
    case "ORDER_ATTENTION_REQUIRED":
      return "P2";
    case "COMMERCE_RECONCILIATION_REVIEW":
      return "P3";
    case "ORDER_READY_FOR_SALE":
      return "P4";
  }
}
function actionTypeFor3(kind) {
  switch (kind) {
    case "ORDER_INTEGRITY_ANOMALY":
      return "REVIEW_ORDER_SALE_INTEGRITY";
    case "ORDER_ATTENTION_REQUIRED":
      return "REVIEW_ORDER_AGING";
    case "ORDER_READY_FOR_SALE":
      return "REVIEW_ORDER_NEXT_SALE_STEP";
    case "COMMERCE_RECONCILIATION_BLOCKED":
      return "REVIEW_COMMERCE_RECONCILIATION";
    case "COMMERCE_RECONCILIATION_REVIEW":
      return "REVIEW_COMMERCE_WARNINGS";
    case "CANCELLATION_RECONCILIATION_BLOCKED":
      return "REVIEW_ORDER_CANCELLATION_INTEGRITY";
    case "REVERSED_SALE_AUDIT":
      return "REVIEW_REVERSED_SALE_AUDIT";
  }
}
function riskFor3(kind) {
  if (kind === "ORDER_INTEGRITY_ANOMALY" || kind === "COMMERCE_RECONCILIATION_BLOCKED" || kind === "CANCELLATION_RECONCILIATION_BLOCKED") {
    return Object.freeze({
      level: "R4",
      reasons: Object.freeze([
        "Correcting commerce integrity can affect Order, Sale, Inventory, or Finance state.",
        "Intelligence must not repair transactional history or ledgers automatically."
      ]),
      requiresHumanReview: true
    });
  }
  if (kind === "REVERSED_SALE_AUDIT") {
    return Object.freeze({
      level: "R3",
      reasons: Object.freeze([
        "Sale reversal is a governed domain workflow with historical consequences.",
        "The current intelligence signal is advisory and cannot reverse a sale."
      ]),
      requiresHumanReview: true
    });
  }
  if (kind === "ORDER_ATTENTION_REQUIRED" || kind === "COMMERCE_RECONCILIATION_REVIEW") {
    return Object.freeze({
      level: "R2",
      reasons: Object.freeze([
        "The finding can influence an operational next action.",
        "The recommendation remains advisory until a human chooses a governed action."
      ]),
      requiresHumanReview: true
    });
  }
  return Object.freeze({
    level: "R1",
    reasons: Object.freeze([
      "This is a read-only operational observation and does not mutate commerce state."
    ]),
    requiresHumanReview: false
  });
}
function confidenceFor3(hasCommerceReconciliation, hasCancellationReconciliation) {
  const score = hasCommerceReconciliation && hasCancellationReconciliation ? 0.95 : hasCommerceReconciliation || hasCancellationReconciliation ? 0.9 : 0.85;
  return Object.freeze({
    score,
    band: score >= 0.9 ? "VERY_HIGH" : "HIGH",
    rationale: Object.freeze([
      "Order and Sale snapshots come from governed domain read boundaries.",
      hasCommerceReconciliation ? "Commerce reconciliation observations are explicitly supplied." : "Commerce reconciliation observations are absent; cross-ledger PASS is not inferred.",
      hasCancellationReconciliation ? "Order cancellation reconciliation observations are explicitly supplied." : "Cancellation reconciliation observations are absent; reservation release integrity is not inferred."
    ])
  });
}
function validatePolicy3(policy) {
  return Object.freeze({
    activeOrderAttentionHours: requirePositive2(
      policy.activeOrderAttentionHours,
      "activeOrderAttentionHours"
    ),
    readyOrderAttentionHours: requirePositive2(
      policy.readyOrderAttentionHours,
      "readyOrderAttentionHours"
    )
  });
}
function ageHours(asOf, value) {
  const date = parseDate3(value, "order.updatedAt");
  return Math.max(0, (asOf.getTime() - date.getTime()) / 36e5);
}
function isActiveOrder(status) {
  return ["CONFIRMED", "PREPARING", "READY"].includes(status);
}
function isSaleEligibleOrder(status) {
  return ["CONFIRMED", "PREPARING", "READY"].includes(status);
}
function analyzeOrdersSalesIntelligence(input) {
  const correlationId = requireText4(input.correlationId, "correlationId");
  const asOf = parseDate3(input.asOf, "asOf");
  const createdAt = requireText4(input.createdAt, "createdAt");
  parseDate3(createdAt, "createdAt");
  const policy = validatePolicy3(input.policy);
  const orders = input.orders.map((order) => {
    const id = requireText4(order.id, "order.id");
    const orderNumber = requireText4(order.orderNumber, "order.orderNumber");
    parseDate3(order.updatedAt, "order.updatedAt");
    return Object.freeze({ ...order, id, orderNumber });
  });
  const sales = input.sales.map((sale) => {
    const id = requireText4(sale.id, "sale.id");
    const saleNumber = requireText4(sale.saleNumber, "sale.saleNumber");
    parseDate3(sale.occurredAt, "sale.occurredAt");
    requireFiniteNonNegative3(sale.totalAmount, "sale.totalAmount");
    return Object.freeze({ ...sale, id, saleNumber });
  });
  const seenOrderIds = /* @__PURE__ */ new Set();
  for (const order of orders) {
    if (seenOrderIds.has(order.id)) throw new Error("Order IDs must be unique.");
    seenOrderIds.add(order.id);
  }
  const seenSaleIds = /* @__PURE__ */ new Set();
  for (const sale of sales) {
    if (seenSaleIds.has(sale.id)) throw new Error("Sale IDs must be unique.");
    seenSaleIds.add(sale.id);
  }
  const commerceReconciliations = input.commerceReconciliations ?? [];
  const cancellationReconciliations = input.cancellationReconciliations ?? [];
  const seenCommerceSaleIds = /* @__PURE__ */ new Set();
  for (const observation of commerceReconciliations) {
    requireText4(observation.saleId, "commerceReconciliation.saleId");
    if (seenCommerceSaleIds.has(observation.saleId)) {
      throw new Error("Commerce reconciliation sale IDs must be unique.");
    }
    seenCommerceSaleIds.add(observation.saleId);
  }
  const seenCancellationOrderIds = /* @__PURE__ */ new Set();
  for (const observation of cancellationReconciliations) {
    requireText4(observation.orderId, "cancellationReconciliation.orderId");
    if (seenCancellationOrderIds.has(observation.orderId)) {
      throw new Error("Cancellation reconciliation order IDs must be unique.");
    }
    seenCancellationOrderIds.add(observation.orderId);
  }
  const context = Object.freeze({
    contextId: `orders-sales:${correlationId}`,
    type: "GLOBAL",
    attributes: Object.freeze({
      domain: "ORDERS_SALES",
      orderCount: orders.length,
      saleCount: sales.length,
      asOf: asOf.toISOString()
    })
  });
  const signals = [];
  const salesByOrderId = /* @__PURE__ */ new Map();
  for (const sale of sales) {
    if (sale.orderId === null) continue;
    const current = salesByOrderId.get(sale.orderId) ?? [];
    current.push(sale);
    salesByOrderId.set(sale.orderId, current);
  }
  let staleActiveOrders = 0;
  for (const order of orders) {
    const linkedSales = salesByOrderId.get(order.id) ?? [];
    if (order.status === "COMPLETED" && linkedSales.length !== 1 || order.status === "CANCELLED" && linkedSales.length > 0 || !["COMPLETED", "CANCELLED"].includes(order.status) && linkedSales.length > 0 || linkedSales.length > 1) {
      signals.push({
        kind: "ORDER_INTEGRITY_ANOMALY",
        severity: "CRITICAL",
        entityId: order.id,
        title: `Order ${order.orderNumber} requires commerce integrity review`,
        explanation: "Order lifecycle and linked Sale history are inconsistent with the governed commerce flow.",
        rationale: Object.freeze([
          `Order status=${order.status}.`,
          `Linked sales=${linkedSales.length}.`,
          "Order/Sale history must be corrected only through governed domain workflows."
        ])
      });
    }
    if (isActiveOrder(order.status)) {
      const hours = ageHours(asOf, order.updatedAt);
      const threshold = order.status === "READY" ? policy.readyOrderAttentionHours : policy.activeOrderAttentionHours;
      if (hours >= threshold) {
        staleActiveOrders += 1;
        signals.push({
          kind: "ORDER_ATTENTION_REQUIRED",
          severity: order.status === "READY" ? "WARNING" : "INFO",
          entityId: order.id,
          title: `Order ${order.orderNumber} needs operational follow-up`,
          explanation: "The order has remained in an active state beyond the explicit attention threshold.",
          rationale: Object.freeze([
            `Status=${order.status}.`,
            `Age since last update=${hours.toFixed(1)}h.`,
            `Attention threshold=${threshold}h.`
          ])
        });
      }
    }
    if (order.status === "READY" && linkedSales.length === 0) {
      signals.push({
        kind: "ORDER_READY_FOR_SALE",
        severity: "SUCCESS",
        entityId: order.id,
        title: `Order ${order.orderNumber} is ready for the governed sale step`,
        explanation: "The order is READY and no linked Sale is present in the supplied snapshot.",
        rationale: Object.freeze([
          "READY is sale-eligible under the current Order commerce policy.",
          "Completing the sale must remain behind the existing controlled Sales workflow."
        ])
      });
    }
  }
  for (const sale of sales) {
    if (sale.orderId !== null && !seenOrderIds.has(sale.orderId)) {
      signals.push({
        kind: "ORDER_INTEGRITY_ANOMALY",
        severity: "CRITICAL",
        entityId: sale.id,
        title: `Sale ${sale.saleNumber} references an order outside the supplied Order snapshot`,
        explanation: "A Sale with orderId must be traceable to its Order before cross-domain integrity can be considered complete.",
        rationale: Object.freeze([
          `sale.orderId=${sale.orderId}.`,
          "Missing Order context is treated as an integrity anomaly, not silently ignored."
        ])
      });
    }
    if (sale.status === "REVERSED") {
      signals.push({
        kind: "REVERSED_SALE_AUDIT",
        severity: "WARNING",
        entityId: sale.id,
        title: `Sale ${sale.saleNumber} is historical REVERSED evidence`,
        explanation: "The reversed Sale must remain historical evidence and cannot be reprocessed by a generic finance or UI action.",
        rationale: Object.freeze([
          "Current Sale reversal policy requires a dedicated governed domain workflow.",
          "Intelligence can surface the record for audit but cannot reverse or rewrite it."
        ])
      });
    }
  }
  for (const observation of commerceReconciliations) {
    if (observation.status === "BLOCKED") {
      signals.push({
        kind: "COMMERCE_RECONCILIATION_BLOCKED",
        severity: "CRITICAL",
        entityId: observation.saleId,
        title: "Commerce reconciliation is blocked",
        explanation: "Sale, Order, Inventory, or Finance evidence does not reconcile and requires investigation before corrective action.",
        rationale: Object.freeze([
          ...observation.blockers.map((blocker) => `BLOCKER:${blocker}`),
          ...observation.warnings.map((warning) => `WARNING:${warning}`)
        ])
      });
    } else if (observation.status === "REVIEW") {
      signals.push({
        kind: "COMMERCE_RECONCILIATION_REVIEW",
        severity: "WARNING",
        entityId: observation.saleId,
        title: "Commerce reconciliation requires review",
        explanation: "The supplied reconciliation contains warnings that should be reviewed without rewriting transactional history.",
        rationale: Object.freeze(
          observation.warnings.map((warning) => `WARNING:${warning}`)
        )
      });
    }
  }
  for (const observation of cancellationReconciliations) {
    if (observation.status === "BLOCKED") {
      signals.push({
        kind: "CANCELLATION_RECONCILIATION_BLOCKED",
        severity: "CRITICAL",
        entityId: observation.orderId,
        title: "Order cancellation reconciliation is blocked",
        explanation: "Reservation release or linked Sale evidence is inconsistent with the cancelled Order.",
        rationale: Object.freeze([
          ...observation.blockers.map((blocker) => `BLOCKER:${blocker}`),
          ...observation.warnings.map((warning) => `WARNING:${warning}`)
        ])
      });
    }
  }
  signals.sort(
    (left, right) => canonicalSignalOrder3(left.kind) - canonicalSignalOrder3(right.kind) || left.entityId.localeCompare(right.entityId)
  );
  const confidence = confidenceFor3(
    commerceReconciliations.length > 0,
    cancellationReconciliations.length > 0
  );
  const evidence = signals.map(
    (signal, index) => Object.freeze({
      evidenceId: `orders-sales-evidence:${correlationId}:${index + 1}`,
      correlationId,
      context,
      capability: "ANALYTICS",
      sourceAuthority: Object.freeze({
        level: "FIRST_PARTY",
        sourceName: "LIHEN governed Order/Sale read models",
        rationale: Object.freeze([
          "Evidence is derived only from supplied first-party domain snapshots and reconciliation observations."
        ])
      }),
      observation: signal.explanation,
      payload: Object.freeze({
        kind: signal.kind,
        entityId: signal.entityId,
        severity: signal.severity,
        rationale: signal.rationale
      }),
      confidence,
      fingerprint: stableFingerprint4([
        signal.kind,
        signal.entityId,
        signal.title,
        ...signal.rationale
      ]),
      createdAt
    })
  );
  const recommendations = signals.map(
    (signal, index) => Object.freeze({
      recommendationId: `orders-sales-recommendation:${correlationId}:${index + 1}`,
      correlationId,
      context,
      actionType: actionTypeFor3(signal.kind),
      title: signal.title,
      explanation: signal.explanation,
      priority: priorityFor3(signal.kind),
      severity: signal.severity,
      source: "Orders & Sales Intelligence",
      rationale: signal.rationale,
      evidenceIds: Object.freeze([evidence[index].evidenceId]),
      confidence,
      risk: riskFor3(signal.kind),
      status: "OPEN",
      createdAt
    })
  );
  const metrics = Object.freeze({
    totalOrders: orders.length,
    draftOrders: orders.filter((order) => order.status === "DRAFT").length,
    activeOrders: orders.filter((order) => isActiveOrder(order.status)).length,
    saleEligibleOrders: orders.filter((order) => isSaleEligibleOrder(order.status)).length,
    completedOrders: orders.filter((order) => order.status === "COMPLETED").length,
    cancelledOrders: orders.filter((order) => order.status === "CANCELLED").length,
    staleActiveOrders,
    totalSales: sales.length,
    completedSales: sales.filter((sale) => sale.status === "COMPLETED").length,
    reversedSales: sales.filter((sale) => sale.status === "REVERSED").length,
    observedCompletedSalesAmount: sales.filter((sale) => sale.status === "COMPLETED").reduce((sum, sale) => sum + sale.totalAmount, 0),
    blockedCommerceReconciliations: commerceReconciliations.filter(
      (observation) => observation.status === "BLOCKED"
    ).length,
    reviewCommerceReconciliations: commerceReconciliations.filter(
      (observation) => observation.status === "REVIEW"
    ).length,
    blockedCancellationReconciliations: cancellationReconciliations.filter(
      (observation) => observation.status === "BLOCKED"
    ).length
  });
  return Object.freeze({
    context,
    metrics,
    signals: Object.freeze(signals),
    evidence: Object.freeze(evidence),
    recommendations: Object.freeze(recommendations),
    governance: Object.freeze({
      canAutoCreateOrder: false,
      canAutoConfirmOrder: false,
      canAutoCancelOrder: false,
      canAutoCompleteSale: false,
      canAutoReverseSale: false,
      canAutoMoveInventory: false,
      canAutoPostFinance: false
    })
  });
}

// packages/intelligence-core/src/capabilities/creative-intelligence.ts
function compactId(value) {
  const compact = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return compact || "generated";
}
function candidateTypeForContext(context) {
  return context.type === "PRODUCT" ? "PRODUCT_ASSET" : "CATALOG_ASSET";
}
function generatedEvidence(request, image, providerName, index) {
  const ref = compactId(image.generatedRef);
  return {
    evidenceId: `creative-evidence-${request.brief.briefId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    context: request.context,
    capability: "CREATIVE_INTELLIGENCE",
    sourceAuthority: {
      level: "GENERATED",
      sourceName: providerName,
      rationale: [
        "Artifact was produced by an injected ImageGenerationPort.",
        "GENERATED provenance is not canonical business authority."
      ]
    },
    observation: `Generated creative artifact candidate for ${request.brief.intendedUse}.`,
    payload: {
      generatedRef: image.generatedRef,
      provenance: image.provenance,
      mimeType: image.mimeType,
      ...image.width === void 0 ? {} : { width: image.width },
      ...image.height === void 0 ? {} : { height: image.height },
      intendedUse: request.brief.intendedUse,
      sourceAssetRefs: request.brief.sourceAssetRefs,
      constraints: request.brief.constraints
    },
    confidence: {
      score: 0.5,
      band: "MEDIUM",
      rationale: [
        "Generation completed, but creative suitability requires human review.",
        "Confidence does not grant permission to publish or replace canonical assets."
      ]
    },
    fingerprint: `generated:${request.brief.briefId}:${index + 1}:${image.generatedRef}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function generatedCandidate(request, image, evidence, index) {
  const ref = compactId(image.generatedRef);
  return {
    candidateId: `creative-candidate-${request.brief.briefId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    type: candidateTypeForContext(request.context),
    context: request.context,
    payload: {
      generatedRef: image.generatedRef,
      provenance: "GENERATED",
      mimeType: image.mimeType,
      ...image.width === void 0 ? {} : { width: image.width },
      ...image.height === void 0 ? {} : { height: image.height },
      intendedUse: request.brief.intendedUse,
      instruction: request.brief.instruction,
      constraints: request.brief.constraints
    },
    evidenceIds: [evidence.evidenceId],
    confidence: evidence.confidence,
    status: "PENDING",
    createdAt: evidence.createdAt
  };
}
function providerFailureMessage(result) {
  return [
    `Image generation provider returned ${result.status}.`,
    ...result.messages
  ].join(" ");
}
async function generateCreativeCandidates(dependencies, request) {
  const instruction = request.brief.instruction.trim();
  const intendedUse = request.brief.intendedUse.trim();
  if (!instruction || !intendedUse) {
    return {
      status: "NO_RESULT",
      evidence: [],
      candidates: [],
      messages: ["Creative brief requires instruction and intendedUse."]
    };
  }
  if (!dependencies.imageGeneration) {
    return {
      status: "PROVIDER_NOT_CONFIGURED",
      evidence: [],
      candidates: [],
      messages: [
        "No ImageGenerationPort is configured.",
        "No generated artifact, persistence or publication occurred."
      ]
    };
  }
  const result = await dependencies.imageGeneration.generate({
    correlationId: request.correlationId,
    requestedBy: request.requestedBy,
    context: request.context,
    instruction,
    sourceAssetRefs: request.brief.sourceAssetRefs,
    intendedUse,
    constraints: request.brief.constraints
  });
  if (result.status !== "SUCCESS" && result.status !== "PARTIAL") {
    return {
      status: "PROVIDER_FAILED",
      evidence: [],
      candidates: [],
      messages: [providerFailureMessage(result)]
    };
  }
  const generated = result.data ?? [];
  if (generated.length === 0) {
    return {
      status: "NO_RESULT",
      evidence: [],
      candidates: [],
      messages: [
        ...result.messages,
        "Provider returned no generated artifacts."
      ]
    };
  }
  const providerName = dependencies.imageGeneration.descriptor.name;
  const evidence = generated.map(
    (image, index) => generatedEvidence(request, image, providerName, index)
  );
  const candidates = generated.map(
    (image, index) => generatedCandidate(request, image, evidence[index], index)
  );
  return {
    status: result.status === "PARTIAL" ? "PARTIAL_SUCCESS" : "SUCCESS",
    evidence,
    candidates,
    messages: [
      ...result.messages,
      `${generated.length} generated creative candidate(s) require human review before canonical use or publication.`
    ]
  };
}
function readCreativeBrief(input) {
  const raw = input.context.attributes.creativeBrief;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("CREATIVE_BRIEF_REQUIRED");
  }
  const value = raw;
  if (typeof value.briefId !== "string" || typeof value.instruction !== "string" || typeof value.intendedUse !== "string" || !Array.isArray(value.sourceAssetRefs) || !value.sourceAssetRefs.every((item) => typeof item === "string") || !Array.isArray(value.constraints) || !value.constraints.every((item) => typeof item === "string")) {
    throw new Error("CREATIVE_BRIEF_INVALID");
  }
  return {
    briefId: value.briefId,
    instruction: value.instruction,
    intendedUse: value.intendedUse,
    sourceAssetRefs: value.sourceAssetRefs,
    constraints: value.constraints
  };
}
function createCreativeIntelligenceHandler(dependencies) {
  return {
    capability: "CREATIVE_INTELLIGENCE",
    async execute(input) {
      const creative = await generateCreativeCandidates(
        dependencies,
        {
          correlationId: input.correlationId,
          requestedBy: input.requestedBy,
          context: input.context,
          brief: readCreativeBrief(input)
        }
      );
      if (creative.status === "PROVIDER_NOT_CONFIGURED") {
        throw new Error("CREATIVE_IMAGE_PROVIDER_NOT_CONFIGURED");
      }
      if (creative.status === "PROVIDER_FAILED") {
        throw new Error(
          `CREATIVE_IMAGE_PROVIDER_FAILED: ${creative.messages.join(" ")}`
        );
      }
      return {
        capability: "CREATIVE_INTELLIGENCE",
        evidence: creative.evidence,
        candidates: creative.candidates,
        recommendations: [],
        messages: creative.messages
      };
    }
  };
}

// packages/intelligence-core/src/capabilities/image-transformation.ts
function compactId2(value) {
  const compact = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return compact || "transformed";
}
function transformedEvidence(request, image, providerName, index) {
  const ref = compactId2(image.transformedRef);
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  return {
    evidenceId: `background-removal-evidence-${request.brief.briefId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    context: request.context,
    capability: "CREATIVE_INTELLIGENCE",
    sourceAuthority: {
      level: "GENERATED",
      sourceName: providerName,
      rationale: [
        "Transformation evidence was produced by an injected ImageTransformationPort.",
        "The transformed derivative is not canonical business authority."
      ]
    },
    observation: `Background-removal derivative candidate for ${request.brief.intendedUse}.`,
    payload: {
      transformedRef: image.transformedRef,
      sourceAssetRef: image.sourceAssetRef,
      provenance: image.provenance,
      mimeType: image.mimeType,
      ...image.width === void 0 ? {} : { width: image.width },
      ...image.height === void 0 ? {} : { height: image.height },
      operation: "REMOVE_BACKGROUND",
      intendedUse: request.brief.intendedUse,
      constraints: request.brief.constraints
    },
    confidence: {
      score: 0.5,
      band: "MEDIUM",
      rationale: [
        "Transformation completed, but identity preservation requires human review.",
        "Confidence does not authorize publication or replacement of canonical assets."
      ]
    },
    fingerprint: `transformed:${request.brief.briefId}:${index + 1}:${image.transformedRef}`,
    createdAt
  };
}
function transformedCandidate(request, image, evidence, index) {
  const ref = compactId2(image.transformedRef);
  return {
    candidateId: `background-removal-candidate-${request.brief.briefId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    type: request.context.type === "PRODUCT" ? "PRODUCT_ASSET" : "CATALOG_ASSET",
    context: request.context,
    payload: {
      transformedRef: image.transformedRef,
      sourceAssetRef: image.sourceAssetRef,
      provenance: "TRANSFORMED",
      mimeType: image.mimeType,
      ...image.width === void 0 ? {} : { width: image.width },
      ...image.height === void 0 ? {} : { height: image.height },
      operation: "REMOVE_BACKGROUND",
      intendedUse: request.brief.intendedUse,
      constraints: request.brief.constraints
    },
    evidenceIds: [evidence.evidenceId],
    confidence: evidence.confidence,
    status: "PENDING",
    createdAt: evidence.createdAt
  };
}
function providerFailureMessage2(result) {
  return [
    `Image transformation provider returned ${result.status}.`,
    ...result.messages
  ].join(" ");
}
async function removeImageBackground(dependencies, request) {
  const sourceAssetRef = request.brief.sourceAssetRef.trim();
  const intendedUse = request.brief.intendedUse.trim();
  if (!sourceAssetRef || !intendedUse) {
    return {
      status: "NO_RESULT",
      evidence: [],
      candidates: [],
      messages: [
        "Background removal requires sourceAssetRef and intendedUse."
      ]
    };
  }
  if (!dependencies.imageTransformation) {
    return {
      status: "PROVIDER_NOT_CONFIGURED",
      evidence: [],
      candidates: [],
      messages: [
        "No ImageTransformationPort is configured.",
        "No transformed artifact, persistence or publication occurred."
      ]
    };
  }
  const result = await dependencies.imageTransformation.transform({
    correlationId: request.correlationId,
    requestedBy: request.requestedBy,
    context: request.context,
    operation: "REMOVE_BACKGROUND",
    sourceAssetRef,
    intendedUse,
    constraints: request.brief.constraints
  });
  if (result.status !== "SUCCESS" && result.status !== "PARTIAL") {
    return {
      status: "PROVIDER_FAILED",
      evidence: [],
      candidates: [],
      messages: [providerFailureMessage2(result)]
    };
  }
  const transformed = result.data ?? [];
  if (transformed.length === 0) {
    return {
      status: "NO_RESULT",
      evidence: [],
      candidates: [],
      messages: [
        ...result.messages,
        "Provider returned no transformed artifacts."
      ]
    };
  }
  const providerName = dependencies.imageTransformation.descriptor.name;
  const evidence = transformed.map(
    (image, index) => transformedEvidence(request, image, providerName, index)
  );
  const candidates = transformed.map(
    (image, index) => transformedCandidate(
      request,
      image,
      evidence[index],
      index
    )
  );
  return {
    status: result.status === "PARTIAL" ? "PARTIAL_SUCCESS" : "SUCCESS",
    evidence,
    candidates,
    messages: [
      ...result.messages,
      `${transformed.length} transformed candidate(s) require human review before canonical use or publication.`
    ]
  };
}
function readBackgroundRemovalBrief(input) {
  const raw = input.context.attributes.backgroundRemovalBrief;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("BACKGROUND_REMOVAL_BRIEF_REQUIRED");
  }
  const value = raw;
  if (typeof value.briefId !== "string" || typeof value.sourceAssetRef !== "string" || typeof value.intendedUse !== "string" || !Array.isArray(value.constraints) || !value.constraints.every((item) => typeof item === "string")) {
    throw new Error("BACKGROUND_REMOVAL_BRIEF_INVALID");
  }
  return {
    briefId: value.briefId,
    sourceAssetRef: value.sourceAssetRef,
    intendedUse: value.intendedUse,
    constraints: value.constraints
  };
}
function createImageTransformationHandler(dependencies) {
  return {
    capability: "IMAGE_TRANSFORMATION",
    async execute(input) {
      const result = await removeImageBackground(
        dependencies,
        {
          correlationId: input.correlationId,
          requestedBy: input.requestedBy,
          context: input.context,
          brief: readBackgroundRemovalBrief(input)
        }
      );
      if (result.status === "PROVIDER_NOT_CONFIGURED") {
        throw new Error("IMAGE_TRANSFORMATION_PROVIDER_NOT_CONFIGURED");
      }
      if (result.status === "PROVIDER_FAILED") {
        throw new Error(
          `IMAGE_TRANSFORMATION_PROVIDER_FAILED: ${result.messages.join(" ")}`
        );
      }
      return {
        capability: "IMAGE_TRANSFORMATION",
        evidence: result.evidence,
        candidates: result.candidates,
        recommendations: [],
        messages: result.messages
      };
    }
  };
}

// packages/intelligence-core/src/capabilities/report-generation.ts
function compactId3(value) {
  const result = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return result || "report";
}
function reportEvidence(request, report, providerName, index) {
  const ref = compactId3(report.reportRef);
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  return {
    evidenceId: `report-evidence-${request.brief.reportId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    context: request.context,
    capability: "REPORT_GENERATION",
    sourceAuthority: {
      level: "GENERATED",
      sourceName: providerName,
      rationale: [
        "Report artifact was produced through an injected ReportGenerationPort.",
        "GENERATED report output is not canonical domain authority."
      ]
    },
    observation: `Generated report artifact candidate: ${request.brief.title}.`,
    payload: {
      reportRef: report.reportRef,
      title: report.title,
      mimeType: report.mimeType,
      provenance: report.provenance,
      outputFormat: request.brief.outputFormat,
      purpose: request.brief.purpose,
      sections: request.brief.sections,
      sourceEvidenceIds: request.brief.sourceEvidenceIds,
      constraints: request.brief.constraints,
      metadata: report.metadata
    },
    confidence: {
      score: 0.5,
      band: "MEDIUM",
      rationale: [
        "Artifact generation succeeded, but report correctness and fitness require human review.",
        "Confidence is not permission to publish, persist or treat the report as master data."
      ]
    },
    fingerprint: `generated-report:${request.brief.reportId}:${index + 1}:${report.reportRef}`,
    createdAt
  };
}
function reportCandidate(request, report, evidence, index) {
  const ref = compactId3(report.reportRef);
  return {
    candidateId: `report-candidate-${request.brief.reportId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    type: "DOCUMENT_ARTIFACT",
    context: request.context,
    payload: {
      reportRef: report.reportRef,
      title: report.title,
      mimeType: report.mimeType,
      provenance: "GENERATED",
      outputFormat: request.brief.outputFormat,
      purpose: request.brief.purpose,
      sourceEvidenceIds: request.brief.sourceEvidenceIds,
      metadata: report.metadata
    },
    evidenceIds: [evidence.evidenceId],
    confidence: evidence.confidence,
    status: "PENDING",
    createdAt: evidence.createdAt
  };
}
function failureMessage(result) {
  return [
    `Report generation provider returned ${result.status}.`,
    ...result.messages
  ].join(" ");
}
async function generateGovernedReportCandidates(dependencies, request) {
  const title = request.brief.title.trim();
  const purpose = request.brief.purpose.trim();
  if (!title || !purpose || request.brief.sections.length === 0) {
    return {
      status: "NO_RESULT",
      evidence: [],
      candidates: [],
      messages: [
        "Report brief requires title, purpose and at least one section."
      ]
    };
  }
  if (!dependencies.reportGeneration) {
    return {
      status: "PROVIDER_NOT_CONFIGURED",
      evidence: [],
      candidates: [],
      messages: [
        "No ReportGenerationPort is configured.",
        "No report artifact, persistence or publication occurred."
      ]
    };
  }
  const result = await dependencies.reportGeneration.generate({
    correlationId: request.correlationId,
    requestedBy: request.requestedBy,
    context: request.context,
    reportId: request.brief.reportId,
    title,
    purpose,
    outputFormat: request.brief.outputFormat,
    sections: request.brief.sections,
    sourceEvidenceIds: request.brief.sourceEvidenceIds,
    constraints: request.brief.constraints
  });
  if (result.status !== "SUCCESS" && result.status !== "PARTIAL") {
    return {
      status: "PROVIDER_FAILED",
      evidence: [],
      candidates: [],
      messages: [failureMessage(result)]
    };
  }
  const reports = result.data ?? [];
  if (reports.length === 0) {
    return {
      status: "NO_RESULT",
      evidence: [],
      candidates: [],
      messages: [
        ...result.messages,
        "Provider returned no generated report artifacts."
      ]
    };
  }
  const providerName = dependencies.reportGeneration.descriptor.name;
  const evidence = reports.map(
    (report, index) => reportEvidence(request, report, providerName, index)
  );
  const candidates = reports.map(
    (report, index) => reportCandidate(request, report, evidence[index], index)
  );
  return {
    status: result.status === "PARTIAL" ? "PARTIAL_SUCCESS" : "SUCCESS",
    evidence,
    candidates,
    messages: [
      ...result.messages,
      `${reports.length} generated report candidate(s) require human review before persistence or publication.`
    ]
  };
}
function readReportBrief(input) {
  const raw = input.context.attributes.reportBrief;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("REPORT_BRIEF_REQUIRED");
  }
  const value = raw;
  const outputFormats = ["MARKDOWN", "HTML", "PDF", "DOCX", "CSV"];
  if (typeof value.reportId !== "string" || typeof value.title !== "string" || typeof value.purpose !== "string" || typeof value.outputFormat !== "string" || !outputFormats.includes(
    value.outputFormat
  ) || !Array.isArray(value.sections) || !value.sections.every((item) => typeof item === "string") || !Array.isArray(value.sourceEvidenceIds) || !value.sourceEvidenceIds.every((item) => typeof item === "string") || !Array.isArray(value.constraints) || !value.constraints.every((item) => typeof item === "string")) {
    throw new Error("REPORT_BRIEF_INVALID");
  }
  return {
    reportId: value.reportId,
    title: value.title,
    purpose: value.purpose,
    outputFormat: value.outputFormat,
    sections: value.sections,
    sourceEvidenceIds: value.sourceEvidenceIds,
    constraints: value.constraints
  };
}
function createReportGenerationHandler(dependencies) {
  return {
    capability: "REPORT_GENERATION",
    async execute(input) {
      const report = await generateGovernedReportCandidates(
        dependencies,
        {
          correlationId: input.correlationId,
          requestedBy: input.requestedBy,
          context: input.context,
          brief: readReportBrief(input)
        }
      );
      if (report.status === "PROVIDER_NOT_CONFIGURED") {
        throw new Error("REPORT_GENERATION_PROVIDER_NOT_CONFIGURED");
      }
      if (report.status === "PROVIDER_FAILED") {
        throw new Error(
          `REPORT_GENERATION_PROVIDER_FAILED: ${report.messages.join(" ")}`
        );
      }
      return {
        capability: "REPORT_GENERATION",
        evidence: report.evidence,
        candidates: report.candidates,
        recommendations: [],
        messages: report.messages
      };
    }
  };
}

// packages/intelligence-core/src/capabilities/analytics-intelligence.ts
function requiredText4(value, code) {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function assertFinite(value, code) {
  if (!Number.isFinite(value)) throw new Error(code);
  return value;
}
function metricConfidence(metric) {
  const hasPrevious = metric.previousValue !== void 0;
  const hasExpectedRange = metric.expectedMin !== void 0 || metric.expectedMax !== void 0;
  return {
    score: hasPrevious || hasExpectedRange ? 0.9 : 0.75,
    band: hasPrevious || hasExpectedRange ? "VERY_HIGH" : "HIGH",
    rationale: [
      "Signal is computed deterministically from the governed metric snapshot.",
      "Confidence describes calculation quality; it does not authorize mutation."
    ]
  };
}
function metricSignals(metric) {
  const signals = [
    {
      signalId: `${metric.metricId}:current`,
      metricId: metric.metricId,
      kind: "CURRENT_VALUE",
      value: metric.value,
      requiresReview: false
    }
  ];
  if (metric.previousValue !== void 0) {
    const delta2 = metric.value - metric.previousValue;
    signals.push({
      signalId: `${metric.metricId}:delta`,
      metricId: metric.metricId,
      kind: "DELTA",
      value: metric.value,
      previousValue: metric.previousValue,
      delta: delta2,
      requiresReview: false
    });
    if (metric.previousValue !== 0) {
      signals.push({
        signalId: `${metric.metricId}:ratio-change`,
        metricId: metric.metricId,
        kind: "RATIO_CHANGE",
        value: metric.value,
        previousValue: metric.previousValue,
        delta: delta2,
        ratioChange: delta2 / Math.abs(metric.previousValue),
        requiresReview: false
      });
    }
  }
  const belowMin = metric.expectedMin !== void 0 && metric.value < metric.expectedMin;
  const aboveMax = metric.expectedMax !== void 0 && metric.value > metric.expectedMax;
  if (belowMin || aboveMax) {
    signals.push({
      signalId: `${metric.metricId}:range`,
      metricId: metric.metricId,
      kind: "OUT_OF_EXPECTED_RANGE",
      value: metric.value,
      ...metric.expectedMin === void 0 ? {} : { expectedMin: metric.expectedMin },
      ...metric.expectedMax === void 0 ? {} : { expectedMax: metric.expectedMax },
      requiresReview: true
    });
  }
  return signals;
}
function metricEvidence(input) {
  const confidence = metricConfidence(input.metric);
  return {
    evidenceId: `analytics:${input.snapshot.snapshotId}:${input.metric.metricId}`,
    correlationId: input.correlationId,
    context: input.context,
    capability: "ANALYTICS",
    sourceAuthority: {
      level: "FIRST_PARTY",
      sourceName: input.snapshot.sourceName,
      rationale: [
        "Analytics consumes a governed first-party metric snapshot.",
        "Computed signals are derived observations, not a replacement for source metrics."
      ]
    },
    observation: `Analytics computed ${input.signals.length} signal(s) for ${input.metric.label}.`,
    payload: {
      metricId: input.metric.metricId,
      label: input.metric.label,
      value: input.metric.value,
      ...input.metric.previousValue === void 0 ? {} : { previousValue: input.metric.previousValue },
      ...input.metric.unit === void 0 ? {} : { unit: input.metric.unit },
      signals: input.signals,
      snapshotCapturedAt: input.snapshot.capturedAt
    },
    confidence,
    fingerprint: `analytics|${input.snapshot.snapshotId}|${input.metric.metricId}|${input.metric.value}|${input.metric.previousValue ?? ""}`,
    createdAt: input.snapshot.capturedAt
  };
}
function reviewRecommendation2(input) {
  const confidence = metricConfidence(input.metric);
  return {
    recommendationId: `analytics-review:${input.snapshot.snapshotId}:${input.metric.metricId}`,
    correlationId: input.correlationId,
    context: input.context,
    actionType: "REVIEW_ANALYTICS_SIGNAL",
    title: `Review analytics signal: ${input.metric.label}`,
    explanation: "A deterministic metric signal is outside the configured expected range and requires human review.",
    priority: "P2",
    severity: "WARNING",
    source: "ANALYTICS",
    rationale: [
      `Observed value: ${input.signal.value}.`,
      ...input.signal.expectedMin === void 0 ? [] : [`Expected minimum: ${input.signal.expectedMin}.`],
      ...input.signal.expectedMax === void 0 ? [] : [`Expected maximum: ${input.signal.expectedMax}.`],
      "Analytics does not execute corrective actions automatically."
    ],
    evidenceIds: [input.evidenceId],
    confidence,
    risk: {
      level: "R1",
      reasons: [
        "The signal may require operational investigation.",
        "No domain mutation is authorized by the analytics result."
      ],
      requiresHumanReview: true
    },
    status: "OPEN",
    createdAt: input.snapshot.capturedAt
  };
}
function evaluateAnalyticsSnapshot(input) {
  const snapshotId = requiredText4(
    input.snapshot.snapshotId,
    "ANALYTICS_SNAPSHOT_ID_REQUIRED"
  );
  requiredText4(input.snapshot.sourceName, "ANALYTICS_SOURCE_NAME_REQUIRED");
  requiredText4(input.snapshot.capturedAt, "ANALYTICS_CAPTURED_AT_REQUIRED");
  const metricIds = /* @__PURE__ */ new Set();
  const allSignals = [];
  const evidence = [];
  const recommendations = [];
  for (const metric of input.snapshot.metrics) {
    const metricId = requiredText4(
      metric.metricId,
      "ANALYTICS_METRIC_ID_REQUIRED"
    );
    requiredText4(metric.label, "ANALYTICS_METRIC_LABEL_REQUIRED");
    assertFinite(metric.value, "ANALYTICS_METRIC_VALUE_INVALID");
    if (metric.previousValue !== void 0) {
      assertFinite(
        metric.previousValue,
        "ANALYTICS_METRIC_PREVIOUS_VALUE_INVALID"
      );
    }
    if (metric.expectedMin !== void 0) {
      assertFinite(metric.expectedMin, "ANALYTICS_EXPECTED_MIN_INVALID");
    }
    if (metric.expectedMax !== void 0) {
      assertFinite(metric.expectedMax, "ANALYTICS_EXPECTED_MAX_INVALID");
    }
    if (metric.expectedMin !== void 0 && metric.expectedMax !== void 0 && metric.expectedMin > metric.expectedMax) {
      throw new Error("ANALYTICS_EXPECTED_RANGE_INVALID");
    }
    if (metricIds.has(metricId)) {
      throw new Error("ANALYTICS_METRIC_ID_DUPLICATE");
    }
    metricIds.add(metricId);
    const signals = metricSignals(metric);
    allSignals.push(...signals);
    const metricEvidenceItem = metricEvidence({
      correlationId: input.correlationId,
      context: input.context,
      snapshot: { ...input.snapshot, snapshotId },
      metric,
      signals
    });
    evidence.push(metricEvidenceItem);
    const reviewSignal = signals.find(
      (signal) => signal.kind === "OUT_OF_EXPECTED_RANGE" && signal.requiresReview
    );
    if (reviewSignal) {
      recommendations.push(
        reviewRecommendation2({
          correlationId: input.correlationId,
          context: input.context,
          snapshot: { ...input.snapshot, snapshotId },
          metric,
          evidenceId: metricEvidenceItem.evidenceId,
          signal: reviewSignal
        })
      );
    }
  }
  return {
    snapshotId,
    signals: allSignals,
    evidence,
    recommendations
  };
}
function readAnalyticsSnapshot(input) {
  const raw = input.context.attributes.analyticsSnapshot;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("ANALYTICS_SNAPSHOT_REQUIRED");
  }
  const value = raw;
  if (typeof value.snapshotId !== "string" || typeof value.sourceName !== "string" || typeof value.capturedAt !== "string" || !Array.isArray(value.metrics)) {
    throw new Error("ANALYTICS_SNAPSHOT_INVALID");
  }
  const metrics = value.metrics.map((rawMetric) => {
    if (!rawMetric || typeof rawMetric !== "object" || Array.isArray(rawMetric)) {
      throw new Error("ANALYTICS_METRIC_INVALID");
    }
    const metric = rawMetric;
    if (typeof metric.metricId !== "string" || typeof metric.label !== "string" || typeof metric.value !== "number") {
      throw new Error("ANALYTICS_METRIC_INVALID");
    }
    return {
      metricId: metric.metricId,
      label: metric.label,
      value: metric.value,
      ...typeof metric.previousValue === "number" ? { previousValue: metric.previousValue } : {},
      ...typeof metric.unit === "string" ? { unit: metric.unit } : {},
      ...typeof metric.expectedMin === "number" ? { expectedMin: metric.expectedMin } : {},
      ...typeof metric.expectedMax === "number" ? { expectedMax: metric.expectedMax } : {}
    };
  });
  return {
    snapshotId: value.snapshotId,
    sourceName: value.sourceName,
    capturedAt: value.capturedAt,
    metrics
  };
}
function createAnalyticsIntelligenceHandler() {
  return {
    capability: "ANALYTICS",
    async execute(input) {
      const analytics = evaluateAnalyticsSnapshot({
        correlationId: input.correlationId,
        context: input.context,
        snapshot: readAnalyticsSnapshot(input)
      });
      return {
        capability: "ANALYTICS",
        evidence: analytics.evidence,
        candidates: [],
        recommendations: analytics.recommendations,
        messages: [
          `${analytics.signals.length} deterministic analytics signal(s) computed from governed context.`,
          "Analytics remains read-only and does not execute corrective actions."
        ]
      };
    }
  };
}

// packages/intelligence-core/src/capabilities/controlled-automation.ts
function requiredText5(value, code) {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function evaluateControlledAutomationPlan(input) {
  const automationId = requiredText5(
    input.plan.automationId,
    "AUTOMATION_ID_REQUIRED"
  );
  const title = requiredText5(input.plan.title, "AUTOMATION_TITLE_REQUIRED");
  const purpose = requiredText5(
    input.plan.purpose,
    "AUTOMATION_PURPOSE_REQUIRED"
  );
  const triggerDescription = requiredText5(
    input.plan.trigger.description,
    "AUTOMATION_TRIGGER_DESCRIPTION_REQUIRED"
  );
  const triggerSource = requiredText5(
    input.plan.trigger.source,
    "AUTOMATION_TRIGGER_SOURCE_REQUIRED"
  );
  const operationCode = requiredText5(
    input.plan.action.operationCode,
    "AUTOMATION_OPERATION_CODE_REQUIRED"
  );
  const operationKey = requiredText5(
    input.plan.action.operationKey,
    "AUTOMATION_OPERATION_KEY_REQUIRED"
  );
  if (input.plan.approvalMode !== "ALWAYS_REQUIRED") {
    throw new Error("AUTOMATION_APPROVAL_BYPASS_FORBIDDEN");
  }
  const plan = {
    automationId,
    title,
    purpose,
    trigger: {
      kind: input.plan.trigger.kind,
      description: triggerDescription,
      source: triggerSource
    },
    action: {
      operationCode,
      operationKey,
      requestPayload: input.plan.action.requestPayload
    },
    approvalMode: "ALWAYS_REQUIRED",
    enabled: input.plan.enabled
  };
  const recommendation = {
    recommendationId: `automation-review:${automationId}`,
    correlationId: input.correlationId,
    context: input.context,
    actionType: "PREPARE_CONTROLLED_AUTOMATION",
    title: `Review controlled automation: ${title}`,
    explanation: "Automation may prepare a controlled operation only after explicit human approval; it cannot confirm or execute the operation autonomously.",
    priority: "P2",
    severity: "WARNING",
    source: "AUTOMATION",
    rationale: [
      `Purpose: ${purpose}.`,
      `Trigger: ${plan.trigger.kind} \u2014 ${plan.trigger.description}.`,
      `Trigger source: ${plan.trigger.source}.`,
      `Controlled operation: ${operationCode}.`,
      plan.enabled ? "Plan is enabled for review, not autonomous execution." : "Plan is disabled and cannot proceed to controlled preparation.",
      "Human approval remains mandatory before Control Plane preparation.",
      "Control Plane confirmation remains a separate explicit human/application step."
    ],
    evidenceIds: [],
    confidence: {
      score: 1,
      band: "VERY_HIGH",
      rationale: [
        "The recommendation is derived deterministically from the declared automation plan.",
        "Confidence does not authorize approval, confirmation or execution."
      ]
    },
    risk: {
      level: "R3",
      reasons: [
        "The proposed automation targets a controlled domain operation.",
        "Automation must never bypass human approval or Control Plane confirmation."
      ],
      requiresHumanReview: true
    },
    status: "OPEN",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return {
    plan,
    recommendation,
    messages: [
      "Controlled automation plan evaluated.",
      "No trigger runtime, scheduler, mutation or confirmation was executed."
    ]
  };
}
function readAutomationPlan(input) {
  const raw = input.context.attributes.automationPlan;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("AUTOMATION_PLAN_REQUIRED");
  }
  const value = raw;
  const trigger = value.trigger;
  const action = value.action;
  if (typeof value.automationId !== "string" || typeof value.title !== "string" || typeof value.purpose !== "string" || value.approvalMode !== "ALWAYS_REQUIRED" || typeof value.enabled !== "boolean" || !trigger || typeof trigger !== "object" || Array.isArray(trigger) || !action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("AUTOMATION_PLAN_INVALID");
  }
  const triggerValue = trigger;
  const actionValue = action;
  const validTriggerKinds = [
    "MANUAL",
    "EVENT",
    "CONDITION",
    "TIME_WINDOW"
  ];
  if (typeof triggerValue.kind !== "string" || !validTriggerKinds.includes(
    triggerValue.kind
  ) || typeof triggerValue.description !== "string" || typeof triggerValue.source !== "string" || typeof actionValue.operationCode !== "string" || typeof actionValue.operationKey !== "string" || !actionValue.requestPayload || typeof actionValue.requestPayload !== "object" || Array.isArray(actionValue.requestPayload)) {
    throw new Error("AUTOMATION_PLAN_INVALID");
  }
  return {
    automationId: value.automationId,
    title: value.title,
    purpose: value.purpose,
    trigger: {
      kind: triggerValue.kind,
      description: triggerValue.description,
      source: triggerValue.source
    },
    action: {
      operationCode: actionValue.operationCode,
      operationKey: actionValue.operationKey,
      requestPayload: actionValue.requestPayload
    },
    approvalMode: "ALWAYS_REQUIRED",
    enabled: value.enabled
  };
}
function createControlledAutomationHandler() {
  return {
    capability: "AUTOMATION",
    async execute(input) {
      const evaluated = evaluateControlledAutomationPlan({
        correlationId: input.correlationId,
        context: input.context,
        plan: readAutomationPlan(input)
      });
      return {
        capability: "AUTOMATION",
        evidence: [],
        candidates: [],
        recommendations: [evaluated.recommendation],
        messages: evaluated.messages
      };
    }
  };
}
async function prepareControlledAutomationForControlPlane(input) {
  if (!input.plan.enabled) {
    return {
      status: "BLOCKED",
      reasons: ["AUTOMATION_PLAN_DISABLED"]
    };
  }
  if (input.plan.approvalMode !== "ALWAYS_REQUIRED") {
    return {
      status: "BLOCKED",
      reasons: ["AUTOMATION_APPROVAL_BYPASS_FORBIDDEN"]
    };
  }
  const mapping = {
    operationCode: input.plan.action.operationCode,
    operationKey: input.plan.action.operationKey,
    requestPayload: { ...input.plan.action.requestPayload }
  };
  return prepareApprovedRecommendationForControlPlane({
    recommendation: input.recommendation,
    decision: input.decision,
    mapping,
    controlPlane: input.controlPlane
  });
}

// packages/intelligence-core/src/capabilities/audit-intelligence.ts
function requiredText6(value, code) {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function toIsoString(value, code) {
  const raw = value instanceof Date ? value.toISOString() : value;
  const normalized = requiredText6(raw, code);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error(code);
  return parsed.toISOString();
}
function orchestrationEvents(input) {
  if (input.execution.result.correlationId !== input.request.correlationId) {
    throw new Error("AUDIT_ORCHESTRATION_CORRELATION_MISMATCH");
  }
  const occurredAt = toIsoString(
    input.observedAt,
    "AUDIT_OBSERVED_AT_INVALID"
  );
  const base = `orchestration:${input.request.requestId}`;
  const events = [
    {
      eventId: `${base}:request`,
      correlationId: input.request.correlationId,
      kind: "REQUEST",
      source: "INTELLIGENCE_ORCHESTRATOR",
      occurredAt,
      actorId: input.request.requestedBy,
      payload: {
        requestId: input.request.requestId,
        intentId: input.request.intent.intentId,
        expectedOutput: input.request.intent.expectedOutput,
        requestedCapabilities: input.request.intent.requestedCapabilities,
        contextType: input.request.context.type,
        ...input.request.context.entityId === void 0 ? {} : { entityId: input.request.context.entityId }
      }
    }
  ];
  input.execution.permissionDecisions.forEach((decision, index) => {
    events.push({
      eventId: `${base}:permission:${index + 1}:${decision.permission}`,
      correlationId: input.request.correlationId,
      kind: "PERMISSION_DECISION",
      source: "INTELLIGENCE_ORCHESTRATOR",
      occurredAt,
      actorId: input.request.principal.actorId,
      status: decision.allowed ? "ALLOWED" : "DENIED",
      payload: {
        permission: decision.permission,
        actionClass: decision.actionClass,
        reason: decision.reason
      }
    });
  });
  input.execution.executedCapabilities.forEach((capability, index) => {
    events.push({
      eventId: `${base}:capability:${index + 1}:${capability}`,
      correlationId: input.request.correlationId,
      kind: "CAPABILITY_EXECUTED",
      source: "INTELLIGENCE_ORCHESTRATOR",
      occurredAt,
      actorId: input.request.requestedBy,
      capability,
      payload: {
        capability
      }
    });
  });
  for (const evidence of input.execution.evidence) {
    if (evidence.correlationId !== input.request.correlationId) {
      throw new Error("AUDIT_EVIDENCE_CORRELATION_MISMATCH");
    }
    events.push({
      eventId: `${base}:evidence:${evidence.evidenceId}`,
      correlationId: evidence.correlationId,
      kind: "EVIDENCE_CREATED",
      source: "INTELLIGENCE_ORCHESTRATOR",
      occurredAt: toIsoString(
        evidence.createdAt,
        "AUDIT_EVIDENCE_CREATED_AT_INVALID"
      ),
      capability: evidence.capability,
      subjectId: evidence.evidenceId,
      payload: {
        fingerprint: evidence.fingerprint,
        sourceAuthority: evidence.sourceAuthority.level,
        confidence: evidence.confidence.score
      }
    });
  }
  for (const candidate of input.execution.candidates) {
    if (candidate.correlationId !== input.request.correlationId) {
      throw new Error("AUDIT_CANDIDATE_CORRELATION_MISMATCH");
    }
    events.push({
      eventId: `${base}:candidate:${candidate.candidateId}`,
      correlationId: candidate.correlationId,
      kind: "CANDIDATE_CREATED",
      source: "INTELLIGENCE_ORCHESTRATOR",
      occurredAt: toIsoString(
        candidate.createdAt,
        "AUDIT_CANDIDATE_CREATED_AT_INVALID"
      ),
      subjectId: candidate.candidateId,
      status: candidate.status,
      payload: {
        candidateType: candidate.type,
        evidenceIds: candidate.evidenceIds,
        confidence: candidate.confidence.score
      }
    });
  }
  for (const recommendation of input.execution.recommendations) {
    if (recommendation.correlationId !== input.request.correlationId) {
      throw new Error("AUDIT_RECOMMENDATION_CORRELATION_MISMATCH");
    }
    events.push({
      eventId: `${base}:recommendation:${recommendation.recommendationId}`,
      correlationId: recommendation.correlationId,
      kind: "RECOMMENDATION_CREATED",
      source: "INTELLIGENCE_ORCHESTRATOR",
      occurredAt: toIsoString(
        recommendation.createdAt,
        "AUDIT_RECOMMENDATION_CREATED_AT_INVALID"
      ),
      subjectId: recommendation.recommendationId,
      status: recommendation.status,
      payload: {
        actionType: recommendation.actionType,
        riskLevel: recommendation.risk.level,
        requiresHumanReview: recommendation.risk.requiresHumanReview,
        evidenceIds: recommendation.evidenceIds
      }
    });
  }
  events.push({
    eventId: `${base}:result`,
    correlationId: input.request.correlationId,
    kind: "RESULT",
    source: "INTELLIGENCE_ORCHESTRATOR",
    occurredAt,
    actorId: input.request.requestedBy,
    status: input.execution.result.status,
    payload: {
      executedCapabilities: input.execution.executedCapabilities,
      evidenceIds: input.execution.result.evidenceIds,
      candidateIds: input.execution.result.candidateIds,
      recommendationIds: input.execution.result.recommendationIds,
      messages: input.execution.result.messages
    }
  });
  return events;
}
function decisionEvent(decision) {
  return {
    eventId: `human-decision:${decision.decisionId}`,
    correlationId: decision.correlationId,
    kind: "HUMAN_DECISION",
    source: "HUMAN_REVIEW",
    occurredAt: toIsoString(
      decision.decidedAt,
      "AUDIT_DECISION_DECIDED_AT_INVALID"
    ),
    actorId: decision.decidedBy,
    subjectId: decision.recommendationId ?? decision.candidateId ?? decision.decisionId,
    status: decision.decision,
    payload: {
      decisionId: decision.decisionId,
      reason: decision.reason,
      ...decision.recommendationId === void 0 ? {} : { recommendationId: decision.recommendationId },
      ...decision.candidateId === void 0 ? {} : { candidateId: decision.candidateId }
    }
  };
}
function controlPlaneEvent(binding) {
  const event = binding.event;
  const occurredAt = toIsoString(
    event.occurredAt,
    "AUDIT_CONTROL_PLANE_OCCURRED_AT_INVALID"
  );
  const status = typeof event.resultSnapshot.status === "string" ? event.resultSnapshot.status : void 0;
  return {
    eventId: `control-plane:${event.domainCode}:${event.operationType}:${event.requestFingerprint}:${occurredAt}`,
    correlationId: requiredText6(
      binding.correlationId,
      "AUDIT_CONTROL_PLANE_CORRELATION_REQUIRED"
    ),
    kind: "CONTROL_PLANE_EVENT",
    source: "CONTROL_PLANE",
    occurredAt,
    actorId: event.actorId,
    ...event.entityId === null ? {} : { subjectId: event.entityId },
    ...status === void 0 ? {} : { status },
    payload: {
      domainCode: event.domainCode,
      operationType: event.operationType,
      operationKey: event.operationKey,
      requestFingerprint: event.requestFingerprint,
      resultSnapshot: event.resultSnapshot
    }
  };
}
function buildUnifiedIntelligenceAuditTrail(input) {
  const events = [
    ...(input.orchestrations ?? []).flatMap(orchestrationEvents),
    ...(input.decisions ?? []).map(decisionEvent),
    ...(input.controlPlaneEvents ?? []).map(controlPlaneEvent)
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const event of events) {
    requiredText6(event.correlationId, "AUDIT_CORRELATION_REQUIRED");
    if (seen.has(event.eventId)) {
      throw new Error(`DUPLICATE_AUDIT_EVENT_ID:${event.eventId}`);
    }
    seen.add(event.eventId);
  }
  const sorted = [...events].sort((left, right) => {
    const time = left.occurredAt.localeCompare(right.occurredAt);
    return time !== 0 ? time : left.eventId.localeCompare(right.eventId);
  });
  const correlationIds = [...new Set(sorted.map((event) => event.correlationId))];
  const sourceCounts = {
    INTELLIGENCE_ORCHESTRATOR: 0,
    HUMAN_REVIEW: 0,
    CONTROL_PLANE: 0
  };
  for (const event of sorted) sourceCounts[event.source] += 1;
  return {
    events: sorted,
    correlationIds,
    sourceCounts
  };
}
function readAuditSnapshot(input) {
  const raw = input.context.attributes.auditSnapshot;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("AUDIT_SNAPSHOT_REQUIRED");
  }
  const value = raw;
  if (typeof value.snapshotId !== "string" || !Array.isArray(value.events)) {
    throw new Error("AUDIT_SNAPSHOT_INVALID");
  }
  const events = value.events;
  for (const event of events) {
    if (!event || typeof event.eventId !== "string" || typeof event.correlationId !== "string" || typeof event.kind !== "string" || typeof event.source !== "string" || typeof event.occurredAt !== "string" || !event.payload || typeof event.payload !== "object") {
      throw new Error("AUDIT_SNAPSHOT_EVENT_INVALID");
    }
  }
  return {
    snapshotId: value.snapshotId,
    events
  };
}
function auditSummaryEvidence(input) {
  const sourceCounts = {
    INTELLIGENCE_ORCHESTRATOR: 0,
    HUMAN_REVIEW: 0,
    CONTROL_PLANE: 0
  };
  const correlationIds = /* @__PURE__ */ new Set();
  for (const event of input.snapshot.events) {
    correlationIds.add(event.correlationId);
    if (event.source in sourceCounts) {
      sourceCounts[event.source] += 1;
    }
  }
  return {
    evidenceId: `audit-summary:${input.snapshot.snapshotId}`,
    correlationId: input.correlationId,
    context: input.capabilityInput.context,
    capability: "AUDIT_INTELLIGENCE",
    sourceAuthority: {
      level: "FIRST_PARTY",
      sourceName: "unified-intelligence-audit",
      rationale: [
        "Summary is derived from governed first-party audit projections.",
        "The audit projection does not replace source-system audit authorities."
      ]
    },
    observation: `Unified audit snapshot contains ${input.snapshot.events.length} event(s) across ${correlationIds.size} correlation id(s).`,
    payload: {
      snapshotId: input.snapshot.snapshotId,
      eventCount: input.snapshot.events.length,
      correlationIds: [...correlationIds],
      sourceCounts
    },
    confidence: {
      score: 1,
      band: "VERY_HIGH",
      rationale: [
        "Counts are deterministic over the supplied governed audit snapshot.",
        "Audit confidence does not grant execution or mutation authority."
      ]
    },
    fingerprint: `audit-summary|${input.snapshot.snapshotId}|${input.snapshot.events.length}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function createAuditIntelligenceHandler() {
  return {
    capability: "AUDIT_INTELLIGENCE",
    async execute(input) {
      const snapshot = readAuditSnapshot(input);
      const evidence = auditSummaryEvidence({
        correlationId: input.correlationId,
        capabilityInput: input,
        snapshot
      });
      return {
        capability: "AUDIT_INTELLIGENCE",
        evidence: [evidence],
        candidates: [],
        recommendations: [],
        messages: [
          "Unified Intelligence audit snapshot summarized in read-only mode.",
          "No source audit record, decision or controlled operation was mutated."
        ]
      };
    }
  };
}

// packages/intelligence-core/src/capabilities/customer-intelligence.ts
function requireText5(value, label) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}
function confidenceFor4(snapshot) {
  const hasHistory = snapshot.orderCount > 0 || snapshot.purchaseCount > 0;
  return {
    score: hasHistory ? 0.9 : 0.75,
    band: hasHistory ? "VERY_HIGH" : "HIGH",
    rationale: [
      "Customer Intelligence uses first-party LIHEN customer/order/sale read models only.",
      hasHistory ? "Observed first-party commercial history is available." : "Customer exists but commercial history is not yet available."
    ]
  };
}
function sourceAuthority() {
  return {
    level: "FIRST_PARTY",
    sourceName: "LIHEN Customer Read Model",
    sourceUri: "lihen://customer/read-model",
    rationale: [
      "Derived only from LIHEN canonical Customer, Order and Sale authorities.",
      "No external provider or inferred sensitive attribute is used."
    ]
  };
}
function prepareCustomerIntelligence(input) {
  const correlationId = requireText5(
    input.correlationId,
    "Correlation ID"
  );
  const evidenceId = requireText5(input.evidenceId, "Evidence ID");
  const recommendationId = requireText5(
    input.recommendationId,
    "Recommendation ID"
  );
  const customerId = requireText5(
    input.snapshot.customerId,
    "Customer ID"
  );
  const fingerprint = requireText5(
    input.fingerprint,
    "Evidence fingerprint"
  );
  const createdAt = requireText5(input.createdAt, "Created at");
  const confidence = confidenceFor4(input.snapshot);
  const context = {
    contextId: `customer:${customerId}`,
    type: "CUSTOMER",
    entityId: customerId,
    attributes: {}
  };
  const evidence = {
    evidenceId,
    correlationId,
    context,
    capability: "CUSTOMER_INTELLIGENCE",
    sourceAuthority: sourceAuthority(),
    observation: "First-party Customer activity snapshot analyzed without autonomous mutation or contact.",
    payload: {
      customerId,
      status: input.snapshot.status,
      orderCount: input.snapshot.orderCount,
      purchaseCount: input.snapshot.purchaseCount,
      lifetimeValue: input.snapshot.lifetimeValue,
      lastOrderAt: input.snapshot.lastOrderAt,
      lastPurchaseAt: input.snapshot.lastPurchaseAt
    },
    confidence,
    fingerprint,
    createdAt
  };
  const hasPurchaseHistory = input.snapshot.purchaseCount > 0;
  const recommendation = {
    recommendationId,
    correlationId,
    context,
    actionType: hasPurchaseHistory ? "REVIEW_CUSTOMER_RELATIONSHIP" : "REVIEW_CUSTOMER_FIRST_PURCHASE_OPPORTUNITY",
    title: hasPurchaseHistory ? "Review customer relationship" : "Review first-purchase opportunity",
    explanation: hasPurchaseHistory ? "First-party purchase history exists. Human review may determine whether follow-up or a future governed marketing action is appropriate." : "No linked completed purchase is present in the supplied read model. Human review may determine whether a future governed action is appropriate.",
    priority: hasPurchaseHistory ? "P3" : "P4",
    severity: "INFO",
    source: "LIHEN Customer Read Model",
    rationale: [
      "Recommendation derived from first-party Customer, Order and Sale read models.",
      "No autonomous customer contact, lifecycle mutation or publication is authorized."
    ],
    evidenceIds: [evidenceId],
    confidence,
    risk: {
      level: "R2",
      reasons: [
        "Customer-related recommendation may influence a future governed business action."
      ],
      requiresHumanReview: true
    },
    status: "OPEN",
    createdAt
  };
  return {
    evidence,
    recommendation
  };
}

// packages/intelligence-core/src/capabilities/marketing-intelligence.ts
function requireText6(value, code) {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function confidenceFor5(snapshot) {
  const hasPerformance = snapshot.channelCount > 0 && (snapshot.totalEngagement > 0 || snapshot.totalConversions > 0 || snapshot.engagementRate !== null);
  return {
    score: hasPerformance ? 0.9 : 0.75,
    band: hasPerformance ? "VERY_HIGH" : "HIGH",
    rationale: [
      hasPerformance ? "Recommendation is supported by governed campaign performance signals." : "Campaign context is available but performance evidence is still limited.",
      "Confidence does not authorize publishing or customer contact."
    ]
  };
}
function sourceAuthority2() {
  return {
    level: "FIRST_PARTY",
    sourceName: "LIHEN Marketing Read Model",
    sourceUri: "lihen://marketing/read-model",
    rationale: [
      "Campaign and performance context originates from governed LIHEN read models.",
      "Marketing Intelligence remains advisory and provider-independent."
    ]
  };
}
function prepareMarketingIntelligence(input) {
  const correlationId = requireText6(
    input.correlationId,
    "MARKETING_CORRELATION_ID_REQUIRED"
  );
  const evidenceId = requireText6(
    input.evidenceId,
    "MARKETING_EVIDENCE_ID_REQUIRED"
  );
  const recommendationId = requireText6(
    input.recommendationId,
    "MARKETING_RECOMMENDATION_ID_REQUIRED"
  );
  const campaignId = requireText6(
    input.snapshot.campaignId,
    "MARKETING_CAMPAIGN_ID_REQUIRED"
  );
  requireText6(
    input.snapshot.campaignName,
    "MARKETING_CAMPAIGN_NAME_REQUIRED"
  );
  requireText6(
    input.snapshot.objective,
    "MARKETING_OBJECTIVE_REQUIRED"
  );
  requireText6(
    input.snapshot.audienceDescription,
    "MARKETING_AUDIENCE_REQUIRED"
  );
  const createdAt = requireText6(
    input.createdAt,
    "MARKETING_CREATED_AT_REQUIRED"
  );
  const fingerprint = requireText6(
    input.fingerprint,
    "MARKETING_FINGERPRINT_REQUIRED"
  );
  const context = {
    contextId: `marketing:${campaignId}`,
    type: "MARKETING",
    entityId: campaignId,
    attributes: {}
  };
  const confidence = confidenceFor5(input.snapshot);
  const evidence = {
    evidenceId,
    correlationId,
    context,
    capability: "MARKETING_INTELLIGENCE",
    sourceAuthority: sourceAuthority2(),
    observation: "Marketing campaign context analyzed without autonomous publication or customer contact.",
    payload: {
      campaignId,
      campaignName: input.snapshot.campaignName,
      objective: input.snapshot.objective,
      audienceDescription: input.snapshot.audienceDescription,
      channelCount: input.snapshot.channelCount,
      totalEngagement: input.snapshot.totalEngagement,
      totalConversions: input.snapshot.totalConversions,
      engagementRate: input.snapshot.engagementRate
    },
    confidence,
    fingerprint,
    createdAt
  };
  const recommendation = {
    recommendationId,
    correlationId,
    context,
    actionType: "REVIEW_MARKETING_STRATEGY",
    title: "Review marketing strategy",
    explanation: "Review campaign strategy, AIDA execution, channel adaptation and performance before any governed publication action.",
    priority: input.snapshot.totalConversions === 0 ? "P2" : "P3",
    severity: "INFO",
    source: "MARKETING_INTELLIGENCE",
    rationale: [
      "Campaign strategy may be improved using first-party performance evidence.",
      "Creative generation is a separate capability and generated assets are not canonical assets.",
      "Publishing and customer contact remain outside Marketing Intelligence authority."
    ],
    evidenceIds: [evidenceId],
    confidence,
    risk: {
      level: "R2",
      reasons: [
        "Marketing recommendations may influence future commercial communication.",
        "Publication or direct customer contact requires a separately governed action."
      ],
      requiresHumanReview: true
    },
    status: "OPEN",
    createdAt
  };
  return {
    evidence,
    recommendation
  };
}

// packages/intelligence-core/src/capabilities/conversation-intelligence.ts
function requireText7(value, code) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(code);
  }
  return normalized;
}
function confidenceFor6(snapshot) {
  const hasConversationEvidence = snapshot.messageCount > 0;
  return {
    score: hasConversationEvidence ? 0.9 : 0.7,
    band: hasConversationEvidence ? "VERY_HIGH" : "HIGH",
    rationale: [
      hasConversationEvidence ? "Recommendation is derived from a governed first-party conversation snapshot." : "Conversation metadata exists but message evidence is limited.",
      "Confidence does not authorize sending a message or contacting a customer."
    ]
  };
}
function authority() {
  return {
    level: "FIRST_PARTY",
    sourceName: "LIHEN Conversation Read Model",
    rationale: [
      "Conversation context originates from authorized first-party read models.",
      "Conversation Intelligence is advisory and does not send messages."
    ]
  };
}
function prepareConversationIntelligence(input) {
  const correlationId = requireText7(
    input.correlationId,
    "CONVERSATION_CORRELATION_ID_REQUIRED"
  );
  const evidenceId = requireText7(
    input.evidenceId,
    "CONVERSATION_EVIDENCE_ID_REQUIRED"
  );
  const recommendationId = requireText7(
    input.recommendationId,
    "CONVERSATION_RECOMMENDATION_ID_REQUIRED"
  );
  const conversationId = requireText7(
    input.snapshot.conversationId,
    "CONVERSATION_ID_REQUIRED"
  );
  requireText7(
    input.snapshot.channel,
    "CONVERSATION_CHANNEL_REQUIRED"
  );
  requireText7(
    input.snapshot.status,
    "CONVERSATION_STATUS_REQUIRED"
  );
  const fingerprint = requireText7(
    input.fingerprint,
    "CONVERSATION_FINGERPRINT_REQUIRED"
  );
  const createdAt = requireText7(
    input.createdAt,
    "CONVERSATION_CREATED_AT_REQUIRED"
  );
  const context = {
    contextId: `conversation:${conversationId}`,
    type: "CONVERSATION",
    entityId: conversationId,
    attributes: {}
  };
  const confidence = confidenceFor6(input.snapshot);
  const evidence = {
    evidenceId,
    correlationId,
    context,
    capability: "CONVERSATION_INTELLIGENCE",
    sourceAuthority: authority(),
    observation: "Authorized conversation context analyzed without sending, publishing or mutating customer data.",
    payload: {
      conversationId,
      channel: input.snapshot.channel,
      customerId: input.snapshot.customerId,
      orderId: input.snapshot.orderId,
      productIds: input.snapshot.productIds,
      messageCount: input.snapshot.messageCount,
      inboundCount: input.snapshot.inboundCount,
      outboundCount: input.snapshot.outboundCount,
      lastMessageDirection: input.snapshot.lastMessageDirection,
      status: input.snapshot.status,
      ...input.snapshot.intentKind ? { intentKind: input.snapshot.intentKind } : {},
      ...input.snapshot.intentConfidence !== void 0 ? { intentConfidence: input.snapshot.intentConfidence } : {},
      ...input.snapshot.intentRationale ? { intentRationale: input.snapshot.intentRationale } : {},
      ...input.snapshot.suggestedReply ? { suggestedReply: input.snapshot.suggestedReply } : {}
    },
    confidence,
    fingerprint,
    createdAt
  };
  const needsHumanResponse = input.snapshot.lastMessageDirection === "INBOUND" && input.snapshot.status !== "RESOLVED" && input.snapshot.status !== "CLOSED";
  const recommendation = {
    recommendationId,
    correlationId,
    context,
    actionType: needsHumanResponse ? "REVIEW_CONVERSATION_RESPONSE" : "REVIEW_CONVERSATION_STATE",
    title: needsHumanResponse ? "Review conversation response" : "Review conversation state",
    explanation: needsHumanResponse ? "The latest governed snapshot contains an inbound message and may require a human-reviewed response." : "Review the current conversation state before deciding whether any follow-up is appropriate.",
    priority: needsHumanResponse ? "P2" : "P4",
    severity: "INFO",
    source: "CONVERSATION_INTELLIGENCE",
    rationale: [
      `Conversation channel: ${input.snapshot.channel}.`,
      `Message count: ${input.snapshot.messageCount}.`,
      needsHumanResponse ? "Latest message direction is inbound." : "No automatic outbound response is warranted by this foundation.",
      ...input.snapshot.intentKind ? [`Governed intent classification: ${input.snapshot.intentKind}.`] : [],
      ...input.snapshot.suggestedReply ? ["A suggested reply is available for human review only."] : [],
      "Any drafted reply remains non-sent until a separately governed authorization exists."
    ],
    evidenceIds: [evidenceId],
    confidence,
    risk: {
      level: "R2",
      reasons: [
        "Conversation recommendations may influence customer communication.",
        "No outbound message is authorized by this recommendation."
      ],
      requiresHumanReview: true
    },
    status: "OPEN",
    createdAt
  };
  return {
    evidence,
    recommendation
  };
}
function readConversationSnapshot(input) {
  const raw = input.context.attributes.conversationSnapshot;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("CONVERSATION_SNAPSHOT_REQUIRED");
  }
  const value = raw;
  if (typeof value.conversationId !== "string" || typeof value.channel !== "string" || value.customerId !== null && typeof value.customerId !== "string" || value.orderId !== null && typeof value.orderId !== "string" || !Array.isArray(value.productIds) || !value.productIds.every((item) => typeof item === "string") || typeof value.messageCount !== "number" || typeof value.inboundCount !== "number" || typeof value.outboundCount !== "number" || value.lastMessageDirection !== null && value.lastMessageDirection !== "INBOUND" && value.lastMessageDirection !== "OUTBOUND" || typeof value.status !== "string") {
    throw new Error("CONVERSATION_SNAPSHOT_INVALID");
  }
  if (value.intentKind !== void 0 && typeof value.intentKind !== "string") {
    throw new Error("CONVERSATION_INTENT_KIND_INVALID");
  }
  if (value.intentConfidence !== void 0 && (typeof value.intentConfidence !== "number" || !Number.isFinite(value.intentConfidence) || value.intentConfidence < 0 || value.intentConfidence > 1)) {
    throw new Error("CONVERSATION_INTENT_CONFIDENCE_INVALID");
  }
  if (value.intentRationale !== void 0 && (!Array.isArray(value.intentRationale) || !value.intentRationale.every(
    (item) => typeof item === "string"
  ))) {
    throw new Error("CONVERSATION_INTENT_RATIONALE_INVALID");
  }
  if (value.suggestedReply !== void 0 && typeof value.suggestedReply !== "string") {
    throw new Error("CONVERSATION_SUGGESTED_REPLY_INVALID");
  }
  return {
    conversationId: value.conversationId,
    channel: value.channel,
    customerId: value.customerId,
    orderId: value.orderId,
    productIds: value.productIds,
    messageCount: value.messageCount,
    inboundCount: value.inboundCount,
    outboundCount: value.outboundCount,
    lastMessageDirection: value.lastMessageDirection,
    status: value.status,
    ...typeof value.intentKind === "string" ? { intentKind: value.intentKind } : {},
    ...typeof value.intentConfidence === "number" ? { intentConfidence: value.intentConfidence } : {},
    ...Array.isArray(value.intentRationale) ? { intentRationale: value.intentRationale } : {},
    ...typeof value.suggestedReply === "string" ? { suggestedReply: value.suggestedReply } : {}
  };
}
function createConversationIntelligenceHandler() {
  return {
    capability: "CONVERSATION_INTELLIGENCE",
    async execute(input) {
      const snapshot = readConversationSnapshot(input);
      const prepared = prepareConversationIntelligence({
        correlationId: input.correlationId,
        evidenceId: `conversation:${snapshot.conversationId}:evidence`,
        recommendationId: `conversation:${snapshot.conversationId}:recommendation`,
        snapshot,
        fingerprint: `conversation:${snapshot.conversationId}:${snapshot.messageCount}:${snapshot.status}`,
        createdAt: (/* @__PURE__ */ new Date(0)).toISOString()
      });
      return {
        capability: "CONVERSATION_INTELLIGENCE",
        evidence: [prepared.evidence],
        candidates: [],
        recommendations: [prepared.recommendation],
        messages: [
          "Governed conversation snapshot analyzed.",
          snapshot.intentKind ? `Governed intent classification available: ${snapshot.intentKind}.` : "No governed intent classification was supplied.",
          snapshot.suggestedReply ? "Suggested reply is available for human review and remains non-sent." : "No suggested reply was supplied."
        ]
      };
    }
  };
}
export {
  ASSISTANT_CONTEXT_TYPES,
  GOVERNED_PERMISSION,
  INTELLIGENCE_AUTONOMY_ALLOWED_CLASSES,
  INTELLIGENCE_PERMISSION,
  PROVIDER_CAPABILITY_MATRIX,
  analyzeInventoryIntelligence,
  analyzeOrdersSalesIntelligence,
  analyzeProcurementIntelligence,
  assertReviewItemDoesNotAuthorizeExecution,
  buildControlledActionRequest,
  buildIntelligenceOrchestrationPlan,
  buildUnifiedHumanReviewQueue,
  buildUnifiedIntelligenceAuditTrail,
  confirmPreparedControlPlaneIntent,
  createAnalyticsIntelligenceHandler,
  createAuditIntelligenceHandler,
  createControlledAutomationHandler,
  createConversationIntelligenceHandler,
  createCreativeIntelligenceHandler,
  createDocumentIntelligenceCapabilityHandler,
  createImageTransformationHandler,
  createReportGenerationHandler,
  definePermissionKey,
  evaluateAnalyticsSnapshot,
  evaluateControlledAutomationPlan,
  evaluatePermission,
  evaluateRecommendationAssurance,
  evidenceFromPersistedReconciliation,
  executeDocumentIntelligence,
  generateCreativeCandidates,
  generateGovernedReportCandidates,
  getProviderCapabilityBinding,
  orchestrateIntelligenceRequest,
  prepareApprovedRecommendationForControlPlane,
  prepareBrandAssetCandidate,
  prepareControlledAutomationForControlPlane,
  prepareConversationIntelligence,
  prepareCustomerIntelligence,
  prepareLihenAssistantRecommendation,
  prepareMarketingIntelligence,
  prepareProductReconciliation,
  prepareSupplierPriceEvidence,
  removeImageBackground,
  resolveAssistantContext,
  resolveAssistantContextBundle,
  resolveBrandSourceAuthority,
  reviewItemFromGenericSource,
  reviewItemFromRecommendation,
  reviewItemFromReconciliation,
  runLihenAssistantTurn,
  validateToolDescriptor
};

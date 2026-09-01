/**
 * LIHEN Intelligence Core — GAP-003
 *
 * Contract-only package. It establishes a shared language for Intelligence without
 * introducing provider implementations, persistence, permissions, orchestration,
 * UI behavior, or controlled mutations.
 */

export type CorrelationId = string;

export type IntelligencePriority = 'P1' | 'P2' | 'P3' | 'P4';

export type IntelligenceSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export type IntelligenceContextType =
  | 'GLOBAL'
  | 'PRODUCT'
  | 'BRAND'
  | 'SUPPLIER'
  | 'CATALOG'
  | 'INVENTORY'
  | 'PRICING'
  | 'PURCHASE'
  | 'ORDER'
  | 'SALE'
  | 'FINANCE'
  | 'AUDIT'
  | 'DOCUMENT'
  | 'ASSET';

export type BusinessLine = 'BEAUTY_CARE' | 'STYLE';

export interface IntelligenceContext {
  readonly contextId: string;
  readonly type: IntelligenceContextType;
  readonly entityId?: string;
  readonly businessLine?: BusinessLine;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export type IntelligenceCapabilityName =
  | 'VISION'
  | 'SEARCH'
  | 'VERIFICATION'
  | 'PRODUCT_INTELLIGENCE'
  | 'BRAND_INTELLIGENCE'
  | 'CATALOG_INTELLIGENCE'
  | 'DOCUMENT_INTELLIGENCE'
  | 'CREATIVE_INTELLIGENCE'
  | 'ANALYTICS'
  | 'AUTOMATION'
  | 'AUDIT_INTELLIGENCE'
  | 'ASSISTANT';

export interface IntelligenceCapability {
  readonly name: IntelligenceCapabilityName;
  readonly version: string;
  readonly description: string;
}

export type SourceAuthorityLevel =
  | 'OFFICIAL'
  | 'FIRST_PARTY'
  | 'VERIFIED_PARTNER'
  | 'SUPPLIER'
  | 'TRUSTED_SECONDARY'
  | 'UNVERIFIED'
  | 'GENERATED';

export interface SourceAuthority {
  readonly level: SourceAuthorityLevel;
  readonly sourceName: string;
  readonly sourceUri?: string;
  readonly rationale: readonly string[];
}

export type ConfidenceBand = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface Confidence {
  /**
   * Normalized confidence from 0 to 1. Confidence is evidence quality, not permission.
   */
  readonly score: number;
  readonly band: ConfidenceBand;
  readonly rationale: readonly string[];
}

export interface IntelligenceEvidence {
  readonly evidenceId: string;
  readonly correlationId: CorrelationId;
  readonly context: IntelligenceContext;
  readonly capability: IntelligenceCapabilityName;
  readonly sourceAuthority: SourceAuthority;
  readonly observation: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly confidence: Confidence;
  readonly fingerprint: string;
  readonly createdAt: string;
}

export type IntelligenceCandidateType =
  | 'PRODUCT_MATCH'
  | 'NEW_PRODUCT'
  | 'PRODUCT_VARIANT'
  | 'BRAND_IDENTITY'
  | 'BRAND_ASSET'
  | 'PRODUCT_ASSET'
  | 'CATEGORY_MAPPING'
  | 'PRICE_REVIEW'
  | 'SUPPLIER_MAPPING'
  | 'DATA_CORRECTION'
  | 'CATALOG_ASSET'
  | 'OTHER';

export type IntelligenceCandidateStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEFERRED'
  | 'SUPERSEDED';

export interface IntelligenceCandidate {
  readonly candidateId: string;
  readonly correlationId: CorrelationId;
  readonly type: IntelligenceCandidateType;
  readonly context: IntelligenceContext;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly evidenceIds: readonly string[];
  readonly confidence: Confidence;
  readonly status: IntelligenceCandidateStatus;
  readonly createdAt: string;
}

export type IntelligenceRiskLevel = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export interface IntelligenceRisk {
  readonly level: IntelligenceRiskLevel;
  readonly reasons: readonly string[];
  readonly requiresHumanReview: boolean;
}

export type IntelligenceRecommendationStatus =
  | 'OPEN'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEFERRED'
  | 'SUPERSEDED'
  | 'EXECUTED'
  | 'FAILED';

export interface IntelligenceRecommendation {
  readonly recommendationId: string;
  readonly correlationId: CorrelationId;
  readonly context: IntelligenceContext;
  readonly actionType: string;
  readonly title: string;
  readonly explanation: string;
  readonly priority: IntelligencePriority;
  readonly severity: IntelligenceSeverity;
  readonly source: string;
  readonly rationale: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly confidence: Confidence;
  readonly risk: IntelligenceRisk;
  readonly status: IntelligenceRecommendationStatus;
  readonly createdAt: string;
}

export type IntelligenceDecisionValue = 'APPROVE' | 'REJECT' | 'DEFER' | 'REPLACE';

export interface IntelligenceDecision {
  readonly decisionId: string;
  readonly correlationId: CorrelationId;
  readonly candidateId?: string;
  readonly recommendationId?: string;
  readonly decision: IntelligenceDecisionValue;
  readonly reason: string;
  readonly decidedBy: string;
  readonly decidedAt: string;
}

export type IntelligenceRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_FOR_REVIEW'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export interface IntelligenceRun {
  readonly runId: string;
  readonly correlationId: CorrelationId;
  readonly requestedBy: string;
  readonly context: IntelligenceContext;
  readonly requestedCapabilities: readonly IntelligenceCapabilityName[];
  readonly status: IntelligenceRunStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export type IntelligenceResultStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'NO_RESULT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'REQUIRES_REVIEW'
  | 'PERMISSION_DENIED'
  | 'POLICY_BLOCKED'
  | 'DEPENDENCY_FAILED'
  | 'COMMAND_FAILED';

export interface IntelligenceResult<T = unknown> {
  readonly correlationId: CorrelationId;
  readonly runId?: string;
  readonly status: IntelligenceResultStatus;
  readonly data?: T;
  readonly evidenceIds: readonly string[];
  readonly candidateIds: readonly string[];
  readonly recommendationIds: readonly string[];
  readonly messages: readonly string[];
}

export type ToolKind =
  | 'MODEL'
  | 'VISION'
  | 'SEARCH'
  | 'DOCUMENT'
  | 'GENERATION'
  | 'EMBEDDING'
  | 'DOMAIN_READ'
  | 'AUDIT_READ';

export interface ToolDescriptor {
  readonly toolId: string;
  readonly kind: ToolKind;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly readOnly: boolean;
}

/**
 * Shared structural contract for current deterministic dashboard recommendations.
 * It intentionally preserves priority, severity, source and rationale so the existing
 * dashboard intelligence can later adapt to the transversal model without losing meaning.
 */
export interface LegacyRecommendationSemantics {
  readonly priority: IntelligencePriority;
  readonly severity: IntelligenceSeverity;
  readonly source: string;
  readonly rationale: readonly string[];
}

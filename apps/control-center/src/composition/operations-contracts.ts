/**
 * GAP-009 — Operations Facade contracts.
 *
 * These are the public data contracts historically exported by operations.ts.
 * operations.ts re-exports them to preserve compatibility for existing consumers.
 */

export interface OperationalDashboardSummary {
  readonly productsTotal: number;
  readonly productsActive: number;
  readonly stockOnHandTotal: number;
  readonly stockReservedTotal: number;
  readonly stockPendingTotal: number;
  readonly stockAvailableTotal: number;
  readonly suppliersActive: number;
  readonly purchasesOpen: number;
  readonly ordersOpen: number;
  readonly salesCompleted: number;
  readonly salesTotalCop: number;
  readonly financialAccountsActive: number;
  readonly financialBalanceTotalCop: number;
  readonly integrityIssueCount: number;
  readonly auditedOperations: number;
}

export interface OperationalIntegrityCheck {
  readonly checkCode: string;
  readonly issueCount: number;
  readonly status: string;
}

export interface OperationalAuditRow {
  readonly id: string;
  readonly module: string;
  readonly operationType: string;
  readonly operationKey: string;
  readonly actorId: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly occurredAt: Date;
}

export interface ControlCenterOperationCatalogEntry {
  readonly operationCode: string;
  readonly functionName: string;
  readonly domainCode: string;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  readonly actionKind: string;
  readonly requiresConfirmation: boolean;
  readonly executionEnabled: boolean;
  readonly ownerAdminOnly: boolean;
  readonly description: string;
}

export interface ControlCenterOperationPreview {
  readonly intentId: string;
  readonly operationKey: string;
  readonly operationCode: string;
  readonly domainCode: string;
  readonly riskLevel: string;
  readonly actionKind: string;
  readonly requiresConfirmation: boolean;
  readonly executionEnabled: boolean;
  readonly status: string;
  readonly confirmationToken: string;
  readonly previewSnapshot: Record<string, unknown>;
  readonly expiresAt: Date;
}

export interface ControlCenterOperationConfirmation {
  readonly intentId: string;
  readonly operationCode: string;
  readonly status: string;
  readonly confirmedAt: Date | null;
  readonly executionEnabled: boolean;
  readonly executionNote: string;
}

export interface ControlCenterOperationTimelineRow {
  readonly domainCode: string;
  readonly operationType: string;
  readonly operationKey: string;
  readonly actorId: string;
  readonly entityId: string | null;
  readonly requestFingerprint: string;
  readonly resultSnapshot: Record<string, unknown>;
  readonly occurredAt: Date;
}

export interface ControlCenterOperationContractArgument {
  readonly name: string;
  readonly required: boolean;
}

export interface ControlCenterOperationContract {
  readonly operationCode: string;
  readonly domainCode: string;
  readonly riskLevel: string;
  readonly actionKind: string;
  readonly functionName: string;
  readonly executionEnabled: boolean;
  readonly requiresConfirmation: boolean;
  readonly identityArguments: string;
  readonly resultSignature: string;
  readonly operationKeyFirst: boolean;
  readonly payloadArguments: readonly ControlCenterOperationContractArgument[];
}

export interface ControlCenterOperationPayloadValidation {
  readonly operationCode: string;
  readonly valid: boolean;
  readonly payloadIsObject: boolean;
  readonly missingRequiredKeys: readonly string[];
  readonly unexpectedKeys: readonly string[];
  readonly expectedArguments: readonly ControlCenterOperationContractArgument[];
  readonly executionEnabled: boolean;
  readonly validationNote: string;
}

export interface ControlCenterOperationExecutionReadiness {
  readonly operationCode: string;
  readonly domainCode: string;
  readonly riskLevel: string;
  readonly catalogExecutionEnabled: boolean;
  readonly releaseStatus: string;
  readonly allowedEnvironment: string;
  readonly requiresExplicitRelease: boolean;
  readonly maxExecutionAttemptsPerHour: number;
  readonly readinessStatus: string;
}

export interface ControlCenterOperationDispatchContract {
  readonly operationCode: string;
  readonly domainCode: string;
  readonly riskLevel: string;
  readonly functionName: string;
  readonly identityArguments: string;
  readonly resultSignature: string;
  readonly payloadArguments: readonly ControlCenterOperationContractArgument[];
  readonly releaseStatus: string;
  readonly allowedEnvironment: string;
  readonly maxExecutionAttemptsPerHour: number;
  readonly dispatchAllowed: boolean;
  readonly dispatchStatus: string;
}

export interface Phase66ControlPlaneClosureReadiness {
  readonly readinessStatus: string;
  readonly requiredGates: number;
  readonly passedGates: number;
  readonly operations: number;
  readonly executionDisabled: number;
  readonly releaseHeld: number;
  readonly dispatchContracts: number;
  readonly dispatchHeld: number;
  readonly closureMode: string;
}

export interface Phase7ControlledExecutionEntryReadiness {
  readonly readinessStatus: string;
  readonly operations: number;
  readonly executionDisabled: number;
  readonly canaryCandidateOperations: number;
  readonly nonCanaryOperations: number;
  readonly held: number;
  readonly zeroAttemptBudget: number;
}

export interface ControlCenterOperationCanarySimulation {
  readonly operationCode: string;
  readonly domainCode: string;
  readonly riskLevel: string;
  readonly functionName: string;
  readonly canaryEligible: boolean;
  readonly canaryEnabled: boolean;
  readonly maxCanaryAttemptsPerHour: number;
  readonly requiresManualRelease: boolean;
  readonly allowedEnvironment: string;
  readonly dispatchAllowed: boolean;
  readonly dispatchStatus: string;
  readonly simulationStatus: string;
}

export interface ControlCenterOperationCanaryExecutionGuard {
  readonly operationCode: string;
  readonly domainCode: string;
  readonly riskLevel: string;
  readonly canaryEligible: boolean;
  readonly canaryEnabled: boolean;
  readonly maxCanaryAttemptsPerHour: number;
  readonly approvalRequired: boolean;
  readonly approvalState: string;
  readonly releaseScope: string;
  readonly dispatchAllowed: boolean;
  readonly dispatchStatus: string;
  readonly executionAllowed: boolean;
  readonly guardStatus: string;
}

export interface Phase75CanaryControlPlaneClosureReadiness {
  readonly readinessStatus: string;
  readonly requiredGates: number;
  readonly passedGates: number;
  readonly operations: number;
  readonly blocked: number;
  readonly canaryDisabled: number;
  readonly zeroBudget: number;
  readonly closureMode: string;
}

export interface Phase8ControlledReleaseEntryReadiness {
  readonly readinessStatus: string;
  readonly operations: number;
  readonly blocked: number;
  readonly notRequested: number;
}

export interface ControlCenterOperationReleaseAuthorizationGuard {
  readonly operationCode: string;
  readonly domainCode: string;
  readonly riskLevel: string;
  readonly canaryEligible: boolean;
  readonly canaryEnabled: boolean;
  readonly maxCanaryAttemptsPerHour: number;
  readonly dispatchAllowed: boolean;
  readonly approvalState: string;
  readonly releaseRequestId: string | null;
  readonly requestStatus: string | null;
  readonly requestedEnvironment: string | null;
  readonly expiresAt: Date | null;
  readonly releaseAuthorized: boolean;
  readonly guardStatus: string;
}

export interface Phase84ReleaseControlPlaneClosureReadiness {
  readonly readinessStatus: string;
  readonly requiredGates: number;
  readonly passedGates: number;
  readonly operations: number;
  readonly blocked: number;
  readonly requests: number;
  readonly approvedRequests: number;
  readonly closureMode: string;
}

export interface ControlCenterOperationReleaseRequest {
  readonly releaseRequestId: string;
  readonly operationCode: string;
  readonly requestStatus: string;
  readonly requestedEnvironment: string;
  readonly expiresAt: Date;
}

export interface ControlCenterOperationReleaseDecision {
  readonly releaseRequestId: string;
  readonly operationCode: string;
  readonly requestStatus: string;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
  readonly expiresAt: Date;
}

export interface ControlCenterGovernanceAuditEvent {
  readonly eventSource: string;
  readonly eventId: string;
  readonly operationCode: string;
  readonly actorId: string;
  readonly eventStatus: string;
  readonly correlationKey: string;
  readonly occurredAt: Date;
  readonly eventMetadata: Record<string, unknown>;
}

export interface Phase87ReleaseGovernanceHardeningClosureReadiness {
  readonly readinessStatus: string;
  readonly requiredGates: number;
  readonly passedGates: number;
  readonly operations: number;
  readonly executionDisabled: number;
  readonly canaryDisabled: number;
  readonly zeroCanaryBudget: number;
  readonly releaseBlocked: number;
  readonly releaseRequests: number;
  readonly pendingRequests: number;
  readonly approvedRequests: number;
  readonly stalePreviewed: number;
  readonly closureMode: string;
}

export interface Phase64PreExecutionReadiness {
  readonly readinessStatus: string;
  readonly requiredGates: number;
  readonly passedGates: number;
  readonly operations: number;
  readonly executionDisabled: number;
  readonly held: number;
  readonly zeroAttemptBudget: number;
  readonly validContracts: number;
  readonly executionReleaseStatus: string;
}

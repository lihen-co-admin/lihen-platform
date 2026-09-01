import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';

import type {
  OperationalDashboardSummary,
  OperationalIntegrityCheck,
  OperationalAuditRow,
  ControlCenterOperationCatalogEntry,
  ControlCenterOperationPreview,
  ControlCenterOperationConfirmation,
  ControlCenterOperationTimelineRow,
  ControlCenterOperationContract,
  ControlCenterOperationPayloadValidation,
  ControlCenterOperationExecutionReadiness,
  ControlCenterOperationDispatchContract,
  Phase66ControlPlaneClosureReadiness,
  Phase7ControlledExecutionEntryReadiness,
  ControlCenterOperationCanarySimulation,
  ControlCenterOperationCanaryExecutionGuard,
  Phase75CanaryControlPlaneClosureReadiness,
  Phase8ControlledReleaseEntryReadiness,
  ControlCenterOperationReleaseAuthorizationGuard,
  Phase84ReleaseControlPlaneClosureReadiness,
  ControlCenterOperationReleaseRequest,
  ControlCenterOperationReleaseDecision,
  ControlCenterGovernanceAuditEvent,
  Phase87ReleaseGovernanceHardeningClosureReadiness,
  Phase64PreExecutionReadiness,
} from './operations-contracts';
import {
  booleanValue,
  firstRpcRow,
  numberValue,
  rowObject,
} from './operations-mappers';

export type {
  OperationalDashboardSummary,
  OperationalIntegrityCheck,
  OperationalAuditRow,
  ControlCenterOperationCatalogEntry,
  ControlCenterOperationPreview,
  ControlCenterOperationConfirmation,
  ControlCenterOperationTimelineRow,
  ControlCenterOperationContractArgument,
  ControlCenterOperationContract,
  ControlCenterOperationPayloadValidation,
  ControlCenterOperationExecutionReadiness,
  ControlCenterOperationDispatchContract,
  Phase66ControlPlaneClosureReadiness,
  Phase7ControlledExecutionEntryReadiness,
  ControlCenterOperationCanarySimulation,
  ControlCenterOperationCanaryExecutionGuard,
  Phase75CanaryControlPlaneClosureReadiness,
  Phase8ControlledReleaseEntryReadiness,
  ControlCenterOperationReleaseAuthorizationGuard,
  Phase84ReleaseControlPlaneClosureReadiness,
  ControlCenterOperationReleaseRequest,
  ControlCenterOperationReleaseDecision,
  ControlCenterGovernanceAuditEvent,
  Phase87ReleaseGovernanceHardeningClosureReadiness,
  Phase64PreExecutionReadiness,
} from './operations-contracts';

export function createOperationsComposition(env: Record<string, unknown> = import.meta.env) {
  const parsed = parseBrowserEnv(env);
  if (parsed.VITE_PRODUCT_READ_SOURCE !== 'supabase') {
    throw new Error('Operational observability requires Supabase DEV.');
  }

  const client = getBrowserSupabaseClient(env);

  return {
    async getDashboard(): Promise<OperationalDashboardSummary> {
      const { data, error } = await client
        .from('operational_dashboard_summary')
        .select('*')
        .single();
      if (error) throw new Error(`No fue posible leer el dashboard operativo: ${error.message}`);
      return {
        productsTotal: numberValue(data.products_total),
        productsActive: numberValue(data.products_active),
        stockOnHandTotal: numberValue(data.stock_on_hand_total),
        stockReservedTotal: numberValue(data.stock_reserved_total),
        stockPendingTotal: numberValue(data.stock_pending_total),
        stockAvailableTotal: numberValue(data.stock_available_total),
        suppliersActive: numberValue(data.suppliers_active),
        purchasesOpen: numberValue(data.purchases_open),
        ordersOpen: numberValue(data.orders_open),
        salesCompleted: numberValue(data.sales_completed),
        salesTotalCop: numberValue(data.sales_total_cop),
        financialAccountsActive: numberValue(data.financial_accounts_active),
        financialBalanceTotalCop: numberValue(data.financial_balance_total_cop),
        integrityIssueCount: numberValue(data.integrity_issue_count),
        auditedOperations: numberValue(data.audited_operations),
      };
    },

    async getIntegrityChecks(): Promise<readonly OperationalIntegrityCheck[]> {
      const { data, error } = await client
        .from('operational_integrity_checks')
        .select('check_code,issue_count,status')
        .order('check_code');
      if (error) throw new Error(`No fue posible leer integridad operacional: ${error.message}`);
      return (data ?? []).map((row) => ({
        checkCode: String(row.check_code),
        issueCount: numberValue(row.issue_count),
        status: String(row.status),
      }));
    },

    async getAudit(limit = 50): Promise<readonly OperationalAuditRow[]> {
      const { data, error } = await client
        .from('operational_audit_log')
        .select('id,module,operation_type,operation_key,actor_id,entity_type,entity_id,occurred_at')
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(`No fue posible leer la bitácora operacional: ${error.message}`);
      return (data ?? []).map((row) => ({
        id: String(row.id),
        module: String(row.module),
        operationType: String(row.operation_type),
        operationKey: String(row.operation_key),
        actorId: String(row.actor_id),
        entityType: String(row.entity_type),
        entityId: row.entity_id ? String(row.entity_id) : null,
        occurredAt: new Date(String(row.occurred_at)),
      }));
    },

    async getControlCenterOperationCatalog(): Promise<readonly ControlCenterOperationCatalogEntry[]> {
      const { data, error } = await client.rpc('get_control_center_operation_catalog_controlled');
      if (error) throw new Error(`No fue posible leer el catálogo operacional: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((raw) => {
        const row = rowObject(raw);
        return {
          operationCode: String(row.operation_code ?? ''),
          functionName: String(row.function_name ?? ''),
          domainCode: String(row.domain_code ?? ''),
          riskLevel: String(row.risk_level ?? ''),
          actionKind: String(row.action_kind ?? ''),
          requiresConfirmation: booleanValue(row.requires_confirmation),
          executionEnabled: booleanValue(row.execution_enabled),
          ownerAdminOnly: booleanValue(row.owner_admin_only),
          description: String(row.description ?? ''),
        };
      });
    },

    async getControlCenterOperationContracts(): Promise<readonly ControlCenterOperationContract[]> {
      const { data, error } = await client.rpc('get_control_center_operation_contracts_controlled');
      if (error) throw new Error(`No fue posible leer los contratos operacionales: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((raw) => {
        const row = rowObject(raw);
        const args = Array.isArray(row.payload_arguments) ? row.payload_arguments : [];
        return {
          operationCode: String(row.operation_code ?? ''),
          domainCode: String(row.domain_code ?? ''),
          riskLevel: String(row.risk_level ?? ''),
          actionKind: String(row.action_kind ?? ''),
          functionName: String(row.function_name ?? ''),
          executionEnabled: booleanValue(row.execution_enabled),
          requiresConfirmation: booleanValue(row.requires_confirmation),
          identityArguments: String(row.identity_arguments ?? ''),
          resultSignature: String(row.result_signature ?? ''),
          operationKeyFirst: booleanValue(row.operation_key_first),
          payloadArguments: args.map((arg) => {
            const item = rowObject(arg);
            return { name: String(item.name ?? ''), required: booleanValue(item.required) };
          }),
        };
      });
    },

    async validateOperationPayload(
      operationCode: string,
      requestPayload: Record<string, unknown>,
    ): Promise<ControlCenterOperationPayloadValidation> {
      const { data, error } = await client.rpc('validate_control_center_operation_payload_controlled', {
        p_operation_code: operationCode,
        p_request_payload: requestPayload,
      });
      if (error) throw new Error(`No fue posible validar el payload operacional: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('La validación no devolvió resultado.');
      const args = Array.isArray(row.expected_arguments) ? row.expected_arguments : [];
      return {
        operationCode: String(row.operation_code ?? ''),
        valid: booleanValue(row.valid),
        payloadIsObject: booleanValue(row.payload_is_object),
        missingRequiredKeys: Array.isArray(row.missing_required_keys) ? row.missing_required_keys.map(String) : [],
        unexpectedKeys: Array.isArray(row.unexpected_keys) ? row.unexpected_keys.map(String) : [],
        expectedArguments: args.map((arg) => {
          const item = rowObject(arg);
          return { name: String(item.name ?? ''), required: booleanValue(item.required) };
        }),
        executionEnabled: booleanValue(row.execution_enabled),
        validationNote: String(row.validation_note ?? ''),
      };
    },

    async getControlCenterExecutionReadiness(): Promise<readonly ControlCenterOperationExecutionReadiness[]> {
      const { data, error } = await client.rpc('get_control_center_operation_execution_readiness_controlled');
      if (error) throw new Error(`No fue posible leer el guard de ejecución: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((raw) => {
        const row = rowObject(raw);
        return {
          operationCode: String(row.operation_code ?? ''),
          domainCode: String(row.domain_code ?? ''),
          riskLevel: String(row.risk_level ?? ''),
          catalogExecutionEnabled: booleanValue(row.catalog_execution_enabled),
          releaseStatus: String(row.release_status ?? ''),
          allowedEnvironment: String(row.allowed_environment ?? ''),
          requiresExplicitRelease: booleanValue(row.requires_explicit_release),
          maxExecutionAttemptsPerHour: numberValue(row.max_execution_attempts_per_hour),
          readinessStatus: String(row.readiness_status ?? ''),
        };
      });
    },

    async getPhase64PreExecutionReadiness(): Promise<Phase64PreExecutionReadiness> {
      const { data, error } = await client.rpc('get_phase6_4_pre_execution_readiness_controlled');
      if (error) throw new Error(`No fue posible leer el gate 6.4: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('El gate 6.4 no devolvió resultado.');
      return {
        readinessStatus: String(row.readiness_status ?? ''),
        requiredGates: numberValue(row.required_gates),
        passedGates: numberValue(row.passed_gates),
        operations: numberValue(row.operations),
        executionDisabled: numberValue(row.execution_disabled),
        held: numberValue(row.held),
        zeroAttemptBudget: numberValue(row.zero_attempt_budget),
        validContracts: numberValue(row.valid_contracts),
        executionReleaseStatus: String(row.execution_release_status ?? ''),
      };
    },


    async getControlCenterDispatchContracts(): Promise<readonly ControlCenterOperationDispatchContract[]> {
      const { data, error } = await client.rpc('get_control_center_operation_dispatch_contracts_controlled');
      if (error) throw new Error(`No fue posible leer los contratos de dispatch: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((raw) => {
        const row = rowObject(raw);
        const args = Array.isArray(row.payload_arguments) ? row.payload_arguments : [];
        return {
          operationCode: String(row.operation_code ?? ''),
          domainCode: String(row.domain_code ?? ''),
          riskLevel: String(row.risk_level ?? ''),
          functionName: String(row.function_name ?? ''),
          identityArguments: String(row.identity_arguments ?? ''),
          resultSignature: String(row.result_signature ?? ''),
          payloadArguments: args.map((arg) => {
            const item = rowObject(arg);
            return { name: String(item.name ?? ''), required: booleanValue(item.required) };
          }),
          releaseStatus: String(row.release_status ?? ''),
          allowedEnvironment: String(row.allowed_environment ?? ''),
          maxExecutionAttemptsPerHour: numberValue(row.max_execution_attempts_per_hour),
          dispatchAllowed: booleanValue(row.dispatch_allowed),
          dispatchStatus: String(row.dispatch_status ?? ''),
        };
      });
    },

    async getPhase66ControlPlaneClosureReadiness(): Promise<Phase66ControlPlaneClosureReadiness> {
      const { data, error } = await client.rpc('get_phase6_6_control_plane_closure_readiness_controlled');
      if (error) throw new Error(`No fue posible leer el cierre 6.6: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('El gate 6.6 no devolvió resultado.');
      return {
        readinessStatus: String(row.readiness_status ?? ''),
        requiredGates: numberValue(row.required_gates),
        passedGates: numberValue(row.passed_gates),
        operations: numberValue(row.operations),
        executionDisabled: numberValue(row.execution_disabled),
        releaseHeld: numberValue(row.release_held),
        dispatchContracts: numberValue(row.dispatch_contracts),
        dispatchHeld: numberValue(row.dispatch_held),
        closureMode: String(row.closure_mode ?? ''),
      };
    },

    async getPhase7ControlledExecutionEntryReadiness(): Promise<Phase7ControlledExecutionEntryReadiness> {
      const { data, error } = await client.rpc('get_phase7_controlled_execution_entry_readiness_controlled');
      if (error) throw new Error(`No fue posible leer la entrada FASE 7: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('La entrada FASE 7 no devolvió resultado.');
      return {
        readinessStatus: String(row.readiness_status ?? ''),
        operations: numberValue(row.operations),
        executionDisabled: numberValue(row.execution_disabled),
        canaryCandidateOperations: numberValue(row.canary_candidate_operations),
        nonCanaryOperations: numberValue(row.non_canary_operations),
        held: numberValue(row.held),
        zeroAttemptBudget: numberValue(row.zero_attempt_budget),
      };
    },

    async getControlCenterCanarySimulation(): Promise<readonly ControlCenterOperationCanarySimulation[]> {
      const { data, error } = await client.rpc('get_control_center_operation_canary_simulation_controlled');
      if (error) throw new Error(`No fue posible leer la simulación canary: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((raw) => {
        const row = rowObject(raw);
        return {
          operationCode: String(row.operation_code ?? ''),
          domainCode: String(row.domain_code ?? ''),
          riskLevel: String(row.risk_level ?? ''),
          functionName: String(row.function_name ?? ''),
          canaryEligible: booleanValue(row.canary_eligible),
          canaryEnabled: booleanValue(row.canary_enabled),
          maxCanaryAttemptsPerHour: numberValue(row.max_canary_attempts_per_hour),
          requiresManualRelease: booleanValue(row.requires_manual_release),
          allowedEnvironment: String(row.allowed_environment ?? ''),
          dispatchAllowed: booleanValue(row.dispatch_allowed),
          dispatchStatus: String(row.dispatch_status ?? ''),
          simulationStatus: String(row.simulation_status ?? ''),
        };
      });
    },


    async getControlCenterCanaryExecutionGuard(): Promise<readonly ControlCenterOperationCanaryExecutionGuard[]> {
      const { data, error } = await client.rpc('get_control_center_operation_canary_execution_guard_controlled');
      if (error) throw new Error(`No fue posible leer el guard canary: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((raw) => {
        const row = rowObject(raw);
        return {
          operationCode: String(row.operation_code ?? ''),
          domainCode: String(row.domain_code ?? ''),
          riskLevel: String(row.risk_level ?? ''),
          canaryEligible: booleanValue(row.canary_eligible),
          canaryEnabled: booleanValue(row.canary_enabled),
          maxCanaryAttemptsPerHour: numberValue(row.max_canary_attempts_per_hour),
          approvalRequired: booleanValue(row.approval_required),
          approvalState: String(row.approval_state ?? ''),
          releaseScope: String(row.release_scope ?? ''),
          dispatchAllowed: booleanValue(row.dispatch_allowed),
          dispatchStatus: String(row.dispatch_status ?? ''),
          executionAllowed: booleanValue(row.execution_allowed),
          guardStatus: String(row.guard_status ?? ''),
        };
      });
    },

    async getPhase75CanaryControlPlaneClosureReadiness(): Promise<Phase75CanaryControlPlaneClosureReadiness> {
      const { data, error } = await client.rpc('get_phase7_5_canary_control_plane_closure_readiness_controlled');
      if (error) throw new Error(`No fue posible leer el cierre 7.5: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('El gate 7.5 no devolvió resultado.');
      return {
        readinessStatus: String(row.readiness_status ?? ''),
        requiredGates: numberValue(row.required_gates),
        passedGates: numberValue(row.passed_gates),
        operations: numberValue(row.operations),
        blocked: numberValue(row.blocked),
        canaryDisabled: numberValue(row.canary_disabled),
        zeroBudget: numberValue(row.zero_budget),
        closureMode: String(row.closure_mode ?? ''),
      };
    },

    async getPhase8ControlledReleaseEntryReadiness(): Promise<Phase8ControlledReleaseEntryReadiness> {
      const { data, error } = await client.rpc('get_phase8_controlled_release_entry_readiness_controlled');
      if (error) throw new Error(`No fue posible leer la entrada FASE 8: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('La entrada FASE 8 no devolvió resultado.');
      return {
        readinessStatus: String(row.readiness_status ?? ''),
        operations: numberValue(row.operations),
        blocked: numberValue(row.blocked),
        notRequested: numberValue(row.not_requested),
      };
    },

    async getControlCenterReleaseAuthorizationGuard(): Promise<readonly ControlCenterOperationReleaseAuthorizationGuard[]> {
      const { data, error } = await client.rpc('get_cc_release_auth_guard_controlled');
      if (error) throw new Error(`No fue posible leer el guard de autorización: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((raw) => {
        const row = rowObject(raw);
        return {
          operationCode: String(row.operation_code ?? ''),
          domainCode: String(row.domain_code ?? ''),
          riskLevel: String(row.risk_level ?? ''),
          canaryEligible: booleanValue(row.canary_eligible),
          canaryEnabled: booleanValue(row.canary_enabled),
          maxCanaryAttemptsPerHour: numberValue(row.max_canary_attempts_per_hour),
          dispatchAllowed: booleanValue(row.dispatch_allowed),
          approvalState: String(row.approval_state ?? ''),
          releaseRequestId: row.release_request_id ? String(row.release_request_id) : null,
          requestStatus: row.request_status ? String(row.request_status) : null,
          requestedEnvironment: row.requested_environment ? String(row.requested_environment) : null,
          expiresAt: row.expires_at ? new Date(String(row.expires_at)) : null,
          releaseAuthorized: booleanValue(row.release_authorized),
          guardStatus: String(row.guard_status ?? ''),
        };
      });
    },

    async getPhase84ReleaseControlPlaneClosureReadiness(): Promise<Phase84ReleaseControlPlaneClosureReadiness> {
      const { data, error } = await client.rpc('get_phase8_4_release_control_plane_closure_readiness_controlled');
      if (error) throw new Error(`No fue posible leer el cierre 8.4: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('El gate 8.4 no devolvió resultado.');
      return {
        readinessStatus: String(row.readiness_status ?? ''),
        requiredGates: numberValue(row.required_gates),
        passedGates: numberValue(row.passed_gates),
        operations: numberValue(row.operations),
        blocked: numberValue(row.blocked),
        requests: numberValue(row.requests),
        approvedRequests: numberValue(row.approved_requests),
        closureMode: String(row.closure_mode ?? ''),
      };
    },

    async requestCanaryRelease(
      operationCode: string,
      requestReason: string,
    ): Promise<ControlCenterOperationReleaseRequest> {
      const { data, error } = await client.rpc('request_control_center_canary_release_controlled', {
        p_operation_code: operationCode,
        p_request_reason: requestReason,
      });
      if (error) throw new Error(`No fue posible crear la solicitud de release: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('La solicitud de release no devolvió resultado.');
      return {
        releaseRequestId: String(row.release_request_id ?? ''),
        operationCode: String(row.operation_code ?? ''),
        requestStatus: String(row.request_status ?? ''),
        requestedEnvironment: String(row.requested_environment ?? ''),
        expiresAt: new Date(String(row.expires_at)),
      };
    },

    async decideCanaryRelease(
      releaseRequestId: string,
      decision: 'APPROVED' | 'REJECTED',
    ): Promise<ControlCenterOperationReleaseDecision> {
      const { data, error } = await client.rpc('decide_control_center_canary_release_controlled', {
        p_release_request_id: releaseRequestId,
        p_decision: decision,
      });
      if (error) throw new Error(`No fue posible decidir la solicitud de release: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('La decisión de release no devolvió resultado.');
      return {
        releaseRequestId: String(row.release_request_id ?? ''),
        operationCode: String(row.operation_code ?? ''),
        requestStatus: String(row.request_status ?? ''),
        approvedBy: row.approved_by ? String(row.approved_by) : null,
        approvedAt: row.approved_at ? new Date(String(row.approved_at)) : null,
        expiresAt: new Date(String(row.expires_at)),
      };
    },


    async getGovernanceAuditTimeline(limit = 50): Promise<readonly ControlCenterGovernanceAuditEvent[]> {
      const { data, error } = await client.rpc('get_control_center_governance_audit_timeline_controlled', {
        p_limit: limit,
        p_offset: 0,
        p_event_source: null,
        p_operation_code: null,
        p_actor_id: null,
      });
      if (error) throw new Error(`No fue posible leer el timeline de governance: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((raw) => {
        const row = rowObject(raw);
        return {
          eventSource: String(row.event_source ?? ''),
          eventId: String(row.event_id ?? ''),
          operationCode: String(row.operation_code ?? ''),
          actorId: String(row.actor_id ?? ''),
          eventStatus: String(row.event_status ?? ''),
          correlationKey: String(row.correlation_key ?? ''),
          occurredAt: new Date(String(row.occurred_at)),
          eventMetadata: rowObject(row.event_metadata),
        };
      });
    },

    async getPhase87ReleaseGovernanceHardeningClosureReadiness(): Promise<Phase87ReleaseGovernanceHardeningClosureReadiness> {
      const { data, error } = await client.rpc('get_phase87_release_readiness_controlled');
      if (error) throw new Error(`No fue posible leer el cierre 8.7: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('El gate 8.7 no devolvió resultado.');
      return {
        readinessStatus: String(row.readiness_status ?? ''),
        requiredGates: numberValue(row.required_gates),
        passedGates: numberValue(row.passed_gates),
        operations: numberValue(row.operations),
        executionDisabled: numberValue(row.execution_disabled),
        canaryDisabled: numberValue(row.canary_disabled),
        zeroCanaryBudget: numberValue(row.zero_canary_budget),
        releaseBlocked: numberValue(row.release_blocked),
        releaseRequests: numberValue(row.release_requests),
        pendingRequests: numberValue(row.pending_requests),
        approvedRequests: numberValue(row.approved_requests),
        stalePreviewed: numberValue(row.stale_previewed),
        closureMode: String(row.closure_mode ?? ''),
      };
    },

    async prepareOperation(
      operationKey: string,
      operationCode: string,
      requestPayload: Record<string, unknown>,
    ): Promise<ControlCenterOperationPreview> {
      const { data, error } = await client.rpc('prepare_control_center_operation_controlled', {
        p_operation_key: operationKey,
        p_operation_code: operationCode,
        p_request_payload: requestPayload,
      });
      if (error) throw new Error(`No fue posible preparar la operación: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('La preparación no devolvió una intención operativa.');
      return {
        intentId: String(row.intent_id ?? ''),
        operationKey: String(row.operation_key ?? ''),
        operationCode: String(row.operation_code ?? ''),
        domainCode: String(row.domain_code ?? ''),
        riskLevel: String(row.risk_level ?? ''),
        actionKind: String(row.action_kind ?? ''),
        requiresConfirmation: booleanValue(row.requires_confirmation),
        executionEnabled: booleanValue(row.execution_enabled),
        status: String(row.status ?? ''),
        confirmationToken: String(row.confirmation_token ?? ''),
        previewSnapshot: rowObject(row.preview_snapshot),
        expiresAt: new Date(String(row.expires_at)),
      };
    },

    async confirmOperation(
      intentId: string,
      confirmationToken: string,
    ): Promise<ControlCenterOperationConfirmation> {
      const { data, error } = await client.rpc('confirm_control_center_operation_controlled', {
        p_intent_id: intentId,
        p_confirmation_token: confirmationToken,
      });
      if (error) throw new Error(`No fue posible confirmar la operación: ${error.message}`);
      const row = firstRpcRow(data);
      if (!row) throw new Error('La confirmación no devolvió una intención operativa.');
      return {
        intentId: String(row.intent_id ?? ''),
        operationCode: String(row.operation_code ?? ''),
        status: String(row.status ?? ''),
        confirmedAt: row.confirmed_at ? new Date(String(row.confirmed_at)) : null,
        executionEnabled: booleanValue(row.execution_enabled),
        executionNote: String(row.execution_note ?? ''),
      };
    },

    async getControlCenterAuditTimeline(
      limit = 50,
      offset = 0,
      domainCode: string | null = null,
    ): Promise<readonly ControlCenterOperationTimelineRow[]> {
      const { data, error } = await client.rpc('get_control_center_operation_audit_timeline_controlled', {
        p_limit: limit,
        p_offset: offset,
        p_domain_code: domainCode,
        p_operation_type: null,
        p_actor_id: null,
      });
      if (error) throw new Error(`No fue posible leer el timeline operacional: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((raw) => {
        const row = rowObject(raw);
        return {
          domainCode: String(row.domain_code ?? ''),
          operationType: String(row.operation_type ?? ''),
          operationKey: String(row.operation_key ?? ''),
          actorId: String(row.actor_id ?? ''),
          entityId: row.entity_id ? String(row.entity_id) : null,
          requestFingerprint: String(row.request_fingerprint ?? ''),
          resultSnapshot: rowObject(row.result_snapshot),
          occurredAt: new Date(String(row.occurred_at)),
        };
      });
    },
  };
}

export const operationsComposition = createOperationsComposition();

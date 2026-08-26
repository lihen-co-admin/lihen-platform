import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';

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

function numberValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function rowObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstRpcRow(data: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(data) ? data[0] : data;
  return candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

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

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

function numberValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
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
  };
}

export const operationsComposition = createOperationsComposition();

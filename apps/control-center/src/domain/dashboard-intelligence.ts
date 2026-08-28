export type IntelligencePriority = 'P1' | 'P2' | 'P3' | 'P4';
export type IntelligenceSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export interface IntelligenceDashboardSignalInput {
  readonly integrityIssueCount: number;
  readonly auditedOperations: number;
  readonly stockPendingTotal: number;
  readonly ordersOpen: number;
  readonly purchasesOpen: number;
  readonly stockAvailableTotal: number;
  readonly financialAccountsActive: number;
}

export interface LihenIntelligenceRecommendation {
  readonly id: string;
  readonly priority: IntelligencePriority;
  readonly severity: IntelligenceSeverity;
  readonly title: string;
  readonly explanation: string;
  readonly actionLabel?: string;
  readonly targetRoute?: string;
  readonly source: string;
  readonly rationale: readonly string[];
}

const PRIORITY_ORDER: Readonly<Record<IntelligencePriority, number>> = {
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
};

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Produce recomendaciones categóricas y explicables.
 *
 * La prioridad no se deriva de scores ni umbrales numéricos ocultos:
 * - P1: integridad / seguridad;
 * - P2: precondiciones operativas necesarias;
 * - P3: trabajo operativo ordinario;
 * - P4: observación / estado estable.
 *
 * Los conteos del dashboard explican la señal, pero no inventan una escala
 * cuantitativa de riesgo.
 */
export function evaluateDashboardIntelligence(
  input: IntelligenceDashboardSignalInput,
): readonly LihenIntelligenceRecommendation[] {
  const integrityIssues = clampNonNegative(input.integrityIssueCount);
  const auditedOperations = clampNonNegative(input.auditedOperations);
  const stockPending = clampNonNegative(input.stockPendingTotal);
  const ordersOpen = clampNonNegative(input.ordersOpen);
  const purchasesOpen = clampNonNegative(input.purchasesOpen);
  const stockAvailable = clampNonNegative(input.stockAvailableTotal);
  const activeFinancialAccounts = clampNonNegative(input.financialAccountsActive);

  const recommendations: LihenIntelligenceRecommendation[] = [];

  if (integrityIssues > 0) {
    recommendations.push({
      id: 'integrity-review',
      priority: 'P1',
      severity: 'CRITICAL',
      title: `${integrityIssues} hallazgos de integridad requieren revisión`,
      explanation: 'La integridad tiene precedencia sobre cualquier recomendación operativa sensible.',
      actionLabel: 'Revisar integridad',
      targetRoute: '/operations',
      source: 'dashboard operacional',
      rationale: [
        `${integrityIssues} hallazgos reportados`,
        `${auditedOperations} operaciones auditadas`,
        'La política LIHEN prioriza trazabilidad antes que velocidad operativa',
      ],
    });
  } else {
    recommendations.push({
      id: 'integrity-stable',
      priority: 'P4',
      severity: 'SUCCESS',
      title: 'Integridad operativa estable',
      explanation: `${auditedOperations} operaciones auditadas y sin inconsistencias reportadas en el resumen actual.`,
      actionLabel: 'Ver auditoría',
      targetRoute: '/operations',
      source: 'dashboard operacional',
      rationale: ['No hay hallazgos de integridad activos'],
    });
  }

  if (stockPending > 0) {
    recommendations.push({
      id: 'pending-stock',
      priority: 'P2',
      severity: 'WARNING',
      title: `${stockPending} unidades pendientes de ingreso`,
      explanation: 'Conviene resolver recepciones pendientes desde Compras para que el ledger represente el estado físico esperado.',
      actionLabel: 'Abrir compras',
      targetRoute: '/purchases',
      source: 'ledger de inventario',
      rationale: [
        `${stockPending} unidades pendientes`,
        `${purchasesOpen} compras abiertas`,
      ],
    });
  }

  if (ordersOpen > 0) {
    recommendations.push({
      id: 'orders-open',
      priority: 'P3',
      severity: 'INFO',
      title: `${ordersOpen} pedidos siguen abiertos`,
      explanation: 'Revisa su estado y reservas antes de completar venta, cancelar o liberar inventario.',
      actionLabel: 'Ver pedidos',
      targetRoute: '/orders',
      source: 'pedidos canónicos',
      rationale: [
        `${ordersOpen} pedidos abiertos`,
        `${stockAvailable} unidades disponibles`,
      ],
    });
  }

  if (activeFinancialAccounts === 0) {
    recommendations.push({
      id: 'finance-account-missing',
      priority: 'P2',
      severity: 'WARNING',
      title: 'No hay cuentas financieras activas',
      explanation: 'Las operaciones financieras controladas requieren una cuenta activa para registrar movimientos válidos.',
      actionLabel: 'Revisar finanzas',
      targetRoute: '/finance',
      source: 'read model financiero',
      rationale: ['0 cuentas financieras activas'],
    });
  }

  recommendations.push({
    id: 'execution-held',
    priority: 'P4',
    severity: 'INFO',
    title: 'Ejecución sensible continúa protegida',
    explanation: 'LIHEN Intelligence recomienda y prioriza; la decisión y ejecución permanecen bajo aprobación humana y governance.',
    actionLabel: 'Ver controles',
    targetRoute: '/operations',
    source: 'política de ejecución',
    rationale: ['Intelligence opera en modo READ ONLY'],
  });

  return recommendations
    .sort(
      (left, right) =>
        PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
        || left.id.localeCompare(right.id),
    )
    .slice(0, 5);
}

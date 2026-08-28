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
  readonly score: number;
  readonly severity: IntelligenceSeverity;
  readonly title: string;
  readonly explanation: string;
  readonly actionLabel?: string;
  readonly targetRoute?: string;
  readonly source: string;
  readonly rationale: readonly string[];
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function priorityForScore(score: number): IntelligencePriority {
  if (score >= 90) return 'P1';
  if (score >= 60) return 'P2';
  if (score >= 30) return 'P3';
  return 'P4';
}

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
    const score = 100 + Math.min(25, integrityIssues);
    recommendations.push({
      id: 'integrity-review',
      priority: priorityForScore(score),
      score,
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
      score: 10,
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
    const score = 55 + Math.min(30, stockPending);
    recommendations.push({
      id: 'pending-stock',
      priority: priorityForScore(score),
      score,
      severity: stockPending >= 20 ? 'WARNING' : 'INFO',
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
    const score = 45 + Math.min(25, ordersOpen * 2);
    recommendations.push({
      id: 'orders-open',
      priority: priorityForScore(score),
      score,
      severity: ordersOpen >= 10 ? 'WARNING' : 'INFO',
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
      score: 65,
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
    score: 5,
    severity: 'INFO',
    title: 'Ejecución sensible continúa protegida',
    explanation: 'LIHEN Intelligence recomienda y prioriza; la decisión y ejecución permanecen bajo aprobación humana y governance.',
    actionLabel: 'Ver controles',
    targetRoute: '/operations',
    source: 'política de ejecución',
    rationale: ['Intelligence opera en modo READ ONLY'],
  });

  return recommendations
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 5);
}

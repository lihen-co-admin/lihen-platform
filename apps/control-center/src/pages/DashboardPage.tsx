import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { operationsComposition, type OperationalDashboardSummary } from '../composition/operations';

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

export function DashboardPage() {
  const [summary, setSummary] = useState<OperationalDashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    operationsComposition.getDashboard().then(setSummary).catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar el dashboard operativo.');
    });
  }, []);

  return (
    <section className="stack">
      <PageHeader
        title="Dashboard"
        description="Estado operativo real del Control Center sobre Supabase DEV. Los datos legacy todavía no se cutoverean automáticamente."
      />

      {error ? <div className="error-state">{error}</div> : null}

      {summary ? (
        <>
          <div className="metric-grid">
            <article className="metric-card"><span>Productos canónicos</span><strong>{summary.productsTotal}</strong><small>{summary.productsActive} activos</small></article>
            <article className="metric-card"><span>ON_HAND</span><strong>{summary.stockOnHandTotal}</strong><small>{summary.stockAvailableTotal} disponibles</small></article>
            <article className="metric-card"><span>Reservado</span><strong>{summary.stockReservedTotal}</strong><small>{summary.stockPendingTotal} pendientes de ingreso</small></article>
            <article className="metric-card"><span>Proveedores activos</span><strong>{summary.suppliersActive}</strong><small>{summary.purchasesOpen} compras abiertas</small></article>
            <article className="metric-card"><span>Pedidos abiertos</span><strong>{summary.ordersOpen}</strong><small>{summary.salesCompleted} ventas completadas</small></article>
            <article className="metric-card"><span>Ventas registradas</span><strong>{formatCop(summary.salesTotalCop)}</strong><small>DEV canónico</small></article>
            <article className="metric-card"><span>Cuentas activas</span><strong>{summary.financialAccountsActive}</strong><small>{formatCop(summary.financialBalanceTotalCop)} saldo canónico</small></article>
            <article className={`metric-card ${summary.integrityIssueCount > 0 ? 'metric-card--alert' : 'metric-card--pass'}`}><span>Integridad operacional</span><strong>{summary.integrityIssueCount === 0 ? 'PASS' : summary.integrityIssueCount}</strong><small>{summary.auditedOperations} operaciones auditadas</small></article>
          </div>

          <div className="card-grid">
            <article className="card">
              <span className="card-label">FASE 2.1 → 2.3</span>
              <strong>Identidad + Product Master</strong>
              <p>Auth, perfil administrativo, RLS y escrituras controladas de producto validadas.</p>
            </article>
            <article className="card">
              <span className="card-label">FASE 2.4 → 2.9</span>
              <strong>Operación integrada en DEV</strong>
              <p>Inventario, proveedores, compras, pedidos, ventas, caja y controles de integridad ya tienen slices operativos.</p>
            </article>
            <article className="card">
              <span className="card-label">FASE 2.10 → 2.11</span>
              <strong>Observabilidad + auditoría</strong>
              <p>Dashboard real y bitácora append-only para operaciones controladas. Los dry-runs no dejan registros.</p>
            </article>
            <article className="card">
              <span className="card-label">FASE 2.12</span>
              <strong>Gate final pendiente</strong>
              <p>Requiere pnpm check, revisión visual final y commit limpio antes de cerrar formalmente Fase 2.</p>
            </article>
          </div>
        </>
      ) : !error ? <div className="info-state">Cargando estado operativo…</div> : null}
    </section>
  );
}

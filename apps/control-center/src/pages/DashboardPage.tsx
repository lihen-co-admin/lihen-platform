import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { operationsComposition, type OperationalDashboardSummary } from '../composition/operations';
import { evaluateDashboardIntelligence } from '../domain/dashboard-intelligence';
import { evaluateIntelligenceAssurance } from '../domain/intelligence-assurance';
import { summarizeIntelligenceDecisionPolicy } from '../domain/intelligence-decision-policy';
import { evaluateDashboardOperationalHealth } from '../domain/dashboard-operational-health';
import { evaluateDashboardMetricIntegrity } from '../domain/dashboard-metric-integrity';
import { evaluateDashboardFocusGuidance } from '../domain/dashboard-focus-guidance';
import {
  formatOperationalFocusLabel,
  resolveAdminExperienceState,
} from '../domain/admin-experience-state';

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

export function DashboardPage() {
  const [summary, setSummary] = useState<OperationalDashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    operationsComposition
      .getDashboard()
      .then(setSummary)
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : 'No fue posible cargar el dashboard operativo.',
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  const intelligence = useMemo(() => {
    if (!summary) return null;

    const recommendations = evaluateDashboardIntelligence(summary);
    const assurance = evaluateIntelligenceAssurance(recommendations);
    return {
      recommendations,
      assurance,
      decisionPolicy: summarizeIntelligenceDecisionPolicy(
        assurance.status,
        recommendations,
      ),
    };
  }, [summary]);

  const dashboardMetricIntegrity = useMemo(
    () => (summary ? evaluateDashboardMetricIntegrity(summary) : null),
    [summary],
  );

  const operationalHealth = useMemo(() => {
    if (!summary || !intelligence || !dashboardMetricIntegrity) return null;

    return evaluateDashboardOperationalHealth({
      integrityIssueCount: summary.integrityIssueCount,
      dashboardMetricIntegrityStatus: dashboardMetricIntegrity.status,
      intelligenceAssuranceStatus: intelligence.assurance.status,
      intelligenceApprovableCount: intelligence.decisionPolicy.approvableCount,
      intelligenceReviewCount: intelligence.decisionPolicy.reviewCount,
      intelligenceBlockedCount: intelligence.decisionPolicy.blockedCount,
      ordersOpen: summary.ordersOpen,
      purchasesOpen: summary.purchasesOpen,
      stockPendingTotal: summary.stockPendingTotal,
    });
  }, [summary, intelligence, dashboardMetricIntegrity]);

  const focusGuidance = useMemo(
    () => (operationalHealth ? evaluateDashboardFocusGuidance(operationalHealth) : null),
    [operationalHealth],
  );

  const experienceState = resolveAdminExperienceState({
    isLoading,
    errorMessage: error,
    hasData: Boolean(summary),
  });

  const insights = useMemo<readonly IntelligenceInsight[]>(() => {
    if (!intelligence) return [];

    return intelligence.recommendations.map((recommendation) => ({
      id: recommendation.id,
      severity: recommendation.severity,
      title: `${recommendation.priority} · ${recommendation.title}`,
      explanation: `${recommendation.explanation} Motivo: ${recommendation.rationale.join(' · ')}`,
      source: recommendation.source,
      ...(recommendation.actionLabel ? { actionLabel: recommendation.actionLabel } : {}),
      ...(recommendation.targetRoute ? { targetRoute: recommendation.targetRoute } : {}),
    }));
  }, [intelligence]);

  return (
    <section className="stack page-dashboard">
      <AdminPageHero
        eyebrow="LIHEN · visión operativa"
        title="Dashboard"
        description="Una lectura ejecutiva del catálogo, inventario, abastecimiento, pedidos, ventas, finanzas e integridad de LIHEN."
        accent="pink"
        status={<span className="status-badge status-badge--success">DEV · lectura segura</span>}
        actions={(
          <>
            <Link className="button-link" to="/products">Gestionar productos</Link>
            <Link className="button-link button-link--secondary" to="/operations">Revisar integridad</Link>
          </>
        )}
      />

      {experienceState.state === 'ERROR' ? (
        <div
          className="error-state"
          role={experienceState.role}
          aria-live={experienceState.ariaLive}
        >
          <strong>{experienceState.title}</strong>
          <p>{experienceState.message}</p>
        </div>
      ) : null}

      {summary ? (
        <>
          <SummaryStrip items={[
            { label: 'Productos', value: summary.productsTotal, detail: `${summary.productsActive} activos` },
            { label: 'Disponible', value: summary.stockAvailableTotal, detail: `${summary.stockOnHandTotal} ON_HAND` },
            { label: 'Pedidos abiertos', value: summary.ordersOpen, detail: `${summary.salesCompleted} ventas completadas` },
            { label: 'Ventas registradas', value: formatCop(summary.salesTotalCop), detail: 'DEV canónico' },
            { label: 'Saldo financiero', value: formatCop(summary.financialBalanceTotalCop), detail: `${summary.financialAccountsActive} cuentas activas` },
            { label: 'Integridad', value: summary.integrityIssueCount === 0 ? 'PASS' : summary.integrityIssueCount, detail: `${summary.auditedOperations} operaciones auditadas` },
            {
              label: 'Integridad Intelligence',
              value: intelligence?.assurance.status ?? '—',
              detail: intelligence ? `${intelligence.assurance.checkedRecommendations} recomendaciones verificadas` : 'sin evaluación',
            },
            {
              label: 'Decisión humana',
              value: intelligence?.decisionPolicy.approvableCount ?? '—',
              detail: intelligence
                ? `${intelligence.decisionPolicy.observeCount} informativas · ejecución manual`
                : 'sin evaluación',
            },
            {
              label: 'Integridad Dashboard',
              value: dashboardMetricIntegrity?.status ?? '—',
              detail: dashboardMetricIntegrity
                ? `${dashboardMetricIntegrity.checkedMetricCount} métricas verificadas`
                : 'sin evaluación',
            },
            {
              label: 'Salud operativa',
              value: operationalHealth?.status ?? '—',
              detail: operationalHealth
                ? `${operationalHealth.workQueueTotal} elementos · foco ${formatOperationalFocusLabel(operationalHealth.nextFocus)}`
                : 'sin evaluación',
            },
          ]} />

          <OperationalNotice
            title="Centro de control conectado"
            tone={
              summary.integrityIssueCount === 0 &&
              dashboardMetricIntegrity?.status === 'PASS' &&
              intelligence?.assurance.status === 'PASS'
                ? 'success'
                : 'warning'
            }
            meta={`Dashboard · salud ${operationalHealth?.status ?? 'sin evaluar'} · foco ${
              operationalHealth
                ? formatOperationalFocusLabel(operationalHealth.nextFocus)
                : '—'
            }`}
          >
            <p>Los indicadores resumen dominios conectados; no editan saldos, stock ni estados directamente desde esta pantalla.</p>
            {dashboardMetricIntegrity ? <p>{dashboardMetricIntegrity.explanation}</p> : null}
            {intelligence ? <p>{intelligence.assurance.explanation}</p> : null}
            {intelligence ? (
              <p>
                {intelligence.decisionPolicy.approvableCount} recomendaciones pueden
                presentarse para decisión humana; ninguna puede ejecutarse automáticamente.
              </p>
            ) : null}
            {operationalHealth ? <p>{operationalHealth.explanation}</p> : null}
            {focusGuidance ? (
              <p>
                <strong>{focusGuidance.title}.</strong> {focusGuidance.explanation}
              </p>
            ) : null}
            {focusGuidance?.targetRoute && focusGuidance.actionLabel ? (
              <p>
                <Link className="button-link button-link--secondary" to={focusGuidance.targetRoute}>
                  {focusGuidance.actionLabel}
                </Link>
              </p>
            ) : null}
          </OperationalNotice>

          <IntelligencePanel
            title="Siguientes acciones sugeridas"
            description="Señales explicables priorizadas por impacto y trazabilidad. LIHEN Intelligence permanece en modo READ ONLY y no ejecuta cambios."
            insights={insights}
          />

          <div className="section-heading">
            <div><span className="section-kicker">Capacidades</span><h2>Un ecosistema, varios dominios</h2></div>
          </div>
          <div className="card-grid capability-grid">
            <article className="card"><span className="card-label">Product Master</span><strong>Catálogo canónico</strong><p>Productos, marcas, categorías, precios e imágenes bajo contratos controlados.</p></article>
            <article className="card"><span className="card-label">Operación</span><strong>Abastecimiento + inventario</strong><p>Compras, pedidos, reservas, ventas y stock conectados al dominio operativo.</p></article>
            <article className="card"><span className="card-label">Finanzas</span><strong>Ledger trazable</strong><p>Ingresos, egresos, cuentas, transferencias y reversión sin borrar historia.</p></article>
            <article className="card"><span className="card-label">Governance</span><strong>Protección activa</strong><p>Auditoría, readiness y gates mantienen separada la ejecución sensible.</p></article>
          </div>
        </>
      ) : experienceState.state === 'LOADING' ? (
        <div
          className="loading-card"
          role={experienceState.role}
          aria-live={experienceState.ariaLive}
          aria-busy={experienceState.ariaBusy}
        >
          <span className="loading-spinner" aria-hidden="true" />
          <div>
            <strong>{experienceState.title}</strong>
            <p>{experienceState.message}</p>
          </div>
        </div>
      ) : experienceState.state === 'EMPTY' ? (
        <div
          className="loading-card"
          role={experienceState.role}
          aria-live={experienceState.ariaLive}
        >
          <div>
            <strong>{experienceState.title}</strong>
            <p>{experienceState.message}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

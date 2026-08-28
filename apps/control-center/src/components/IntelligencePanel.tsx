import { useId } from 'react';
import { Link } from 'react-router-dom';
import { resolveIntelligencePanelEmptyState } from '../domain/admin-surface-semantics';

export type IntelligenceSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export interface IntelligenceInsight {
  readonly id: string;
  readonly severity: IntelligenceSeverity;
  readonly title: string;
  readonly explanation: string;
  readonly actionLabel?: string;
  readonly targetRoute?: string;
  readonly source?: string;
}

interface IntelligencePanelProps {
  readonly title?: string;
  readonly description?: string;
  readonly insights: readonly IntelligenceInsight[];
}

export function IntelligencePanel({
  title = 'Inteligencia LIHEN',
  description = 'Lectura asistida y segura del estado operativo. No ejecuta cambios automáticamente.',
  insights,
}: IntelligencePanelProps) {
  const headingId = useId();
  const emptyState = resolveIntelligencePanelEmptyState(insights.length);

  return (
    <section className="intelligence-panel" aria-labelledby={headingId}>
      <div className="intelligence-panel__heading">
        <div>
          <span className="intelligence-kicker">LIHEN Intelligence</span>
          <h2 id={headingId}>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="intelligence-mode">READ ONLY</span>
      </div>

      <div className="intelligence-list">
        {emptyState ? (
          <div
            className="intelligence-card intelligence-card--success"
            role={emptyState.role}
            aria-live={emptyState.ariaLive}
          >
            <div className="intelligence-card__signal" aria-hidden="true" />
            <div className="intelligence-card__content">
              <strong>{emptyState.title}</strong>
              <p>{emptyState.message}</p>
            </div>
          </div>
        ) : null}
        {insights.map((insight) => (
          <article key={insight.id} className={`intelligence-card intelligence-card--${insight.severity.toLowerCase()}`}>
            <div className="intelligence-card__signal" aria-hidden="true" />
            <div className="intelligence-card__content">
              <strong>{insight.title}</strong>
              <p>{insight.explanation}</p>
              {insight.source ? <small>Fuente: {insight.source}</small> : null}
            </div>
            {insight.targetRoute && insight.actionLabel ? (
              <Link className="text-link" to={insight.targetRoute}>{insight.actionLabel} →</Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

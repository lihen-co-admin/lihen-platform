import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { operationsComposition, type OperationalAuditRow, type OperationalIntegrityCheck } from '../composition/operations';

export function OperationsPage() {
  const [checks, setChecks] = useState<readonly OperationalIntegrityCheck[]>([]);
  const [audit, setAudit] = useState<readonly OperationalAuditRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([operationsComposition.getIntegrityChecks(), operationsComposition.getAudit()])
      .then(([nextChecks, nextAudit]) => {
        setChecks(nextChecks);
        setAudit(nextAudit);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'No fue posible cargar observabilidad.'));
  }, []);

  const failures = checks.reduce((sum, check) => sum + (check.status === 'PASS' ? 0 : check.issueCount), 0);

  return (
    <section className="stack">
      <PageHeader title="Integridad y auditoría" description="FASE 2.9A / 2.11 · controles transversales y bitácora append-only de operaciones administrativas." />
      <div className={failures === 0 ? 'info-state' : 'warning-state'}>
        <strong>{failures === 0 ? 'Integridad operacional: PASS' : `Integridad operacional: ${failures} incidencias`}</strong>
        <p>Esta pantalla observa; no corrige ni modifica datos automáticamente.</p>
      </div>
      {error ? <div className="error-state">{error}</div> : null}

      <div className="card stack">
        <h2>Controles de integridad</h2>
        <div className="table-wrap"><table><thead><tr><th>Control</th><th>Incidencias</th><th>Estado</th></tr></thead><tbody>
          {checks.map((check) => <tr key={check.checkCode}><td><strong>{check.checkCode}</strong></td><td>{check.issueCount}</td><td><span className={check.status === 'PASS' ? 'status-pass' : 'status-alert'}>{check.status}</span></td></tr>)}
        </tbody></table></div>
      </div>

      <div className="card stack">
        <h2>Bitácora operacional</h2>
        <p className="muted-text">Solo registra operaciones controladas persistidas. Los dry-runs con ROLLBACK no aparecen.</p>
        <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Módulo</th><th>Operación</th><th>Entidad</th><th>Actor</th></tr></thead><tbody>
          {audit.map((row) => <tr key={row.id}><td>{row.occurredAt.toLocaleString()}</td><td>{row.module}</td><td><strong>{row.operationType}</strong></td><td>{row.entityType}{row.entityId ? ` · ${row.entityId}` : ''}</td><td className="code-text">{row.actorId}</td></tr>)}
        </tbody></table></div>
        {audit.length === 0 ? <p>No hay operaciones controladas persistidas todavía. Esto es correcto antes de empezar operación canónica real.</p> : null}
      </div>
    </section>
  );
}

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import {
  operationsComposition,
  type ControlCenterOperationCatalogEntry,
  type ControlCenterOperationConfirmation,
  type ControlCenterOperationContract,
  type ControlCenterOperationExecutionReadiness,
  type ControlCenterOperationPayloadValidation,
  type Phase64PreExecutionReadiness,
  type ControlCenterOperationPreview,
  type ControlCenterOperationTimelineRow,
  type OperationalAuditRow,
  type OperationalIntegrityCheck,
} from '../composition/operations';
import {
  canConfirmPreview,
  catalogIsExecutionSafe,
  executionReadinessIsHeld,
  operationRiskClass,
  parseOperationPayload,
  validationMessage,
} from './operation-console-policy';

function makeOperationKey(operationCode: string): string {
  return `cc-${operationCode.toLowerCase()}-${Date.now()}`;
}

export function OperationsPage() {
  const [checks, setChecks] = useState<readonly OperationalIntegrityCheck[]>([]);
  const [audit, setAudit] = useState<readonly OperationalAuditRow[]>([]);
  const [catalog, setCatalog] = useState<readonly ControlCenterOperationCatalogEntry[]>([]);
  const [timeline, setTimeline] = useState<readonly ControlCenterOperationTimelineRow[]>([]);
  const [contracts, setContracts] = useState<readonly ControlCenterOperationContract[]>([]);
  const [executionReadiness, setExecutionReadiness] = useState<readonly ControlCenterOperationExecutionReadiness[]>([]);
  const [phase64, setPhase64] = useState<Phase64PreExecutionReadiness | null>(null);
  const [payloadValidation, setPayloadValidation] = useState<ControlCenterOperationPayloadValidation | null>(null);
  const [selectedOperationCode, setSelectedOperationCode] = useState('');
  const [operationKey, setOperationKey] = useState('');
  const [payloadText, setPayloadText] = useState('{}');
  const [preview, setPreview] = useState<ControlCenterOperationPreview | null>(null);
  const [confirmation, setConfirmation] = useState<ControlCenterOperationConfirmation | null>(null);
  const [domainFilter, setDomainFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function loadTimeline(domainCode: string | null = null) {
    const nextTimeline = await operationsComposition.getControlCenterAuditTimeline(50, 0, domainCode);
    setTimeline(nextTimeline);
  }

  useEffect(() => {
    Promise.all([
      operationsComposition.getIntegrityChecks(),
      operationsComposition.getAudit(),
      operationsComposition.getControlCenterOperationCatalog(),
      operationsComposition.getControlCenterAuditTimeline(),
      operationsComposition.getControlCenterOperationContracts(),
      operationsComposition.getControlCenterExecutionReadiness(),
      operationsComposition.getPhase64PreExecutionReadiness(),
    ])
      .then(([nextChecks, nextAudit, nextCatalog, nextTimeline, nextContracts, nextExecutionReadiness, nextPhase64]) => {
        setChecks(nextChecks);
        setAudit(nextAudit);
        setCatalog(nextCatalog);
        setTimeline(nextTimeline);
        setContracts(nextContracts);
        setExecutionReadiness(nextExecutionReadiness);
        setPhase64(nextPhase64);
        const first = nextCatalog[0];
        if (first) {
          setSelectedOperationCode(first.operationCode);
          setOperationKey(makeOperationKey(first.operationCode));
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'No fue posible cargar observabilidad.'))
      .finally(() => setLoading(false));
  }, []);

  const selectedOperation = useMemo(
    () => catalog.find((entry) => entry.operationCode === selectedOperationCode) ?? null,
    [catalog, selectedOperationCode],
  );

  const selectedContract = useMemo(
    () => contracts.find((entry) => entry.operationCode === selectedOperationCode) ?? null,
    [contracts, selectedOperationCode],
  );

  const domains = useMemo(
    () => Array.from(new Set(catalog.map((entry) => entry.domainCode))).sort(),
    [catalog],
  );

  const failures = checks.reduce((sum, check) => sum + (check.status === 'PASS' ? 0 : check.issueCount), 0);
  const executionSafe = catalogIsExecutionSafe(catalog);
  const releaseHeld = executionReadinessIsHeld(executionReadiness);

  function handleOperationChange(nextCode: string) {
    setSelectedOperationCode(nextCode);
    setOperationKey(makeOperationKey(nextCode));
    setPreview(null);
    setConfirmation(null);
    setPayloadValidation(null);
    setError('');
  }

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPreview(null);
    setConfirmation(null);
    try {
      const payload = parseOperationPayload(payloadText);
      setSubmitting(true);
      const validation = await operationsComposition.validateOperationPayload(selectedOperationCode, payload);
      setPayloadValidation(validation);
      if (!validation.valid) {
        throw new Error(validationMessage(validation));
      }
      const result = await operationsComposition.prepareOperation(operationKey.trim(), selectedOperationCode, payload);
      setPreview(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible preparar la operación.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!preview || !canConfirmPreview(preview)) return;
    setError('');
    try {
      setSubmitting(true);
      const result = await operationsComposition.confirmOperation(preview.intentId, preview.confirmationToken);
      setConfirmation(result);
      setPreview((current) => current ? { ...current, status: result.status } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible confirmar la intención.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDomainFilter(nextDomain: string) {
    setDomainFilter(nextDomain);
    setError('');
    try {
      await loadTimeline(nextDomain || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible filtrar el timeline.');
    }
  }

  return (
    <section className="stack operation-console">
      <PageHeader
        title="Integridad y operaciones controladas"
        description="FASE 6.1–6.4 · contratos validados, PREVIEW/CONFIRM, auditoría y release de ejecución explícitamente retenido."
      />

      <div className={failures === 0 && executionSafe && releaseHeld ? 'info-state' : 'warning-state'}>
        <strong>
          {failures === 0 && executionSafe && releaseHeld
            ? 'Control operacional: PASS · release de ejecución HELD'
            : 'Revisar integridad o política de ejecución'}
        </strong>
        <p>El payload se valida contra la firma real del RPC antes de PREVIEW. No existe liberación de ejecución en esta pantalla.</p>
      </div>
      {error ? <div className="error-state">{error}</div> : null}
      {loading ? <div className="card">Cargando contratos operacionales…</div> : null}

      <div className="metric-grid">
        <article className="metric-card metric-card--pass"><span>Operaciones catalogadas</span><strong>{catalog.length}</strong><small>6.1A</small></article>
        <article className={executionSafe ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Ejecución habilitada</span><strong>{catalog.filter((entry) => entry.executionEnabled).length}</strong><small>Debe permanecer en 0</small></article>
        <article className="metric-card metric-card--pass"><span>Dominios</span><strong>{domains.length}</strong><small>Catálogo controlado</small></article>
        <article className="metric-card metric-card--pass"><span>Timeline</span><strong>{timeline.length}</strong><small>Últimos registros visibles</small></article>
        <article className={releaseHeld ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Release</span><strong>{releaseHeld ? 'HELD' : 'REVISAR'}</strong><small>6.3 · presupuesto 0</small></article>
        <article className={phase64?.readinessStatus === 'PASS' ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Pre-execution</span><strong>{phase64?.readinessStatus ?? '—'}</strong><small>6.4 · {phase64?.passedGates ?? 0}/{phase64?.requiredGates ?? 0} gates</small></article>
      </div>

      <div className="card stack">
        <div className="operation-section-heading">
          <div><span className="card-label">FASE 6.1A</span><h2>Catálogo de operaciones</h2></div>
          <span className={executionSafe ? 'status-pass' : 'status-alert'}>{executionSafe ? 'NO EXECUTE' : 'REVISAR'}</span>
        </div>
        <p className="muted-text">Las operaciones se clasifican por dominio y riesgo. Ninguna está habilitada para ejecutar desde Control Center.</p>
        <div className="table-wrap"><table><thead><tr><th>Dominio</th><th>Operación</th><th>Riesgo</th><th>Acción</th><th>Confirmación</th><th>Ejecución</th></tr></thead><tbody>
          {catalog.map((entry) => <tr key={entry.operationCode}>
            <td>{entry.domainCode}</td>
            <td><strong>{entry.operationCode}</strong><div className="muted-text operation-description">{entry.description}</div></td>
            <td><span className={operationRiskClass(entry.riskLevel)}>{entry.riskLevel}</span></td>
            <td>{entry.actionKind}</td>
            <td>{entry.requiresConfirmation ? 'Requerida' : 'No'}</td>
            <td><span className={entry.executionEnabled ? 'status-alert' : 'status-pass'}>{entry.executionEnabled ? 'HABILITADA' : 'DESHABILITADA'}</span></td>
          </tr>)}
        </tbody></table></div>
      </div>

      <div className="card stack">
        <div className="operation-section-heading">
          <div><span className="card-label">FASE 6.2</span><h2>Contrato del payload</h2></div>
          <span className={selectedContract?.operationKeyFirst ? 'status-pass' : 'status-alert'}>{selectedContract?.operationKeyFirst ? 'RPC CONTRACT OK' : 'REVISAR'}</span>
        </div>
        <p className="muted-text">Los campos esperados se derivan de la firma real del RPC controlado. <code>p_operation_key</code> se gestiona fuera del payload.</p>
        {selectedContract ? <>
          <div className="operation-contract-meta">
            <div><span>RPC</span><strong className="code-text">{selectedContract.functionName}</strong></div>
            <div><span>Resultado</span><strong className="code-text">{selectedContract.resultSignature}</strong></div>
          </div>
          <div className="operation-argument-list">
            {selectedContract.payloadArguments.map((argument) => <span key={argument.name} className={argument.required ? 'operation-argument operation-argument--required' : 'operation-argument'}>{argument.name}{argument.required ? ' *' : ''}</span>)}
          </div>
        </> : <p>No hay contrato seleccionado.</p>}
        {payloadValidation ? <div className={payloadValidation.valid ? 'success-state' : 'warning-state'}><strong>{payloadValidation.valid ? 'Payload válido para PREVIEW' : 'Payload bloqueado'}</strong><p>{validationMessage(payloadValidation)}</p></div> : null}
      </div>

      <div className="operation-grid">
        <form className="card stack" onSubmit={handlePreview}>
          <div><span className="card-label">FASE 6.1B + 6.2</span><h2>Preparar operación</h2></div>
          <p className="muted-text">PREVIEW crea una intención privada. CONFIRM confirma esa intención, pero todavía no ejecuta el RPC de negocio.</p>
          <label className="operation-field">Operación
            <select value={selectedOperationCode} onChange={(event) => handleOperationChange(event.target.value)} disabled={submitting}>
              {catalog.map((entry) => <option value={entry.operationCode} key={entry.operationCode}>{entry.domainCode} · {entry.operationCode} · {entry.riskLevel}</option>)}
            </select>
          </label>
          <label className="operation-field">Operation key
            <input value={operationKey} onChange={(event) => setOperationKey(event.target.value)} required disabled={submitting} />
          </label>
          <label className="operation-field">Payload JSON
            <textarea rows={8} value={payloadText} onChange={(event) => setPayloadText(event.target.value)} spellCheck={false} disabled={submitting} />
          </label>
          {selectedOperation ? <div className="operation-policy-note"><strong>{selectedOperation.riskLevel} · {selectedOperation.actionKind}</strong><span>{selectedOperation.description}</span></div> : null}
          <button type="submit" disabled={submitting || !selectedOperationCode || !operationKey.trim()}>{submitting ? 'Procesando…' : 'Generar PREVIEW'}</button>
        </form>

        <div className="card stack">
          <div><span className="card-label">Confirmación segura</span><h2>Intención preparada</h2></div>
          {!preview ? <p>No hay una intención preparada todavía.</p> : <>
            <dl className="operation-preview-list">
              <div><dt>Intent</dt><dd className="code-text">{preview.intentId}</dd></div>
              <div><dt>Operación</dt><dd>{preview.operationCode}</dd></div>
              <div><dt>Estado</dt><dd><span className="status-pass">{preview.status}</span></dd></div>
              <div><dt>Expira</dt><dd>{preview.expiresAt.toLocaleString()}</dd></div>
              <div><dt>Ejecución</dt><dd><span className={preview.executionEnabled ? 'status-alert' : 'status-pass'}>{preview.executionEnabled ? 'HABILITADA' : 'DESHABILITADA'}</span></dd></div>
            </dl>
            <pre className="operation-json-preview">{JSON.stringify(preview.previewSnapshot, null, 2)}</pre>
            <button type="button" onClick={() => void handleConfirm()} disabled={submitting || !canConfirmPreview(preview)}>Confirmar intención</button>
          </>}
          {confirmation ? <div className="success-state"><strong>{confirmation.status}</strong><div>{confirmation.executionNote}</div><small>Ejecución real: {confirmation.executionEnabled ? 'habilitada' : 'deshabilitada'}</small></div> : null}
          <div className="warning-state"><strong>No existe botón EXECUTE</strong><p>La ejecución real permanece fuera de este gate y deberá habilitarse mediante un corte separado.</p></div>
        </div>
      </div>

      <div className="card stack">
        <div className="operation-section-heading">
          <div><span className="card-label">FASE 6.3 + 6.4</span><h2>Guard de liberación</h2></div>
          <span className={releaseHeld && phase64?.readinessStatus === 'PASS' ? 'status-pass' : 'status-alert'}>{phase64?.executionReleaseStatus ?? 'HELD'}</span>
        </div>
        <p className="muted-text">Las operaciones pueden estar estructuralmente listas sin estar liberadas. El presupuesto de ejecución permanece en cero.</p>
        <div className="table-wrap"><table><thead><tr><th>Operación</th><th>Riesgo</th><th>Release</th><th>Entorno</th><th>Intentos/h</th><th>Readiness</th></tr></thead><tbody>
          {executionReadiness.map((row) => <tr key={row.operationCode}><td><strong>{row.operationCode}</strong></td><td>{row.riskLevel}</td><td>{row.releaseStatus}</td><td>{row.allowedEnvironment}</td><td>{row.maxExecutionAttemptsPerHour}</td><td><span className={row.readinessStatus === 'READY_BUT_HELD' ? 'status-pass' : 'status-alert'}>{row.readinessStatus}</span></td></tr>)}
        </tbody></table></div>
      </div>

      <div className="card stack">
        <div className="operation-section-heading">
          <div><span className="card-label">FASE 6.1C</span><h2>Timeline operacional</h2></div>
          <label className="operation-inline-filter">Dominio
            <select value={domainFilter} onChange={(event) => void handleDomainFilter(event.target.value)}>
              <option value="">Todos</option>
              {domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
            </select>
          </label>
        </div>
        <p className="muted-text">Lectura OWNER/ADMIN normalizada desde logs privados existentes. Máximo 50 registros en esta vista.</p>
        <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Dominio</th><th>Operación</th><th>Operation key</th><th>Entidad</th><th>Actor</th></tr></thead><tbody>
          {timeline.map((row) => <tr key={`${row.domainCode}-${row.operationKey}-${row.occurredAt.toISOString()}`}>
            <td>{row.occurredAt.toLocaleString()}</td><td>{row.domainCode}</td><td><strong>{row.operationType}</strong></td><td className="code-text">{row.operationKey}</td><td className="code-text">{row.entityId ?? '—'}</td><td className="code-text">{row.actorId}</td>
          </tr>)}
        </tbody></table></div>
        {timeline.length === 0 ? <p>No hay registros para el filtro seleccionado.</p> : null}
      </div>

      <details className="card stack operation-legacy-audit">
        <summary>Observabilidad histórica FASE 2</summary>
        <div className="table-wrap"><table><thead><tr><th>Control</th><th>Incidencias</th><th>Estado</th></tr></thead><tbody>
          {checks.map((check) => <tr key={check.checkCode}><td><strong>{check.checkCode}</strong></td><td>{check.issueCount}</td><td><span className={check.status === 'PASS' ? 'status-pass' : 'status-alert'}>{check.status}</span></td></tr>)}
        </tbody></table></div>
        <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Módulo</th><th>Operación</th><th>Entidad</th><th>Actor</th></tr></thead><tbody>
          {audit.map((row) => <tr key={row.id}><td>{row.occurredAt.toLocaleString()}</td><td>{row.module}</td><td><strong>{row.operationType}</strong></td><td>{row.entityType}{row.entityId ? ` · ${row.entityId}` : ''}</td><td className="code-text">{row.actorId}</td></tr>)}
        </tbody></table></div>
      </details>
    </section>
  );
}

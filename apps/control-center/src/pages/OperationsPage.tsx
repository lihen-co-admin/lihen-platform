import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import {
  operationsComposition,
  type ControlCenterOperationCatalogEntry,
  type ControlCenterOperationCanaryExecutionGuard,
  type ControlCenterOperationCanarySimulation,
  type ControlCenterOperationConfirmation,
  type ControlCenterOperationContract,
  type ControlCenterOperationDispatchContract,
  type ControlCenterOperationExecutionReadiness,
  type ControlCenterOperationPayloadValidation,
  type ControlCenterOperationReleaseAuthorizationGuard,
  type ControlCenterGovernanceAuditEvent,
  type Phase64PreExecutionReadiness,
  type Phase66ControlPlaneClosureReadiness,
  type Phase7ControlledExecutionEntryReadiness,
  type Phase75CanaryControlPlaneClosureReadiness,
  type Phase8ControlledReleaseEntryReadiness,
  type Phase84ReleaseControlPlaneClosureReadiness,
  type Phase87ReleaseGovernanceHardeningClosureReadiness,
  type ControlCenterOperationPreview,
  type ControlCenterOperationTimelineRow,
  type OperationalAuditRow,
  type OperationalIntegrityCheck,
} from '../composition/operations';
import { evaluateGovernanceReadiness } from '../domain/governance-readiness';
import { evaluateGovernanceAssurance, evaluateGovernanceEvidence } from '../domain/governance-evidence';
import { evaluateGovernanceOperationPolicy } from '../domain/governance-operation-policy';
import {
  canConfirmPreview,
  canaryExecutionGuardBlocksAll,
  canRequestCanaryRelease,
  canarySimulationIsSafe,
  catalogIsExecutionSafe,
  dispatchContractsAreHeld,
  executionReadinessIsHeld,
  operationRiskClass,
  parseOperationPayload,
  releaseAuthorizationGuardBlocksAll,
  releaseGovernanceHardeningIsSafe,
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
  const [dispatchContracts, setDispatchContracts] = useState<readonly ControlCenterOperationDispatchContract[]>([]);
  const [phase66, setPhase66] = useState<Phase66ControlPlaneClosureReadiness | null>(null);
  const [phase7Entry, setPhase7Entry] = useState<Phase7ControlledExecutionEntryReadiness | null>(null);
  const [canarySimulation, setCanarySimulation] = useState<readonly ControlCenterOperationCanarySimulation[]>([]);
  const [canaryGuard, setCanaryGuard] = useState<readonly ControlCenterOperationCanaryExecutionGuard[]>([]);
  const [phase75, setPhase75] = useState<Phase75CanaryControlPlaneClosureReadiness | null>(null);
  const [phase8Entry, setPhase8Entry] = useState<Phase8ControlledReleaseEntryReadiness | null>(null);
  const [releaseGuard, setReleaseGuard] = useState<readonly ControlCenterOperationReleaseAuthorizationGuard[]>([]);
  const [phase84, setPhase84] = useState<Phase84ReleaseControlPlaneClosureReadiness | null>(null);
  const [governanceAudit, setGovernanceAudit] = useState<readonly ControlCenterGovernanceAuditEvent[]>([]);
  const [phase87, setPhase87] = useState<Phase87ReleaseGovernanceHardeningClosureReadiness | null>(null);
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
      operationsComposition.getControlCenterDispatchContracts(),
      operationsComposition.getPhase66ControlPlaneClosureReadiness(),
      operationsComposition.getPhase7ControlledExecutionEntryReadiness(),
      operationsComposition.getControlCenterCanarySimulation(),
      operationsComposition.getControlCenterCanaryExecutionGuard(),
      operationsComposition.getPhase75CanaryControlPlaneClosureReadiness(),
      operationsComposition.getPhase8ControlledReleaseEntryReadiness(),
      operationsComposition.getControlCenterReleaseAuthorizationGuard(),
      operationsComposition.getPhase84ReleaseControlPlaneClosureReadiness(),
      operationsComposition.getGovernanceAuditTimeline(50),
      operationsComposition.getPhase87ReleaseGovernanceHardeningClosureReadiness(),
    ])
      .then(([nextChecks, nextAudit, nextCatalog, nextTimeline, nextContracts, nextExecutionReadiness, nextPhase64, nextDispatchContracts, nextPhase66, nextPhase7Entry, nextCanarySimulation, nextCanaryGuard, nextPhase75, nextPhase8Entry, nextReleaseGuard, nextPhase84, nextGovernanceAudit, nextPhase87]) => {
        setChecks(nextChecks);
        setAudit(nextAudit);
        setCatalog(nextCatalog);
        setTimeline(nextTimeline);
        setContracts(nextContracts);
        setExecutionReadiness(nextExecutionReadiness);
        setPhase64(nextPhase64);
        setDispatchContracts(nextDispatchContracts);
        setPhase66(nextPhase66);
        setPhase7Entry(nextPhase7Entry);
        setCanarySimulation(nextCanarySimulation);
        setCanaryGuard(nextCanaryGuard);
        setPhase75(nextPhase75);
        setPhase8Entry(nextPhase8Entry);
        setReleaseGuard(nextReleaseGuard);
        setPhase84(nextPhase84);
        setGovernanceAudit(nextGovernanceAudit);
        setPhase87(nextPhase87);
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
  const dispatchHeld = dispatchContractsAreHeld(dispatchContracts);
  const canarySafe = canarySimulationIsSafe(canarySimulation);
  const canaryGuardSafe = canaryExecutionGuardBlocksAll(canaryGuard);
  const releaseGuardSafe = releaseAuthorizationGuardBlocksAll(releaseGuard);
  const governanceHardeningSafe = releaseGovernanceHardeningIsSafe(phase87);
  const governanceReadiness = evaluateGovernanceReadiness({
    integrityIssueCount: failures,
    operationCount: catalog.length,
    executionEnabledCount: catalog.filter((entry) => entry.executionEnabled).length,
    executionReleaseHeld: releaseHeld,
    dispatchHeld,
    canarySimulationSafe: canarySafe,
    canaryGuardBlocksAll: canaryGuardSafe,
    releaseGuardBlocksAll: releaseGuardSafe,
    phase64Status: phase64?.readinessStatus ?? null,
    phase66Status: phase66?.readinessStatus ?? null,
    phase75Status: phase75?.readinessStatus ?? null,
    phase84Status: phase84?.readinessStatus ?? null,
    phase87Status: phase87?.readinessStatus ?? null,
  });
  const governanceEvidence = evaluateGovernanceEvidence({
    governanceAudit: governanceAudit.map((event) => ({
      id: event.eventId,
      operationCode: event.operationCode,
      actorId: event.actorId,
      status: event.eventStatus,
      correlationKey: event.correlationKey,
      occurredAt: event.occurredAt,
    })),
    operationTimeline: timeline.map((event) => ({
      domainCode: event.domainCode,
      operationType: event.operationType,
      operationKey: event.operationKey,
      actorId: event.actorId,
      occurredAt: event.occurredAt,
    })),
    now: new Date(),
  });
  const governanceAssurance = evaluateGovernanceAssurance(governanceReadiness.status, governanceEvidence.status);
  const selectedCanaryGuard = canaryGuard.find((entry) => entry.operationCode === selectedOperationCode) ?? null;
  const releaseRequestEligible = canRequestCanaryRelease(selectedCanaryGuard);
  const governanceOperationPolicy = evaluateGovernanceOperationPolicy({
    assuranceStatus: governanceAssurance.status,
    releaseRequestEligible,
  });

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
    if (!governanceOperationPolicy.prepareAllowed) {
      setError('Governance assurance está BLOCKED. No se permite preparar nuevas intenciones hasta resolver las señales críticas.');
      return;
    }
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
    if (!governanceOperationPolicy.confirmAllowed) {
      setError('La confirmación requiere Governance assurance READY. REVIEW/BLOCKED permanece en modo de investigación.');
      return;
    }
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

  const controlPlaneHealthy = governanceAssurance.status === 'READY' && executionSafe && governanceHardeningSafe;

  const intelligenceInsights: readonly IntelligenceInsight[] = [
    controlPlaneHealthy
      ? {
          id: 'operations-control-plane-pass',
          severity: 'SUCCESS',
          title: 'Gobernanza operativa íntegra',
          explanation: 'Payload, dispatch, canary y release governance permanecen bajo control y la ejecución final continúa bloqueada.',
          source: 'Integrity checks + release governance',
        }
      : {
          id: 'operations-control-plane-review',
          severity: 'WARNING',
          title: 'Revisión de integridad requerida',
          explanation: 'Existe al menos una señal de integridad, dispatch, canary o release governance que requiere revisión antes de cualquier readiness posterior.',
          source: 'Integrity checks + release governance',
        },
    {
      id: 'operations-execution-held',
      severity: 'INFO',
      title: 'Ejecución final protegida',
      explanation: `${catalog.filter((entry) => entry.executionEnabled).length} operaciones tienen ejecución habilitada. El valor esperado en esta etapa es 0.`,
      source: 'Operation catalog',
    },
    phase87?.readinessStatus === 'PASS'
      ? {
          id: 'operations-phase87-pass',
          severity: 'SUCCESS',
          title: 'Hardening 8.7 en PASS',
          explanation: `${phase87.passedGates}/${phase87.requiredGates} gates superados. Este estado endurece trazabilidad y autorización, pero no crea una vía de ejecución.`,
          source: 'Phase 8.7 readiness',
        }
      : {
          id: 'operations-phase87-review',
          severity: 'WARNING',
          title: 'Hardening 8.7 requiere revisión',
          explanation: 'El cierre de governance no está reportando PASS en la lectura actual.',
          source: 'Phase 8.7 readiness',
        },
  ];

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
      <AdminPageHero
        eyebrow="CONTROL Y GOBERNANZA"
        title="Integridad y auditoría"
        description="Supervisa contratos, trazabilidad, canary y release governance sin abrir una vía de ejecución desde el Control Center."
        accent="lilac"
        status={<span className={controlPlaneHealthy ? 'status-pass' : 'status-alert'}>{controlPlaneHealthy ? 'CONTROL PLANE PASS' : 'REVISAR'}</span>}
      />

      <SummaryStrip items={[
        { label: 'Operaciones', value: catalog.length, detail: 'Catálogo controlado' },
        { label: 'Ejecución habilitada', value: catalog.filter((entry) => entry.executionEnabled).length, detail: 'Debe permanecer en 0' },
        { label: 'Dominios', value: domains.length },
        { label: 'Governance assurance', value: governanceAssurance.status, detail: `readiness ${governanceReadiness.status} · evidencia ${governanceEvidence.status}` },
        { label: 'Hardening 8.7', value: phase87?.readinessStatus ?? '—' },
        { label: 'Policy', value: governanceOperationPolicy.confirmAllowed ? 'CONTROL READY' : 'HOLD', detail: 'EXECUTE siempre bloqueado' },
      ]} />

      <OperationalNotice
        title={controlPlaneHealthy ? 'Control operacional protegido' : 'Revisar integridad o política de ejecución'}
        tone={controlPlaneHealthy ? 'success' : 'warning'}
        meta="Execution final permanece bloqueada"
      >
        Assurance {governanceAssurance.status}. Readiness {governanceReadiness.status} + evidencia {governanceEvidence.status}; la autorización final de ejecución sigue fuera de alcance.
      </OperationalNotice>

      <IntelligencePanel insights={intelligenceInsights} description="Interpreta señales de integridad y readiness sin confirmar, liberar ni ejecutar operaciones." />
      {error ? <div className="error-state">{error}</div> : null}
      {loading ? <div className="card">Cargando contratos operacionales…</div> : null}

      <div className="metric-grid">
        <article className="metric-card metric-card--pass"><span>Operaciones catalogadas</span><strong>{catalog.length}</strong><small>6.1A</small></article>
        <article className={executionSafe ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Ejecución habilitada</span><strong>{catalog.filter((entry) => entry.executionEnabled).length}</strong><small>Debe permanecer en 0</small></article>
        <article className="metric-card metric-card--pass"><span>Dominios</span><strong>{domains.length}</strong><small>Catálogo controlado</small></article>
        <article className="metric-card metric-card--pass"><span>Timeline</span><strong>{timeline.length}</strong><small>Últimos registros visibles</small></article>
        <article className={releaseHeld ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Release</span><strong>{releaseHeld ? 'HELD' : 'REVISAR'}</strong><small>6.3 · presupuesto 0</small></article>
        <article className={phase64?.readinessStatus === 'PASS' ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Pre-execution</span><strong>{phase64?.readinessStatus ?? '—'}</strong><small>6.4 · {phase64?.passedGates ?? 0}/{phase64?.requiredGates ?? 0} gates</small></article>
        <article className={phase66?.readinessStatus === 'PASS' && dispatchHeld ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Cierre FASE 6</span><strong>{phase66?.readinessStatus ?? '—'}</strong><small>{phase66?.passedGates ?? 0}/{phase66?.requiredGates ?? 0} gates · dispatch HELD</small></article>
        <article className={phase7Entry?.readinessStatus === 'PASS' && canarySafe ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Canary candidatos</span><strong>{phase7Entry?.canaryCandidateOperations ?? 0}</strong><small>7.0–7.2 · ejecución 0</small></article>
        <article className={phase75?.readinessStatus === 'PASS' && canaryGuardSafe ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Cierre FASE 7</span><strong>{phase75?.readinessStatus ?? '—'}</strong><small>{phase75?.passedGates ?? 0}/{phase75?.requiredGates ?? 0} gates · ejecución bloqueada</small></article>
        <article className={phase8Entry?.readinessStatus === 'PASS' && releaseGuardSafe ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Release requests</span><strong>{phase84?.requests ?? 0}</strong><small>FASE 8 · autorizados {phase84?.approvedRequests ?? 0}</small></article>
        <article className={phase84?.readinessStatus === 'PASS' && releaseGuardSafe ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Cierre FASE 8</span><strong>{phase84?.readinessStatus ?? '—'}</strong><small>final execution no implementado</small></article>
        <article className={governanceReadiness.status === 'READY' ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Governance readiness</span><strong>{governanceReadiness.status}</strong><small>{governanceReadiness.passingSignals}/{governanceReadiness.checkedSignals} señales · execution BLOCKED</small></article>
        <article className={governanceEvidence.status === 'READY' ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Evidencia y frescura</span><strong>{governanceEvidence.status}</strong><small>audit {governanceEvidence.governanceAuditCount} · timeline {governanceEvidence.operationTimelineCount} · {governanceEvidence.freshnessWindowHours === null ? 'ventana no configurada' : `ventana ${governanceEvidence.freshnessWindowHours}h`}</small></article>
        <article className={governanceAssurance.status === 'READY' ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Governance assurance</span><strong>{governanceAssurance.status}</strong><small>readiness {governanceAssurance.readinessStatus} · evidencia {governanceAssurance.evidenceStatus}</small></article>
        <article className={governanceHardeningSafe ? 'metric-card metric-card--pass' : 'metric-card metric-card--alert'}><span>Hardening 8.7</span><strong>{phase87?.readinessStatus ?? '—'}</strong><small>{phase87?.passedGates ?? 0}/{phase87?.requiredGates ?? 0} gates · stale previews {phase87?.stalePreviewed ?? 0}</small></article>
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
          <div><span className="card-label">FASE 6.5 + 6.6</span><h2>Dispatch y cierre del control plane</h2></div>
          <span className={phase66?.readinessStatus === 'PASS' && dispatchHeld ? 'status-pass' : 'status-alert'}>{phase66?.closureMode ?? 'REVISAR'}</span>
        </div>
        <p className="muted-text">Los contratos de dispatch están compilados desde los RPC reales, pero dispatch permanece deshabilitado para las 14 operaciones.</p>
        <div className="table-wrap"><table><thead><tr><th>Operación</th><th>Riesgo</th><th>Release</th><th>Dispatch</th><th>Intentos/h</th></tr></thead><tbody>
          {dispatchContracts.map((row) => <tr key={row.operationCode}><td><strong>{row.operationCode}</strong></td><td>{row.riskLevel}</td><td>{row.releaseStatus}</td><td><span className={row.dispatchAllowed ? 'status-alert' : 'status-pass'}>{row.dispatchStatus}</span></td><td>{row.maxExecutionAttemptsPerHour}</td></tr>)}
        </tbody></table></div>
      </div>

      <div className="card stack">
        <div className="operation-section-heading">
          <div><span className="card-label">FASE 7.0–7.2</span><h2>Canary simulation</h2></div>
          <span className={canarySafe ? 'status-pass' : 'status-alert'}>{canarySafe ? 'SIMULATION ONLY' : 'REVISAR'}</span>
        </div>
        <p className="muted-text">Solo las operaciones MEDIUM son candidatas. Ninguna tiene canary habilitado, presupuesto de intentos ni dispatch real.</p>
        <div className="table-wrap"><table><thead><tr><th>Operación</th><th>Riesgo</th><th>Candidata</th><th>Entorno</th><th>Intentos/h</th><th>Simulación</th></tr></thead><tbody>
          {canarySimulation.map((row) => <tr key={row.operationCode}><td><strong>{row.operationCode}</strong></td><td>{row.riskLevel}</td><td>{row.canaryEligible ? 'Sí' : 'No'}</td><td>{row.allowedEnvironment}</td><td>{row.maxCanaryAttemptsPerHour}</td><td><span className={row.simulationStatus === 'SIMULATION_READY_BUT_DISABLED' || row.simulationStatus === 'NOT_ELIGIBLE_BY_RISK' ? 'status-pass' : 'status-alert'}>{row.simulationStatus}</span></td></tr>)}
        </tbody></table></div>
        <div className="warning-state"><strong>Ejecución real continúa bloqueada</strong><p>FASE 7 prepara un canary futuro, pero este CUT no habilita canary, dispatch ni RPC de ejecución.</p></div>
      </div>

      <div className="card stack">
        <div className="operation-section-heading">
          <div><span className="card-label">FASE 7.3–7.5</span><h2>Canary approval guard</h2></div>
          <span className={phase75?.readinessStatus === 'PASS' && canaryGuardSafe ? 'status-pass' : 'status-alert'}>{phase75?.closureMode ?? 'REVISAR'}</span>
        </div>
        <p className="muted-text">Las cuatro operaciones MEDIUM requieren aprobación manual. Las HIGH/CRITICAL permanecen excluidas por riesgo.</p>
        <div className="table-wrap"><table><thead><tr><th>Operación</th><th>Riesgo</th><th>Aprobación</th><th>Scope</th><th>Ejecución</th><th>Guard</th></tr></thead><tbody>
          {canaryGuard.map((row) => <tr key={row.operationCode}><td><strong>{row.operationCode}</strong></td><td>{row.riskLevel}</td><td>{row.approvalState}</td><td>{row.releaseScope}</td><td><span className={row.executionAllowed ? 'status-alert' : 'status-pass'}>{row.executionAllowed ? 'ALLOWED' : 'BLOCKED'}</span></td><td>{row.guardStatus}</td></tr>)}
        </tbody></table></div>
      </div>

      <div className="card stack">
        <div className="operation-section-heading">
          <div><span className="card-label">FASE 8.0–8.4</span><h2>Release governance</h2></div>
          <span className={phase84?.readinessStatus === 'PASS' && releaseGuardSafe ? 'status-pass' : 'status-alert'}>{phase84?.closureMode ?? 'REVISAR'}</span>
        </div>
        <p className="muted-text">Existe ledger privado y workflow de solicitud/decisión, pero este CUT no implementa la liberación final de ejecución.</p>
        <div className="operation-policy-note"><strong>Solicitud disponible solo como governance DEV</strong><span>{governanceOperationPolicy.releaseRequestAllowed ? 'Assurance READY y operación elegible para una futura solicitud de revisión manual.' : 'La política de governance no habilita solicitud de release en el estado actual.'}</span></div>
        <div className="table-wrap"><table><thead><tr><th>Operación</th><th>Riesgo</th><th>Approval</th><th>Request</th><th>Release autorizado</th><th>Guard</th></tr></thead><tbody>
          {releaseGuard.map((row) => <tr key={row.operationCode}><td><strong>{row.operationCode}</strong></td><td>{row.riskLevel}</td><td>{row.approvalState}</td><td>{row.requestStatus ?? '—'}</td><td><span className={row.releaseAuthorized ? 'status-alert' : 'status-pass'}>{row.releaseAuthorized ? 'YES' : 'NO'}</span></td><td>{row.guardStatus}</td></tr>)}
        </tbody></table></div>
        <div className="warning-state"><strong>Final execution release no implementado</strong><p>Incluso un request aprobado seguiría bloqueado por el guard final hasta un corte posterior, separado y explícito.</p></div>
      </div>

      <div className="card stack">
        <div className="operation-section-heading">
          <div><span className="card-label">FASE 8.5–8.7</span><h2>Governance audit</h2></div>
          <span className={governanceHardeningSafe ? 'status-pass' : 'status-alert'}>{phase87?.closureMode ?? 'REVISAR'}</span>
        </div>
        <p className="muted-text">Operation keys quedan ligados al actor, los intents expirados persisten como EXPIRED y el timeline no expone request payloads.</p>
        {governanceAudit.length === 0 ? <div className="empty-state"><strong>Sin eventos de governance</strong><p>No existen previews, confirmaciones ni solicitudes de release registradas en DEV.</p></div> : (
          <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Fuente</th><th>Operación</th><th>Estado</th><th>Actor</th></tr></thead><tbody>
            {governanceAudit.map((row) => <tr key={`${row.eventSource}-${row.eventId}`}><td>{row.occurredAt.toLocaleString()}</td><td>{row.eventSource}</td><td>{row.operationCode}</td><td>{row.eventStatus}</td><td>{row.actorId}</td></tr>)}
          </tbody></table></div>
        )}
        <div className="warning-state"><strong>Ejecución final sigue sin implementar</strong><p>8.7 endurece seguridad y trazabilidad; no crea una vía de ejecución.</p></div>
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

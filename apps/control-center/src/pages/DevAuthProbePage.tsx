import { useEffect, useState } from 'react';

import { createGetProductsQuery } from '@lihen/products';

import { useAuth } from '../auth/auth-context';
import { AdminPageHero } from '../components/AdminPageHero';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import {
  phase3CutoverComposition,
  type Phase3Status,
  type VerificationCheck,
} from '../composition/phase3-cutover';
import { productsComposition } from '../composition/products';

type ProbeStatus = 'IDLE' | 'RUNNING' | 'PASS' | 'FAIL';
type ActionStatus = 'IDLE' | 'RUNNING' | 'DONE' | 'FAIL';
interface ProbeResult {
  readonly status: ProbeStatus;
  readonly tokenFingerprint?: string;
  readonly userId?: string;
  readonly email?: string;
  readonly roleCode?: string;
  readonly authorizationStatus?: string;
  readonly productCount?: number;
  readonly message?: string;
}

const PHASE3_RUN_ID = '201d9f46-383f-4ac0-8f78-76e35c65aafd';

async function fingerprint(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export function DevAuthProbePage() {
  const auth = useAuth();

  const [result, setResult] = useState<ProbeResult>({ status: 'IDLE' });
  const [phase3Status, setPhase3Status] = useState<Phase3Status | null>(null);
  const [phaseStatusMessage, setPhaseStatusMessage] = useState<string>('');
  const [verifyStatus, setVerifyStatus] = useState<ActionStatus>('IDLE');
  const [verifyMessage, setVerifyMessage] = useState<string>('');
  const [verificationChecks, setVerificationChecks] = useState<readonly VerificationCheck[]>([]);

  function assertVerificationSession() {
    if (!auth.session?.access_token || !auth.user) {
      throw new Error('No existe una sesión Supabase autenticada.');
    }

    if (!auth.profile || !auth.authorized) {
      throw new Error('La sesión no tiene un perfil administrativo ACTIVE.');
    }

    if (!['OWNER', 'ADMIN'].includes(auth.profile.roleCode)) {
      throw new Error('FASE 3.11 requiere una sesión OWNER o ADMIN ACTIVE.');
    }
  }

  async function loadPhase3Status() {
    if (!auth.authorized) return;

    try {
      setPhase3Status(await phase3CutoverComposition.loadStatus(PHASE3_RUN_ID));
      setPhaseStatusMessage('');
    } catch (error) {
      setPhaseStatusMessage(
        error instanceof Error
          ? `No se pudo leer el gate FASE 3 → FASE 4: ${error.message}`
          : 'No se pudo leer el gate FASE 3 → FASE 4.',
      );
    }
  }

  useEffect(() => {
    void loadPhase3Status();
    // La carga depende del estado administrativo resuelto por AuthProvider.
  }, [auth.authorized]);

  async function runProbe() {
    setResult({ status: 'RUNNING' });

    try {
      if (!auth.session?.access_token || !auth.user) {
        throw new Error('No existe una sesión Supabase autenticada.');
      }

      if (!auth.profile || !auth.authorized) {
        throw new Error(
          'El JWT existe, pero el perfil administrativo no está ACTIVE o su rol no es reconocido.',
        );
      }

      if (productsComposition.source !== 'supabase') {
        throw new Error('El ProductRepository no está configurado para Supabase DEV.');
      }

      const tokenFingerprint = await fingerprint(auth.session.access_token);
      const products = await productsComposition.getProducts.execute(createGetProductsQuery());

      setResult({
        status: 'PASS',
        tokenFingerprint,
        userId: auth.user.id,
        ...(auth.user.email ? { email: auth.user.email } : {}),
        roleCode: auth.profile.roleCode,
        authorizationStatus: auth.profile.authorizationStatus,
        productCount: products.length,
        message:
          'JWT presente, perfil ACTIVE, rol reconocido y GetProducts autorizado por RLS en Supabase DEV.',
      });
    } catch (error) {
      setResult({
        status: 'FAIL',
        message: error instanceof Error ? error.message : 'Falló el probe de Auth/RLS.',
      });
    }
  }

  async function verifyPhase311() {
    if (verifyStatus === 'RUNNING' || verifyStatus === 'DONE') return;

    setVerifyStatus('RUNNING');
    setVerifyMessage('Ejecutando verificación post-cutover de FASE 3.11...');
    setVerificationChecks([]);

    try {
      assertVerificationSession();

      if (phase3Status?.runStatus !== 'APPLIED' || phase3Status.batchStatus !== 'APPLIED') {
        throw new Error('FASE 3.10 todavía no está APPLIED en run y batch.');
      }

      const checks = await phase3CutoverComposition.verify(PHASE3_RUN_ID);
      const failedChecks = checks.filter((check) => check.status === 'FAIL');

      setVerificationChecks(checks);

      if (checks.length === 0) {
        throw new Error('La verificación no devolvió post-checks.');
      }

      if (failedChecks.length > 0) {
        throw new Error(`FASE 3.11 encontró ${failedChecks.length} check(s) FAILED.`);
      }

      setVerifyStatus('DONE');
      setVerifyMessage(`FASE 3.11 PASS: ${checks.length} checks sin fallos.`);
      await loadPhase3Status();
    } catch (error) {
      setVerifyStatus('FAIL');
      setVerifyMessage(
        error instanceof Error ? `VERIFY FAIL: ${error.message}` : 'VERIFY FAIL',
      );
      await loadPhase3Status();
    }
  }

  const phase310Applied =
    phase3Status?.runStatus === 'APPLIED' && phase3Status.batchStatus === 'APPLIED';
  const phase311Passed = phase3Status?.verificationStatus === 'PASS';

  return (
    <section className="stack dev-probe-page">
      <AdminPageHero
        eyebrow="Desarrollo · diagnóstico seguro"
        title="Auth + Admin Profile + RLS Probe"
        description="Herramienta exclusiva de DEV para comprobar sesión Supabase, perfil administrativo, rol autorizado y lectura de Product Master mediante RLS. El token nunca se muestra."
        accent="lilac"
        status={<span className="status-badge status-badge--warning">DEV ONLY</span>}
      />

      <OperationalNotice title="Herramienta técnica, no flujo de negocio" tone="info" meta="Visible solo en entorno DEV">
        <p>Este módulo valida conectividad y autorización. No sustituye las pantallas operativas ni habilita ejecución sensible.</p>
      </OperationalNotice>

      <SummaryStrip items={[
        { label: 'Auth', value: auth.enabled ? 'Supabase' : 'OFF', detail: auth.user?.email ?? 'sin sesión' },
        { label: 'Products', value: productsComposition.source, detail: 'fuente configurada' },
        { label: 'Perfil', value: auth.profile?.authorizationStatus ?? '—', detail: auth.profile?.roleCode ?? 'sin rol' },
        { label: 'Probe', value: result.status, detail: result.status === 'PASS' ? `${result.productCount ?? 0} productos leídos` : 'validación manual' },
      ]} />

      <div className="card-grid dev-probe-grid">
        <article className="card stack admin-form-card">
          <div className="card-heading">
            <div><span className="section-kicker">Autorización</span><h2>Probe real Auth + RLS</h2></div>
            <span className={`workflow-status workflow-status--${result.status === 'PASS' ? 'completed' : result.status === 'FAIL' ? 'cancelled' : 'draft'}`}>{result.status}</span>
          </div>
          <p>Comprueba que la sesión autenticada pueda leer Product Master mediante los contratos configurados para DEV.</p>
          <button type="button" onClick={() => void runProbe()} disabled={result.status === 'RUNNING'}>
            {result.status === 'RUNNING' ? 'Ejecutando…' : 'Ejecutar probe real'}
          </button>
        </article>

        <article className="card stack">
          <div className="card-heading">
            <div><span className="section-kicker">Histórico técnico</span><h2>Cutover DEV</h2></div>
            <span className={`workflow-status workflow-status--${phase311Passed ? 'completed' : 'draft'}`}>{phase311Passed ? 'PASS' : 'LECTURA'}</span>
          </div>
          <p>Se conserva como evidencia de continuidad. ARM, RETRY y EXECUTE permanecen retirados de esta pantalla.</p>
          <dl className="probe-definition-list">
            <div><dt>Run</dt><dd>{phase3Status?.runStatus ?? 'Cargando…'}</dd></div>
            <div><dt>Batch</dt><dd>{phase3Status?.batchStatus ?? 'Cargando…'}</dd></div>
            <div><dt>Verificación</dt><dd>{phase3Status?.verificationStatus ?? 'Cargando…'}</dd></div>
            <div><dt>Readiness</dt><dd>{phase3Status?.phase4Readiness ?? 'Cargando…'}</dd></div>
          </dl>
          {phaseStatusMessage ? <p role="alert" className="error-state">{phaseStatusMessage}</p> : null}
          {!phase311Passed ? (
            <button type="button" onClick={() => void verifyPhase311()} disabled={!phase310Applied || verifyStatus === 'RUNNING' || verifyStatus === 'DONE'}>
              {verifyStatus === 'RUNNING' ? 'Verificando…' : verifyStatus === 'DONE' ? 'Verificación completada' : 'Verificar post-cutover'}
            </button>
          ) : null}
        </article>
      </div>

      {verifyMessage ? <OperationalNotice title="Resultado post-cutover" tone={verifyStatus === 'FAIL' ? 'critical' : verifyStatus === 'DONE' ? 'success' : 'info'}><p>{verifyMessage}</p></OperationalNotice> : null}

      {verificationChecks.length > 0 ? (
        <div className="card stack" aria-label="Checks post-cutover">
          <div className="card-heading"><div><span className="section-kicker">Evidencia</span><h2>Checks</h2></div></div>
          <div className="probe-check-grid">
            {verificationChecks.map((check) => (
              <div key={check.check_code} className="operation-policy-note">
                <strong>{check.check_code}</strong>
                <span>{check.status} · incidencias {check.issue_count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result.status === 'PASS' ? (
        <OperationalNotice title="Probe PASS" tone="success" meta={`Huella JWT: ${result.tokenFingerprint ?? '—'}`}>
          <p>{result.message}</p>
          <p>{result.email ?? result.userId} · {result.authorizationStatus} · {result.roleCode}</p>
        </OperationalNotice>
      ) : null}

      {result.status === 'FAIL' ? <OperationalNotice title="Probe FAIL" tone="critical"><p>{result.message}</p></OperationalNotice> : null}
    </section>
  );
}

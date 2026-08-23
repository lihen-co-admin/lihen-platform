import { useEffect, useState } from 'react';

import { createGetProductsQuery } from '@lihen/products';

import { useAuth } from '../auth/auth-context';
import { PageHeader } from '../components/PageHeader';
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
    <div>
      <PageHeader
        title="DEV Auth + Admin Profile + RLS Probe"
        description="Comprueba sesión real, JWT, perfil ACTIVE, rol administrativo reconocido y lectura de products mediante Supabase DEV. El token nunca se muestra."
      />

      <div className="card stack">
        <p>
          <strong>Auth:</strong> {auth.enabled ? 'Supabase' : 'deshabilitado'}
        </p>
        <p>
          <strong>Fuente Products:</strong> {productsComposition.source}
        </p>
        <p>
          <strong>Usuario:</strong> {auth.user?.email ?? 'sin sesión'}
        </p>
        <p>
          <strong>Perfil:</strong>{' '}
          {auth.profile ? auth.profile.authorizationStatus : 'sin perfil'}
        </p>
        <p>
          <strong>Rol:</strong> {auth.profile?.roleCode ?? '—'}
        </p>

        <button
          type="button"
          onClick={() => void runProbe()}
          disabled={result.status === 'RUNNING'}
        >
          {result.status === 'RUNNING' ? 'Ejecutando…' : 'Ejecutar probe real'}
        </button>
      </div>

      <div className="card stack">
        <h2>FASE 3 — Cutover DEV</h2>
        <p>
          <strong>Run:</strong> {phase3Status?.runStatus ?? 'Cargando…'}
        </p>
        <p>
          <strong>Batch:</strong> {phase3Status?.batchStatus ?? 'Cargando…'}
        </p>
        <p>
          <strong>FASE 3.10:</strong> {phase310Applied ? 'APPLIED' : 'NO CERRADA'}
        </p>
        <p>
          <strong>FASE 3.11:</strong>{' '}
          {phase3Status?.verificationStatus ?? 'Cargando…'}
        </p>
        <p>
          <strong>Entrada FASE 4:</strong> {phase3Status?.phase4Readiness ?? 'Cargando…'}
        </p>
        <p>
          <strong>Gate:</strong> {phase3Status?.phase4Reason ?? 'Cargando…'}
        </p>

        {phaseStatusMessage && <p role="alert">{phaseStatusMessage}</p>}

        {!phase311Passed && (
          <button
            type="button"
            onClick={() => void verifyPhase311()}
            disabled={!phase310Applied || verifyStatus === 'RUNNING' || verifyStatus === 'DONE'}
          >
            {verifyStatus === 'RUNNING'
              ? 'VERIFICANDO FASE 3.11...'
              : verifyStatus === 'DONE'
                ? 'FASE 3.11 VERIFICADA'
                : 'VERIFICAR FASE 3.11'}
          </button>
        )}

        {phase311Passed && <p>FASE 3 cerrada formalmente: verificación post-cutover PASS.</p>}

        {verifyMessage && (
          <p>
            <strong>Estado VERIFY:</strong> {verifyMessage}
          </p>
        )}

        {verificationChecks.length > 0 && (
          <div className="stack" aria-label="Checks FASE 3.11">
            {verificationChecks.map((check) => (
              <p key={check.check_code}>
                <strong>{check.check_code}:</strong> {check.status} · incidencias{' '}
                {check.issue_count}
              </p>
            ))}
          </div>
        )}

        <small>
          ARM, RETRY y EXECUTE de FASE 3.10 se retiraron de esta pantalla porque el cutover ya
          está APPLIED. No deben reejecutarse desde la UI.
        </small>
      </div>

      {result.status === 'PASS' && (
        <div className="card stack" role="status" data-testid="auth-probe-pass">
          <h2>PASS</h2>
          <p>{result.message}</p>
          <p>
            <strong>User ID:</strong> {result.userId}
          </p>
          <p>
            <strong>Email:</strong> {result.email}
          </p>
          <p>
            <strong>Perfil:</strong> {result.authorizationStatus}
          </p>
          <p>
            <strong>Rol:</strong> {result.roleCode}
          </p>
          <p>
            <strong>Huella JWT:</strong> {result.tokenFingerprint}
          </p>
          <p>
            <strong>Productos leídos:</strong> {result.productCount}
          </p>
          <small>La huella SHA-256 identifica la sesión sin revelar el access token.</small>
        </div>
      )}

      {result.status === 'FAIL' && (
        <div className="card stack" role="alert" data-testid="auth-probe-fail">
          <h2>FAIL</h2>
          <p>{result.message}</p>
        </div>
      )}
    </div>
  );
}

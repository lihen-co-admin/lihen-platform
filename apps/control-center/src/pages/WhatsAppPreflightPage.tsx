import { useState } from 'react';
import {
  runWhatsAppPreflight,
  type WhatsAppPreflightResult,
} from '../composition/whatsapp-preflight';

export function WhatsAppPreflightPage() {
  const [result, setResult] = useState<WhatsAppPreflightResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPreflight() {
    setBusy(true);
    setError(null);

    try {
      setResult(await runWhatsAppPreflight());
    } catch (cause) {
      setResult(null);
      setError(
        cause instanceof Error ? cause.message : 'No fue posible ejecutar el preflight WhatsApp.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Conversation · WhatsApp · DEV</p>
          <h1>WhatsApp coexistence preflight</h1>
          <p>Diagnóstico autenticado y de solo lectura. No prepara, aprueba ni envía mensajes.</p>
        </div>
      </section>

      <section className="info-state stack">
        <strong>ENVÍO EXTERNO BLOQUEADO</strong>
        <p>
          Esta superficie únicamente ejecuta WHATSAPP_PREFLIGHT. La coexistencia debe ser confirmada
          explícitamente antes de cualquier futura activación.
        </p>
      </section>

      <section className="card stack">
        <h2>Preflight DEV</h2>

        <div className="toolbar">
          <button type="button" disabled={busy} onClick={() => void runPreflight()}>
            {busy ? 'Verificando…' : 'Ejecutar preflight'}
          </button>
        </div>

        {error ? <div className="error-state">{error}</div> : null}

        {result ? (
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th>Estado</th>
                  <td>{result.status}</td>
                </tr>
                <tr>
                  <th>Razón</th>
                  <td>{result.reason ?? '—'}</td>
                </tr>
                <tr>
                  <th>Nombre verificado</th>
                  <td>{result.verifiedName ?? '—'}</td>
                </tr>
                <tr>
                  <th>Platform type</th>
                  <td>{result.platformType ?? '—'}</td>
                </tr>
                <tr>
                  <th>WhatsApp Business App</th>
                  <td>{result.isOnBizApp ? 'SÍ' : 'NO'}</td>
                </tr>
                <tr>
                  <th>Coexistencia confirmada</th>
                  <td>{result.coexistenceConfirmed ? 'SÍ' : 'NO'}</td>
                </tr>
                <tr>
                  <th>Verificación de código</th>
                  <td>{result.codeVerificationStatus ?? '—'}</td>
                </tr>
                <tr>
                  <th>Permisos faltantes</th>
                  <td>
                    {result.missingRequiredPermissions.length
                      ? result.missingRequiredPermissions.join(', ')
                      : 'NINGUNO'}
                  </td>
                </tr>
                <tr>
                  <th>Envío habilitado</th>
                  <td>{result.sendingEnabled ? 'SÍ' : 'NO'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

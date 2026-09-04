import { useState } from 'react';
import { AdminPageHero } from '../components/AdminPageHero';
import { OperationalNotice } from '../components/OperationalNotice';

type AssistantUiState =
  | 'READY'
  | 'PROVIDER_NOT_CONFIGURED';

export function AssistantPage() {
  const [prompt, setPrompt] = useState('');
  const [uiState, setUiState] = useState<AssistantUiState>('READY');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim()) return;

    // GAP-034 establishes the governed conversational surface and core facade.
    // A provider/runtime adapter must be composed server-side or at a trusted
    // application boundary; browser secrets are intentionally prohibited.
    setUiState('PROVIDER_NOT_CONFIGURED');
  }

  return (
    <section className="stack">
      <AdminPageHero
        eyebrow="LIHEN INTELLIGENCE"
        title="LIHEN Assistant"
        description="Interfaz conversacional gobernada sobre Context Resolver, Intelligence Orchestrator y el Control Plane existente."
        accent="pink"
        status={<span className="status-badge">GOVERNED · DEV</span>}
      />

      <OperationalNotice
        title="El Assistant no tiene autoridad de escritura"
        tone="info"
        meta="Context → Orchestrator → Human review → Control Plane"
      >
        <p>
          Puede consultar contexto autorizado y producir respuestas o recomendaciones.
          No cambia precios, inventario, compras, ventas, finanzas, lifecycle ni
          publicación por sí solo.
        </p>
      </OperationalNotice>

      <div className="table-card">
        <div className="table-summary">
          <div>
            <strong>Conversación gobernada</strong>
            <br />
            <span>DEV · proveedor desacoplado mediante ModelPort</span>
          </div>
        </div>

        <div className="empty-state" aria-live="polite">
          {uiState === 'READY' ? (
            <>
              <strong>¿Qué necesitas revisar?</strong>
              <p>
                La conversación se ejecutará únicamente cuando exista un adapter de
                runtime seguro. Las claves de proveedor nunca deben vivir en el navegador.
              </p>
            </>
          ) : (
            <>
              <strong>Runtime de modelo aún no configurado</strong>
              <p>
                La interfaz y el core del Assistant están listos. No se realizó ninguna
                llamada externa ni operación controlada.
              </p>
            </>
          )}
        </div>

        <form className="toolbar" onSubmit={submit}>
          <label style={{ flex: 1 }}>
            <span className="sr-only">Mensaje para LIHEN Assistant</span>
            <input
              type="text"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setUiState('READY');
              }}
              placeholder="Escribe una consulta para LIHEN Assistant…"
            />
          </label>
          <button type="submit" className="button-primary">
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}

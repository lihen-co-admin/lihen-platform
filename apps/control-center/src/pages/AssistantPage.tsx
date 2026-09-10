import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { AdminPageHero } from '../components/AdminPageHero';
import { OperationalNotice } from '../components/OperationalNotice';
import { assistantRuntimeInvoker } from '../composition/assistant-runtime';

type AssistantUiState =
  | 'READY'
  | 'RUNNING'
  | 'SUCCESS'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_FAILED'
  | 'PERMISSION_DENIED'
  | 'DEPENDENCY_FAILED';

export function AssistantPage() {
  const auth = useAuth();
  const [prompt, setPrompt] = useState('');
  const [productId, setProductId] = useState('');
  const [uiState, setUiState] = useState<AssistantUiState>('READY');
  const [contextSource, setContextSource] = useState<string | null>(null);
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim() || !productId.trim()) return;

    setUiState('RUNNING');
    setContextSource(null);
    setMessages([]);
    setAnswer(null);

    if (!auth.authorized || !auth.user) {
      setUiState('PERMISSION_DENIED');
      setMessages([
        'CONTROL_CENTER_AUTHORIZATION_REQUIRED',
      ]);
      return;
    }

    try {
      const turn =
        await assistantRuntimeInvoker.invokeProductTurn({
          prompt,
          productId,
        });

      setContextSource(turn.contextSource ?? null);
      setMessages(turn.messages);
      setAnswer(turn.answer ?? null);

      switch (turn.status) {
        case 'SUCCESS':
          setUiState('SUCCESS');
          break;
        case 'PROVIDER_NOT_CONFIGURED':
          setUiState('PROVIDER_NOT_CONFIGURED');
          break;
        case 'PROVIDER_FAILED':
          setUiState('PROVIDER_FAILED');
          break;
        case 'PERMISSION_DENIED':
          setUiState('PERMISSION_DENIED');
          break;
        default:
          setUiState('DEPENDENCY_FAILED');
          break;
      }
    } catch (error) {
      setUiState('DEPENDENCY_FAILED');
      setMessages([
        error instanceof Error
          ? error.message
          : 'LIHEN_ASSISTANT_RUNTIME_UNKNOWN_FAILURE',
      ]);
    }
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

      <div className="card stack">
        <div className="card-heading">
          <div>
            <span className="card-label">Intelligence</span>
            <h2>Conversación gobernada</h2>
            <p>DEV · proveedor desacoplado mediante ModelPort</p>
          </div>
        </div>

        <div className="empty-state" aria-live="polite">
          {uiState === 'READY' ? (
            <>
              <strong>¿Qué producto necesitas revisar?</strong>
              <p>
                DEV resolverá primero el Product Master y sus permisos. El modelo
                permanece desacoplado y todavía no está configurado.
              </p>
            </>
          ) : null}

          {uiState === 'RUNNING' ? (
            <>
              <strong>Resolviendo contexto gobernado…</strong>
              <p>Consultando Product Master sin ejecutar cambios.</p>
            </>
          ) : null}

          {uiState === 'SUCCESS' ? (
            <>
              <strong>Respuesta de LIHEN Assistant</strong>
              <p>{answer || 'El modelo respondió sin contenido visible.'}</p>
              {contextSource ? (
                <p>{`Contexto resuelto desde ${contextSource}.`}</p>
              ) : null}
            </>
          ) : null}

          {uiState === 'PROVIDER_FAILED' ? (
            <>
              <strong>El proveedor de modelo no respondió correctamente</strong>
              <p>
                {messages.join(' ') || 'El Assistant falló de forma segura sin ejecutar operaciones.'}
              </p>
            </>
          ) : null}

          {uiState === 'PROVIDER_NOT_CONFIGURED' ? (
            <>
              <strong>Contexto listo · runtime de modelo pendiente</strong>
              <p>
                {contextSource
                  ? `Contexto resuelto desde ${contextSource}.`
                  : 'El contexto gobernado fue procesado.'}
                {' '}No se realizó ninguna llamada externa ni operación controlada.
              </p>
            </>
          ) : null}

          {uiState === 'PERMISSION_DENIED' ? (
            <>
              <strong>Lectura no autorizada</strong>
              <p>La sesión actual no puede ejecutar esta consulta del Assistant.</p>
            </>
          ) : null}

          {uiState === 'DEPENDENCY_FAILED' ? (
            <>
              <strong>No fue posible resolver el contexto</strong>
              <p>{messages.join(' ') || 'La dependencia de lectura no pudo completarse.'}</p>
            </>
          ) : null}
        </div>

        <form className="toolbar" onSubmit={submit}>
          <label style={{ flex: 0.55 }}>
            <span className="sr-only">ID del producto</span>
            <input
              type="text"
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setUiState('READY');
              }}
              placeholder="Product ID"
            />
          </label>

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

          <button
            type="submit"
            className="button-primary"
            disabled={
              uiState === 'RUNNING'
              || !prompt.trim()
              || !productId.trim()
              || auth.authorizationLoading
            }
          >
            {uiState === 'RUNNING' ? 'Revisando…' : 'Enviar'}
          </button>
        </form>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  editorialOperationsInDev,
  type EditorialServerAssessment,
} from '../composition/editorial-operations';
import type { EditorialItem } from '../domain/editorial-planning';

const reasons: Record<string, string> = {
  CHANNEL_UNAVAILABLE:
    'Integración no disponible. TikTok/Reel no tienen runtime; WhatsApp pertenece a Conversation con SEND bloqueado.',
  PUBLICATION_NOT_APPROVED: 'Falta aprobación explícita del contenido.',
  SCHEDULE_LINK_INVALID: 'Programación y variante no coinciden.',
  SCHEDULE_NOT_APPROVED: 'Falta aprobación de programación.',
  NOT_DUE: 'La fecha aún no se ha alcanzado o es inválida.',
  MEDIA_REQUIRED: 'Falta la primera imagen.',
  PRODUCT_MEDIA_NOT_AUTHORIZED:
    'El servidor no pudo autorizar la primera imagen para este producto.',
  ATTEMPT_REQUIRES_RECONCILIATION_NO_RETRY:
    'Hay intentos terminales, múltiples o inciertos. Reconciliar; no reintentar.',
  META_PUBLICATION_DISABLED: 'Publicación externa deshabilitada en el servidor.',
  PROVIDER_NOT_CONFIGURED: 'Configuración del proveedor incompleta.',
};

export function EditorialOperationalActions({
  item,
  disabled,
  onRefresh,
  onBusyChange,
  operations = editorialOperationsInDev,
}: {
  item: EditorialItem;
  disabled: boolean;
  onRefresh: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  operations?: typeof editorialOperationsInDev;
}) {
  const [assessment, setAssessment] = useState<EditorialServerAssessment | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    setAssessment(null);
    setConfirmed(false);
  }, [item]);
  async function assess() {
    if (disabled || lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setConfirmed(false);
    setAssessment(null);
    setMessage('');
    try {
      setAssessment(await operations().assess(item.publication.id, item.productId));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Assessment no disponible.');
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  async function act() {
    if (disabled || lock.current || !confirmed || !assessment?.nextAction) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setConfirmed(false);
    setAssessment(null);
    try {
      const result = await operations().confirm(assessment, assessment.nextAction);
      setMessage(
        result.externalPublication
          ? 'El runtime reportó publicación externa. Revisa la referencia persistida; no volver a publicar.'
          : 'Acción respondida por el runtime. Revisa el estado persistido antes de decidir.',
      );
    } catch (cause) {
      setMessage(
        `${cause instanceof Error ? cause.message : 'Resultado incierto.'} No reintentes. Relee el estado de DEV para reconciliar.`,
      );
    } finally {
      try {
        await onRefresh();
      } finally {
        lock.current = false;
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  return (
    <section className="stack" aria-label="Operación gobernada DEV">
      <h3>Operación gobernada DEV</h3>
      <p>
        GENERATED != OFFICIAL · RECOMMENDATION != EXECUTION. Evaluar no crea intentos ni publica.
        Cada acción requiere confirmación independiente.
      </p>
      <button disabled={disabled || busy || !item.productId} onClick={() => void assess()}>
        Evaluar estado actual en servidor
      </button>
      {!item.productId && <p>Bloqueado: falta producto asociado a la primera imagen autorizada.</p>}
      {assessment && (
        <>
          <p>
            {assessment.channel} · {assessment.preparedPublicationId} · {assessment.assessedAt}
          </p>
          <p>{assessment.copy}</p>
          <p>{assessment.callToAction}</p>
          <p>{assessment.hashtags.map((tag) => `#${tag}`).join(' ')}</p>
          <p>Media confirmada: {assessment.creativeAssetIds.join(', ')}</p>
          {assessment.blockers.length > 0 && (
            <ul>
              {assessment.blockers.map((reason) => (
                <li key={reason}>{reasons[reason] ?? reason}</li>
              ))}
            </ul>
          )}
          {assessment.nextAction && (
            <>
              <p>
                {assessment.nextAction === 'CREATE_PUBLICATION_ATTEMPT'
                  ? 'Disponible: preparar un único intento PENDING; no publica. Después requiere una nueva evaluación y otra confirmación.'
                  : `Disponible: solicitar publicación externa real del intento ${assessment.attemptId}. El servidor volverá a validar todas las guardas.`}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={disabled || busy}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                {assessment.nextAction === 'CREATE_PUBLICATION_ATTEMPT'
                  ? 'Apruebo crear este intento sin publicar.'
                  : 'Apruebo explícitamente publicar este contenido en este canal.'}
              </label>
              <button disabled={disabled || busy || !confirmed} onClick={() => void act()}>
                {assessment.nextAction === 'CREATE_PUBLICATION_ATTEMPT'
                  ? 'Crear intento pendiente'
                  : 'Ejecutar publicación aprobada'}
              </button>
            </>
          )}
        </>
      )}
      {busy && <p role="status">Operación en curso. No repitas la acción.</p>}
      {message && <p role="status">{message}</p>}
      <p>
        Actualizar desde DEV reconcilia la vista con la persistencia; no consulta Meta ni resuelve
        manualmente resultados inciertos. No hay reintento ni scheduler automático.
      </p>
    </section>
  );
}

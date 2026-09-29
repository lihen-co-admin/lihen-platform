import { useEffect, useRef, useState } from 'react';
import {
  editorialOperationsInDev,
  type EditorialServerAssessment,
} from '../composition/editorial-operations';
import type { EditorialItem } from '../domain/editorial-planning';

const reasons: Record<string, string> = {
  CHANNEL_UNAVAILABLE:
    'Integración no disponible para este canal. WhatsApp pertenece a Conversation con SEND bloqueado.',
  PUBLICATION_NOT_APPROVED: 'Falta aprobación explícita del contenido.',
  SCHEDULE_LINK_INVALID: 'Programación y variante no coinciden.',
  SCHEDULE_NOT_APPROVED: 'Falta aprobación de programación.',
  NOT_DUE: 'La fecha aún no se ha alcanzado o es inválida.',
  MEDIA_REQUIRED: 'Falta la primera referencia de media.',
  REEL_VIDEO_NOT_AUTHORIZED: 'El servidor no pudo autorizar el video de Reel para este producto.',
  TIKTOK_VIDEO_NOT_AUTHORIZED:
    'El servidor no pudo autorizar el video de TikTok para este producto.',
  TIKTOK_PUBLICATION_DISABLED: 'Publicación TikTok deshabilitada en el servidor.',
  TIKTOK_SINGLE_VIDEO_REQUIRED: 'TikTok requiere exactamente un video durable por variante.',
  TIKTOK_NOT_CONFIGURED: 'Configuración TikTok incompleta.',
  TIKTOK_VIDEO_PUBLISH_SCOPE_REQUIRED: 'Falta autorización verificada video.publish para TikTok.',
  TIKTOK_PROVIDER_CONTRACT_UNVERIFIED:
    'El contrato oficial de TikTok está codificado; la configuración o disponibilidad del proveedor sigue pendiente. La publicación permanece bloqueada.',
  TIKTOK_VIDEO_URL_NOT_VERIFIED:
    'El video requiere una URL HTTPS de origen verificado para TikTok.',
  TIKTOK_VIDEO_DURATION_VERIFICATION_UNAVAILABLE:
    'La publicación TikTok permanece bloqueada porque todavía no existe una medición confiable de la duración del video en el servidor.',
  TIKTOK_VIDEO_DURATION_INVALID: 'La duración del video excede el máximo vigente del creador o no puede validarse.',
  TIKTOK_CREATOR_INFO_REQUIRED:
    'Información vigente del creador y controles requeridos no disponibles.',
  TIKTOK_EXPLICIT_CHOICES_REQUIRED:
    'Selecciona privacidad y consentimiento respaldados por información del creador, y vuelve a evaluar.',
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
  const [choices, setChoices] = useState<EditorialServerAssessment['tiktokChoices']>(null);
  const [privacy, setPrivacy] = useState('');
  const [creatorContext, setCreatorContext] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    setAssessment(null);
    setConfirmed(false);
    setChoices(null);
    setPrivacy('');
    setCreatorContext(null);
    setInteractions({});
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
      setAssessment(await operations().assess(item.publication.id, item.productId, choices, creatorContext));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Assessment no disponible.');
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  async function readCreator() {
    if (disabled || lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true);
    setConfirmed(false); setChoices(null); setPrivacy(''); setInteractions({}); setAssessment(null); setCreatorContext(null); setMessage('');
    try {
      const op = operations();
      const result = await op.readTikTokCreator(item.publication.id, item.productId);
      setCreatorContext(result.context);
      setAssessment(await op.assess(item.publication.id, item.productId, null, result.context));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Información TikTok no disponible.'); }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
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
      {item.publication.channel === 'TIKTOK' && <>
        <button disabled={disabled || busy || !item.productId} onClick={() => void readCreator()}>Consultar creador TikTok</button>
        <p>Esta consulta obtiene opciones actuales de TikTok; no envía el video. El procesamiento y la publicación pueden tardar.</p>
      </>}
      {!item.productId && <p>Bloqueado: falta producto asociado a la primera media autorizada.</p>}
      {item.attempts.map((attempt) =>
        attempt.providerEvidence?.length ? (
          <div key={attempt.id}>
            <p>
              Evidencia TikTok · {attempt.id} · {attempt.status}. Aceptación no acredita
              publicación.
            </p>
            {attempt.providerEvidence.map((entry, index) => (
              <p key={index}>
                {String(entry.kind ?? 'UNKNOWN')} · {String(entry.publishId ?? '')}
              </p>
            ))}
          </div>
        ) : null,
      )}
      {assessment && (
        <>
          <p>
            {assessment.channel} · {assessment.preparedPublicationId} · {assessment.assessedAt}
          </p>
          <p>{assessment.copy}</p>
          <p>{assessment.callToAction}</p>
          <p>{assessment.hashtags.map((tag) => `#${tag}`).join(' ')}</p>
          <p>Media confirmada: {assessment.creativeAssetIds.join(', ')}</p>
          {assessment.channel === 'TIKTOK' && assessment.tiktokCreator && (
            <fieldset disabled={busy || disabled}>
              <legend>TikTok · creador {assessment.tiktokCreator.accountId}</legend>
              <p>Duración máxima: {assessment.tiktokCreator.maxVideoDurationSec} segundos.</p>
              <label>
                Privacidad
                <select
                  value={privacy}
                  onChange={(event) => {
                    setPrivacy(event.target.value);
                    setChoices(null);
                    setConfirmed(false);
                    setAssessment({ ...assessment, nextAction: null, snapshot: '' });
                  }}
                >
                  <option value="">Selecciona privacidad</option>
                  {assessment.tiktokCreator.privacyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              {assessment.tiktokCreator.interactions.map((interaction) => <label key={interaction.key}>{interaction.label}
                <select disabled={!interaction.allowed} value={interaction.allowed ? (typeof interactions[interaction.key] === 'boolean' ? String(interactions[interaction.key]) : '') : 'false'} onChange={(event) => {
                  setInteractions({ ...interactions, [interaction.key]: event.target.value === 'true' }); setChoices(null); setConfirmed(false); setAssessment({ ...assessment, nextAction: null, snapshot: '' });
                }}>
                  {interaction.allowed ? <><option value="" disabled>Selecciona una opción</option><option value="true">Permitir</option><option value="false">Desactivar</option></> : <option value="false">Desactivado por el creador</option>}
                </select>
              </label>)}
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(choices)}
                  disabled={!privacy || assessment.tiktokCreator.interactions.some((entry) => entry.allowed && typeof interactions[entry.key] !== 'boolean')}
                  onChange={(event) => {
                    setChoices(
                      event.target.checked
                        ? {
                            creatorRevision: assessment.tiktokCreator!.revision,
                            privacy,
                            consent: true,
                            interactions: Object.fromEntries(assessment.tiktokCreator!.interactions.map((entry) => [entry.key, entry.allowed ? interactions[entry.key]! : false])),
                          }
                        : null,
                    );
                    setConfirmed(false);
                    setAssessment({ ...assessment, nextAction: null, snapshot: '' });
                  }}
                />
                {assessment.tiktokCreator.consentText}
              </label>
              <p>
                Vuelve a evaluar después de elegir. No se presume permiso para publicación pública.
              </p>
            </fieldset>
          )}
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
        Actualizar desde DEV reconcilia la vista con la persistencia; no consulta proveedores ni
        resuelve manualmente resultados inciertos. No hay reintento ni scheduler automático.
      </p>
    </section>
  );
}

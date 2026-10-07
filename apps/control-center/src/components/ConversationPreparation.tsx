import { useRef, useState } from 'react';
import { conversationPreparationRepository, type ReplyDraft, type FollowUp } from '../composition/conversation-preparation';

export function ConversationPreparation({ conversationId, allowed }: { conversationId: string; allowed: boolean }) {
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [body, setBody] = useState('');
  const [reason, setReason] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  function operationId(payload: unknown) {
    const fingerprint = JSON.stringify(payload);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() };
    return pending.current!.id;
  }
  async function run(action: () => Promise<void>) {
    if (!allowed || busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Persistencia no disponible.'); }
    finally { setBusy(false); }
  }
  async function read() {
    const saved = await conversationPreparationRepository().read(conversationId);
    setDraft(saved.draft); setFollowUp(saved.followUp); setBody(saved.draft?.body ?? ''); setReason(saved.followUp?.reason ?? ''); setDueAt(''); setLoaded(true);
  }
  async function saveDraft(status: ReplyDraft['status']) {
    const previous = draft?.id ?? null;
    const id = operationId(['draft', conversationId, previous, body, status]);
    setDraft(await conversationPreparationRepository().saveDraft(id, conversationId, previous, body, status));
  }
  async function saveFollowUp(status: FollowUp['status']) {
    const previous = followUp?.id ?? null;
    const date = dueAt ? new Date(dueAt).toISOString() : followUp?.due_at ?? null;
    const id = operationId(['followUp', conversationId, previous, reason, date, status]);
    setFollowUp(await conversationPreparationRepository().saveFollowUp(id, conversationId, previous, reason, date, status));
  }
  return <section className="card stack"><h2>Preparación durable · Sin enviar</h2>
    <p>WHATSAPP_SENDING_ENABLED=false. Aprobar guarda una revisión; no crea intentos ni envía mensajes. Requiere la migración de preparación instalada.</p>
    <button disabled={!allowed || busy} onClick={() => void run(read)}>Consultar preparación guardada / recargar</button>
    {!allowed && <p>Requiere OWNER/ADMIN activo.</p>}
    <fieldset disabled={!allowed || busy || !loaded}>
      <label>Respuesta<textarea value={body} onChange={e => setBody(e.target.value)} rows={5} /></label>
      <button disabled={!body.trim()} onClick={() => void run(() => saveDraft('DRAFT'))}>Guardar borrador</button>
      <button disabled={!draft || draft.status !== 'DRAFT' || body !== draft.body} onClick={() => void run(() => saveDraft('READY_FOR_REVIEW'))}>Solicitar revisión</button>
      <button disabled={draft?.status !== 'READY_FOR_REVIEW' || body !== draft.body} onClick={() => void run(() => saveDraft('APPROVED'))}>Aprobar respuesta · Sin enviar</button>
      {draft && <p role="status">{draft.status} · revisión {draft.revision} · guardada {draft.created_at} · actor {draft.created_by} · Sin enviar</p>}
      <label>Motivo del seguimiento<textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
      <label>Vencimiento opcional (zona horaria del navegador)<input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} /></label>
      <button disabled={!reason.trim()} onClick={() => void run(() => saveFollowUp('OPEN'))}>Guardar seguimiento abierto</button>
      <button disabled={followUp?.status !== 'OPEN' || reason !== followUp.reason} onClick={() => void run(() => saveFollowUp('DONE'))}>Marcar realizado</button>
      <button disabled={followUp?.status !== 'OPEN' || reason !== followUp.reason} onClick={() => void run(() => saveFollowUp('CANCELLED'))}>Cancelar seguimiento</button>
      {followUp && <p role="status">{followUp.status} · {followUp.reason} · vence {followUp.due_at ?? 'Sin fecha'} · revisión {followUp.revision}</p>}
    </fieldset>
    {error && <p role="alert">{error} No se confirmó el guardado. Reintentar conserva el identificador; ante conflicto, recargar.</p>}
    <button disabled>Enviar WhatsApp · bloqueado</button>
  </section>;
}

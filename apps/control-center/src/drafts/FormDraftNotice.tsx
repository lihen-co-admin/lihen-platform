import type { LocalFormDraft, DraftSnapshot } from './local-form-draft';

export function FormDraftNotice<T>({
  session,
  snapshot,
  uncertainHelp,
  cleanHelp,
}: {
  session: LocalFormDraft<T> | null;
  snapshot: DraftSnapshot<T> | null;
  uncertainHelp?: string;
  cleanHelp?: string;
}) {
  if (!session || !snapshot) return null;
  return (
    <aside className="info-state" aria-label="Borrador local">
      <p role="status">
        {snapshot.pending
          ? 'Existe un borrador local sin guardar. Revisa los datos actuales antes de restaurarlo.'
          : snapshot.operation
            ? 'Resultado de guardado pendiente de verificar. No se enviarán reintentos automáticamente.'
            : snapshot.dirty
              ? 'Cambios sin guardar en Supabase. Borrador local conservado en este navegador.'
              : (cleanHelp ??
                'Datos cargados del servidor. Los cambios se conservarán como borrador local.')}
      </p>
      {snapshot.storageError ? (
        <p role="alert">
          No se pudo leer o conservar el borrador local. Mantén esta pantalla abierta; el guardado
          no se enviará sin conservar su identidad.
        </p>
      ) : null}
      {snapshot.pending ? (
        <button type="button" onClick={() => session.restore()}>
          Restaurar borrador local
        </button>
      ) : null}
      {snapshot.conflict ? (
        <p role="alert">
          Los datos del servidor cambiaron desde que comenzó este borrador. Compara los valores
          antes de guardar.
        </p>
      ) : null}
      {snapshot.conflict && !snapshot.pending && !snapshot.operation ? (
        <button type="button" onClick={() => session.acknowledgeConflict()}>
          Confirmo que revisé los datos actuales
        </button>
      ) : null}
      {snapshot.operation?.phase === 'UNCERTAIN' ? (
        <p>
          {uncertainHelp ??
            'Verifica el resultado antes de reintentar. El reintento conserva la misma operaci\u00f3n y bloquea cambios de contenido.'}
        </p>
      ) : null}
    </aside>
  );
}

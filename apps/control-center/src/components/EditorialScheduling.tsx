import { useState } from 'react';
import { parseEditorialDate } from '../composition/editorial-workspace';
import {
  channelCapability,
  formatEditorialDate,
  isEditorialScheduled,
  type EditorialItem,
} from '../domain/editorial-planning';

export function EditorialScheduling({
  item,
  productName,
  now,
  disabled,
  onSchedule,
}: {
  item: EditorialItem;
  productName?: string | undefined;
  now: Date;
  disabled: boolean;
  onSchedule: (date: string) => void;
}) {
  const [date, setDate] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const scheduled = isEditorialScheduled(item);
  const approved = item.publication.status === 'APPROVED';
  const mediaPresent = item.publication.creativeAssetIds.length > 0;
  let dateError = '';
  if (date) {
    try {
      if (parseEditorialDate(date) <= now)
        dateError = 'Selecciona una fecha y hora futuras en America/Bogota.';
    } catch {
      dateError = 'Selecciona una fecha y hora válidas en America/Bogota.';
    }
  }
  const nextStep = scheduled
    ? 'Programación editorial confirmada en DEV. La ejecución externa automática continúa desactivada.'
    : item.attempts.length
      ? 'Revisa los intentos existentes en el área de operaciones antes de decidir otra acción.'
      : item.publication.status === 'CANCELLED'
        ? 'Contenido cancelado. Crea un nuevo borrador si necesitas otra pieza.'
        : !item.productId || !mediaPresent
          ? item.publication.status === 'PREPARED'
            ? 'Edita el borrador y selecciona producto y media antes de enviarlo a revisión.'
            : 'Falta producto o media. Actualiza desde DEV; si la pieza sigue incompleta, cancélala y crea un borrador completo antes de aprobar.'
          : item.publication.status === 'PREPARED'
            ? 'Revisa el copy y la media de este canal y envía el borrador a revisión.'
            : !approved
              ? 'Revisa esta variante y aprueba el contenido. Aprobar todavía no programa.'
              : 'Elige fecha y hora, revisa el resumen y confirma la programación editorial.';

  return (
    <section className="stack" aria-label="Programación editorial">
      <h3>Programación editorial</h3>
      <p>
        <strong>Siguiente paso:</strong> {nextStep}
      </p>
      <dl>
        <dt>Canal</dt>
        <dd>{channelCapability(item.publication.channel).label}</dd>
        <dt>Producto</dt>
        <dd>{(productName ?? item.productId) || 'Sin producto asociado'}</dd>
        <dt>Media seleccionada</dt>
        <dd>
          {mediaPresent ? item.publication.creativeAssetIds.join(', ') : 'Sin media seleccionada'}
        </dd>
        <dt>Aprobación del contenido</dt>
        <dd>{approved ? 'Aprobado · APPROVED' : item.publication.status}</dd>
        <dt>Estado de programación</dt>
        <dd>
          {scheduled ? 'Programado editorialmente · APPROVED' : 'Sin programación confirmada'}
        </dd>
        <dt>Fecha y hora · America/Bogota</dt>
        <dd>
          {item.schedule
            ? `${formatEditorialDate(item.schedule.scheduledFor)}${scheduled ? '' : ' · fecha propuesta; no confirmada'}`
            : 'Sin fecha'}
        </dd>
      </dl>
      <p>
        La ejecución externa automática continúa desactivada. Programar no crea intentos ni publica
        en Instagram, Facebook o TikTok.
      </p>
      {approved && !scheduled && !item.attempts.length && (
        <fieldset disabled={disabled || !item.productId || !mediaPresent} className="stack">
          <legend>Confirmar fecha y hora de esta variante</legend>
          <label>
            Fecha y hora · America/Bogota
            <input
              type="datetime-local"
              value={date}
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? 'editorial-schedule-date-error' : undefined}
              onChange={(event) => {
                setDate(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          {dateError && (
            <p role="alert" id="editorial-schedule-date-error">
              {dateError}
            </p>
          )}
          {date && !dateError && (
            <p>
              Confirmar para {channelCapability(item.publication.channel).label}:{' '}
              {formatEditorialDate(parseEditorialDate(date))} · America/Bogota.
            </p>
          )}
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={!date || Boolean(dateError)}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Confirmo esta fecha y hora para este canal. Solo autorizo la programación editorial.
          </label>
          <button
            type="button"
            disabled={!date || Boolean(dateError) || !confirmed}
            onClick={() => {
              setConfirmed(false);
              onSchedule(date);
            }}
          >
            Confirmar programación editorial
          </button>
        </fieldset>
      )}
    </section>
  );
}

import { channelCapability, type EditorialItem } from './editorial-planning';

export interface EditorialOperationCheck {
  readonly code: string;
  readonly observed: boolean;
  readonly message: string;
}

// An explanation of the observed contracts, never an execution authorization.
// Media authorization, provider configuration and current server state are not
// available in READ_EDITORIAL_WORKSPACE and must not be inferred here.
export function assessEditorialOperation(item: EditorialItem, now: Date) {
  const { publication, schedule, attempts } = item;
  const checks: EditorialOperationCheck[] = [
    {
      code: 'CHANNEL',
      observed: channelCapability(publication.channel).runtimeSupported,
      message: channelCapability(publication.channel).runtimeSupported
        ? 'Canal contemplado por el runtime de imágenes; activación no verificada.'
        : 'Integración de publicación no disponible para este canal.',
    },
    {
      code: 'PUBLICATION_APPROVAL',
      observed: publication.status === 'APPROVED',
      message:
        publication.status === 'APPROVED'
          ? 'Aprobación editorial observada.'
          : `Contenido ${publication.status}: requiere aprobación humana explícita.`,
    },
    {
      code: 'SCHEDULE_LINK',
      observed: Boolean(
        schedule &&
        publication.scheduleId === schedule.id &&
        publication.channelVariantId &&
        schedule.channelVariantId === publication.channelVariantId,
      ),
      message:
        schedule &&
        publication.scheduleId === schedule.id &&
        publication.channelVariantId &&
        schedule.channelVariantId === publication.channelVariantId
          ? 'Programación asociada a esta variante.'
          : 'Falta una programación vinculada a esta publicación y variante.',
    },
    {
      code: 'SCHEDULE_APPROVAL',
      observed: schedule?.status === 'APPROVED',
      message:
        schedule?.status === 'APPROVED'
          ? 'Programación editorial aprobada; no activa el scheduler.'
          : 'Falta confirmar la programación editorial por separado.',
    },
    {
      code: 'DUE',
      observed: Boolean(
        schedule &&
        Number.isFinite(now.getTime()) &&
        Number.isFinite(schedule.scheduledFor.getTime()) &&
        schedule.scheduledFor <= now,
      ),
      message:
        !schedule ||
        !Number.isFinite(schedule.scheduledFor.getTime()) ||
        !Number.isFinite(now.getTime())
          ? 'Fecha válida no disponible para evaluar vencimiento.'
          : schedule.scheduledFor > now
            ? 'Fecha futura: todavía no corresponde al runtime de vencimientos.'
            : 'Fecha alcanzada; no dispara publicación automática.',
    },
    {
      code: 'MEDIA_REFERENCE',
      observed: Boolean(publication.creativeAssetIds[0]?.trim()),
      message: publication.creativeAssetIds[0]?.trim()
        ? 'Primera referencia de media presente; autorización y vigencia pendientes de validar en servidor.'
        : 'Falta la primera referencia de imagen requerida por el runtime.',
    },
    {
      code: 'ATTEMPT_HISTORY',
      observed: attempts.length === 0,
      message:
        attempts.length === 0
          ? 'Sin intentos en la biblioteca leída; no garantiza ausencia en el servidor.'
          : 'Hay intentos registrados: revisar su trazabilidad antes de cualquier decisión operativa.',
    },
  ];
  const followUp = attempts.map((attempt) => ({
    id: attempt.id,
    status: attempt.status,
    message:
      attempt.preparedPublicationId !== publication.id
        ? 'Asociación inconsistente: actualizar desde DEV antes de decidir.'
        : attempt.status === 'PENDING'
          ? 'Intento pendiente; no crear otro ni ejecutar desde este workspace.'
          : attempt.status === 'IN_PROGRESS'
            ? 'Resultado incierto: requiere seguimiento del runtime; no reintentar.'
            : attempt.status === 'SUCCEEDED'
              ? !attempt.externalPublicationRef ||
                attempt.externalPublicationRef.startsWith('local-')
                ? 'Sin evidencia externa verificable; una simulación no acredita publicación.'
                : 'Éxito reportado por el runtime con referencia externa; no volver a publicar.'
              : attempt.status === 'FAILED'
                ? 'Fallo registrado; revisar la causa. No autoriza reintento automático.'
                : attempt.status === 'CANCELLED'
                  ? 'Intento cancelado; no autoriza otro intento.'
                  : 'Estado no reconocido: actualizar desde DEV antes de decidir.',
  }));
  return {
    checks,
    followUp,
    observedRequirementsMet: checks.every((check) => check.observed),
    executionAllowed: false as const,
  };
}

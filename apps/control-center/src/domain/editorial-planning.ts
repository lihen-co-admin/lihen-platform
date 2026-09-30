import type { ContentSchedule, PreparedPublication, PublicationAttempt } from '@lihen/marketing';

export const editorialChannels = [
  { id: 'INSTAGRAM_FEED', label: 'Instagram Feed', runtime: true },
  { id: 'INSTAGRAM_STORY', label: 'Instagram Story', runtime: true },
  { id: 'INSTAGRAM_REEL', label: 'Instagram Reel', runtime: true },
  { id: 'FACEBOOK', label: 'Facebook', runtime: true },
  { id: 'TIKTOK', label: 'TikTok', runtime: true },
] as const;
export type EditorialChannel = (typeof editorialChannels)[number]['id'];
export const whatsappCapability = {
  preparation: true,
  sendingEnabled: false,
  reason: 'Coexistencia oficial todavía no confirmada.',
} as const;
export function channelCapability(channel: string) {
  const entry = editorialChannels.find((item) => item.id === channel);
  return {
    label: entry?.label ?? channel,
    runtimeSupported: entry?.runtime ?? false,
    externalPublicationEnabled: false,
    status:
      channel === 'WHATSAPP'
        ? 'ENVÍO BLOQUEADO'
        : entry?.runtime
          ? 'PREPARACIÓN DISPONIBLE'
          : 'INTEGRACIÓN DE PUBLICACIÓN PENDIENTE',
  } as const;
}

// UI annotations do not extend the persisted marketing contracts.
export interface EditorialItem {
  readonly publication: PreparedPublication;
  readonly schedule: ContentSchedule | null;
  readonly productId: string;
  readonly campaignName: string;
  readonly history: readonly { at: string; action: string }[];
  readonly attempts: readonly PublicationAttempt[];
}
export interface EditorialGoals {
  readonly weekly: number;
  readonly priorityChannel: string;
  readonly priorityProduct: string;
  readonly priorityCampaign: string;
}
export function dayKey(date: Date, timezone = 'America/Bogota'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function formatEditorialDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
export function isEditorialScheduled(item: EditorialItem): boolean {
  return (
    item.publication.status === 'APPROVED' &&
    item.schedule?.status === 'APPROVED' &&
    item.publication.scheduleId === item.schedule.id &&
    item.schedule.channelVariantId === item.publication.channelVariantId
  );
}
export function editorialStatus(item: EditorialItem): string {
  const attempt = [...item.attempts].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
  if (attempt?.status === 'SUCCEEDED')
    return !attempt.externalPublicationRef || attempt.externalPublicationRef.startsWith('local-')
      ? 'Sin evidencia externa'
      : 'Publicado';
  if (attempt?.status === 'PENDING') return 'Intento pendiente de acción explícita';
  if (attempt?.status === 'CANCELLED') return 'Intento cancelado';
  if (attempt?.status === 'FAILED') return 'Fallido';
  if (attempt?.status === 'IN_PROGRESS') return 'Resultado pendiente de reconciliación';
  if (item.publication.status === 'CANCELLED') return 'Cancelado';
  if (item.publication.status === 'IN_REVIEW') return 'Pendiente de revisión';
  if (item.publication.status === 'APPROVED')
    return isEditorialScheduled(item) ? 'Programado editorialmente' : 'Aprobado · sin programar';
  return 'Borrador';
}
export function planEditorial(items: readonly EditorialItem[], goals: EditorialGoals, now: Date) {
  const today = dayKey(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00-05:00`);
    date.setUTCDate(date.getUTCDate() + index);
    return dayKey(date);
  });
  const active = items.filter((item) => item.publication.status !== 'CANCELLED');
  const scheduled = active.filter(
    (item) =>
      item.schedule?.status === 'APPROVED' && days.includes(dayKey(item.schedule.scheduledFor)),
  );
  const gaps = days.filter(
    (day) => !active.some((item) => item.schedule && dayKey(item.schedule.scheduledFor) === day),
  );
  const review = active.filter((item) => item.publication.status === 'IN_REVIEW');
  const unscheduled = active.filter((item) => !item.schedule);
  const distribution = editorialChannels.map((channel) => ({
    ...channel,
    count: scheduled.filter((item) => item.publication.channel === channel.id).length,
  }));
  const recommendations: string[] = [];
  if (review.length)
    recommendations.push(`Revisar ${review.length} contenido(s) antes de aprobar.`);
  if (unscheduled.length)
    recommendations.push(`Asignar fecha a ${unscheduled.length} contenido(s) sin programar.`);
  if (scheduled.length < goals.weekly)
    recommendations.push(
      `Proponer ${goals.weekly - scheduled.length} contenido(s) para alcanzar el objetivo de ${goals.weekly} en los próximos 7 días.`,
    );
  if (gaps.length)
    recommendations.push(
      `Distribuir contenido en los días libres: ${gaps.join(', ')}. Es una sugerencia editorial, no evidencia de mejor rendimiento.`,
    );
  if (
    goals.priorityChannel &&
    !scheduled.some((item) => item.publication.channel === goals.priorityChannel)
  )
    recommendations.push(
      `Considerar ${channelCapability(goals.priorityChannel).label} en la mezcla de canales.`,
    );
  if (goals.priorityProduct && !scheduled.some((item) => item.productId === goals.priorityProduct))
    recommendations.push('Preparar una propuesta para el producto prioritario seleccionado.');
  if (
    goals.priorityCampaign &&
    !scheduled.some((item) => item.campaignName === goals.priorityCampaign)
  )
    recommendations.push(`Considerar la campaña prioritaria: ${goals.priorityCampaign}.`);
  for (const day of days) {
    const count = active.filter(
      (item) => item.schedule && dayKey(item.schedule.scheduledFor) === day,
    ).length;
    if (count > Math.max(2, Math.ceil(goals.weekly / 7)))
      recommendations.push(
        `${day}: ${count} contenidos previstos; revisar la carga antes de agregar más.`,
      );
  }
  return {
    today,
    days,
    gaps,
    review,
    unscheduled,
    scheduled,
    distribution,
    recommendations,
    todayItems: active.filter(
      (item) => item.schedule && dayKey(item.schedule.scheduledFor) === today,
    ),
    overdue: active.filter(
      (item) =>
        item.schedule &&
        item.schedule.scheduledFor < now &&
        !item.attempts.some((attempt) => attempt.status === 'SUCCEEDED'),
    ),
  };
}

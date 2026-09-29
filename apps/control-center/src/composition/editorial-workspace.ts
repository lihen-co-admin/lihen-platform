import {
  InMemoryMarketingSocialRepository,
  ReviewPreparedPublicationHandler,
  ReviewContentScheduleHandler,
  type ContentSchedule,
  type PublicationAttempt,
  type PreparedPublication,
  type PreparedPublicationReviewDecision,
} from '@lihen/marketing';
import type { EditorialChannel, EditorialItem } from '../domain/editorial-planning';
import { getBrowserSupabaseClient } from '@lihen/database';
import { usesEditorialVideo } from './editorial-video-assets';

export async function syncEditorialDraftInDev(item: EditorialItem): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.VITE_EDITORIAL_DEV_SYNC_ENABLED !== 'true')
    throw new Error('Sincronización DEV deshabilitada.');
  await saveEditorialDraftToRuntime(item, getBrowserSupabaseClient(import.meta.env));
}

export interface EditorialDraft {
  copy: string;
  callToAction: string;
  hashtags: string;
  creativeAssetIds: string[];
  channels: EditorialChannel[];
  channelVariants?: Partial<Record<EditorialChannel, EditorialChannelDraft>>;
  productId: string;
  campaignName: string;
  date: string;
}

export interface EditorialChannelDraft {
  copy: string;
  callToAction: string;
  hashtags: string;
  creativeAssetIds: string[];
}

interface EditorialWorkspaceRows {
  readonly schedules: readonly {
    readonly id: string;
    readonly channel_variant_id: string;
    readonly scheduled_for: string;
    readonly timezone: string;
    readonly status: ContentSchedule['status'];
    readonly created_at: string;
    readonly updated_at: string;
  }[];
  readonly publications: readonly {
    readonly id: string;
    readonly campaign_id: string;
    readonly campaign_content_id: string;
    readonly channel_variant_id: string;
    readonly schedule_id: string | null;
    readonly channel: PreparedPublication['channel'];
    readonly copy: string;
    readonly cta: string | null;
    readonly hashtags: string[];
    readonly creative_asset_ids: string[];
    readonly status: PreparedPublication['status'];
    readonly prepared_at: string;
  }[];
  readonly attempts: readonly {
    readonly id: string;
    readonly prepared_publication_id: string;
    readonly attempt_number: number;
    readonly status: PublicationAttempt['status'];
    readonly started_at: string | null;
    readonly completed_at: string | null;
    readonly external_publication_ref: string | null;
    readonly failure_code: string | null;
    readonly provider_evidence?: readonly Readonly<Record<string, unknown>>[];
  }[];
}

interface EditorialEdgeClient {
  functions: {
    invoke<T>(
      name: string,
      options: { body: Readonly<Record<string, unknown>> },
    ): PromiseLike<{
      data: { data: T; externalPublication: boolean } | null;
      error: { message?: string } | null;
    }>;
  };
}

function toEditorialItems(rows: EditorialWorkspaceRows): EditorialItem[] {
  const schedules = new Map(
    rows.schedules.map((row) => [
      row.id,
      {
        id: row.id,
        channelVariantId: row.channel_variant_id,
        scheduledFor: new Date(row.scheduled_for),
        timezone: row.timezone,
        status: row.status,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      } satisfies ContentSchedule,
    ]),
  );
  const attempts = new Map<string, PublicationAttempt[]>();
  for (const row of rows.attempts) {
    const related = attempts.get(row.prepared_publication_id) ?? [];
    related.push({
      id: row.id,
      preparedPublicationId: row.prepared_publication_id,
      attemptNumber: row.attempt_number,
      status: row.status,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      externalPublicationRef: row.external_publication_ref,
      failureCode: row.failure_code,
      ...(row.provider_evidence ? { providerEvidence: row.provider_evidence } : {}),
    });
    attempts.set(row.prepared_publication_id, related);
  }
  return rows.publications.map((row) => {
    const publication: PreparedPublication = {
      id: row.id,
      campaignId: row.campaign_id,
      campaignContentId: row.campaign_content_id,
      channelVariantId: row.channel_variant_id,
      scheduleId: row.schedule_id,
      channel: row.channel,
      copy: row.copy,
      callToAction: row.cta ?? '',
      hashtags: row.hashtags ?? [],
      creativeAssetIds: row.creative_asset_ids ?? [],
      status: row.status,
      preparedAt: new Date(row.prepared_at),
    };
    const schedule = row.schedule_id ? (schedules.get(row.schedule_id) ?? null) : null;
    const relatedAttempts = attempts.get(row.id) ?? [];
    return {
      publication,
      schedule,
      // Product and campaign names are not part of the current durable
      // publication contract. Resolve product by authorized media references.
      productId: '',
      campaignName: '',
      attempts: relatedAttempts,
      history: [
        { at: publication.preparedAt.toISOString(), action: 'Leído desde persistencia DEV' },
      ],
    };
  });
}

export async function runtimeErrorMessage(error: { readonly message?: string }): Promise<string> {
  const context = (error as { readonly context?: { json?: () => Promise<unknown> } }).context;
  if (context?.json) {
    try {
      const body = await context.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string')
        return body.error;
    } catch {
      /* Use the client error below. */
    }
  }
  return error.message ?? 'No se confirmó la operación editorial en DEV.';
}

export async function readEditorialWorkspace(
  client: EditorialEdgeClient = getBrowserSupabaseClient(import.meta.env),
  preparedPublicationId?: string,
): Promise<EditorialItem[]> {
  const { data, error } = await client.functions.invoke<EditorialWorkspaceRows>(
    'marketing-social-runtime',
    {
      body: {
        action: 'READ_EDITORIAL_WORKSPACE',
        payload: preparedPublicationId ? { preparedPublicationId } : {},
      },
    },
  );
  if (error || !data || data.externalPublication !== false) {
    throw new Error(
      error
        ? await runtimeErrorMessage(error)
        : 'La lectura editorial compartida de DEV no está habilitada.',
    );
  }
  return toEditorialItems(data.data);
}
export function createEditorialDraft(
  input: EditorialDraft,
  now: Date,
  id: () => string,
): EditorialItem[] {
  if (!input.channels.length) throw new Error('Selecciona al menos un canal.');
  if (
    input.channels.some((channel) => !(input.channelVariants?.[channel]?.copy ?? input.copy).trim())
  )
    throw new Error('Escribe un copy para cada variante de canal seleccionada.');
  const campaignId = id();
  const campaignContentId = id();
  return input.channels.map((channel) => {
    const variant = input.channelVariants?.[channel] ?? input;
    const channelVariantId = id();
    const schedule: ContentSchedule | null = input.date
      ? {
          id: id(),
          channelVariantId,
          scheduledFor: parseEditorialDate(input.date),
          timezone: 'America/Bogota',
          status: 'DRAFT',
          createdAt: now,
          updatedAt: now,
        }
      : null;
    const publication: PreparedPublication = {
      id: id(),
      campaignId,
      campaignContentId,
      channelVariantId,
      scheduleId: schedule?.id ?? null,
      channel,
      copy: variant.copy.trim(),
      callToAction: variant.callToAction.trim(),
      hashtags: variant.hashtags
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, ''))
        .filter(Boolean),
      creativeAssetIds: [...variant.creativeAssetIds],
      status: 'PREPARED',
      preparedAt: now,
    };
    return {
      publication,
      schedule,
      productId: input.productId,
      campaignName: input.campaignName,
      attempts: [],
      history: [{ at: now.toISOString(), action: 'Borrador guardado' }],
    };
  });
}
export function parseEditorialDate(value: string): Date {
  const result = new Date(`${value}:00-05:00`);
  if (!Number.isFinite(result.getTime())) throw new Error('Fecha editorial inválida.');
  return result;
}
export async function reviewEditorial(
  item: EditorialItem,
  decision: PreparedPublicationReviewDecision,
  now: Date,
): Promise<EditorialItem> {
  const repository = new InMemoryMarketingSocialRepository();
  const context = { operationKey: `${item.publication.id}:${decision}:${now.toISOString()}` };
  await repository.savePreparedPublication(item.publication, context);
  const publication = await new ReviewPreparedPublicationHandler(repository).execute({
    preparedPublicationId: item.publication.id,
    decision,
    ...context,
  });
  // Approval and programming are distinct human decisions. An approved publication alone is not due for execution.
  let schedule = item.schedule;
  if (schedule && decision !== 'APPROVE') {
    await repository.saveContentSchedule(schedule, context);
    schedule = await new ReviewContentScheduleHandler(repository).execute({
      scheduleId: schedule.id,
      decision,
      ...context,
    });
  }
  return {
    ...item,
    publication,
    schedule,
    history: [...item.history, { at: now.toISOString(), action: decision }],
  };
}
export async function programEditorial(
  item: EditorialItem,
  date: string,
  now: Date,
  id: () => string,
): Promise<EditorialItem> {
  if (item.publication.status !== 'APPROVED')
    throw new Error('Aprueba el contenido antes de programar.');
  const scheduledFor = parseEditorialDate(date);
  if (scheduledFor <= now) throw new Error('Selecciona una fecha futura para programar.');
  const repository = new InMemoryMarketingSocialRepository();
  const context = { operationKey: id() };
  let schedule: ContentSchedule = item.schedule ?? {
    id: id(),
    channelVariantId: item.publication.channelVariantId,
    scheduledFor,
    timezone: 'America/Bogota',
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
  };
  if (schedule.status === 'APPROVED') throw new Error('Esta pieza ya está programada.');
  schedule = { ...schedule, scheduledFor, updatedAt: now };
  await repository.saveContentSchedule(schedule, context);
  const handler = new ReviewContentScheduleHandler(repository);
  if (schedule.status === 'DRAFT')
    await handler.execute({
      scheduleId: schedule.id,
      decision: 'SUBMIT_FOR_REVIEW',
      operationKey: `${context.operationKey}:review`,
    });
  schedule = await handler.execute({
    scheduleId: schedule.id,
    decision: 'APPROVE',
    operationKey: `${context.operationKey}:approve`,
  });
  return {
    ...item,
    schedule,
    publication: { ...item.publication, scheduleId: schedule.id },
    history: [
      ...item.history,
      { at: now.toISOString(), action: 'Programación editorial confirmada; sin ejecución' },
    ],
  };
}

// Local working copy of existing entities. This is explicitly not shared/server persistence.
export function readEditorialCache(
  storage: Pick<Storage, 'getItem'>,
  key: string,
): EditorialItem[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  const items = JSON.parse(raw) as EditorialItem[];
  if (!Array.isArray(items))
    throw new Error('No se pudo leer la copia local. No se ha sobrescrito.');
  return items.map((item) => ({
    ...item,
    publication: { ...item.publication, preparedAt: new Date(item.publication.preparedAt) },
    schedule: item.schedule
      ? {
          ...item.schedule,
          scheduledFor: new Date(item.schedule.scheduledFor),
          createdAt: new Date(item.schedule.createdAt),
          updatedAt: new Date(item.schedule.updatedAt),
        }
      : null,
    attempts: item.attempts.map((attempt) => ({
      ...attempt,
      startedAt: attempt.startedAt ? new Date(attempt.startedAt) : null,
      completedAt: attempt.completedAt ? new Date(attempt.completedAt) : null,
    })),
  }));
}

export interface EditorialRuntimeClient {
  functions: {
    invoke<T>(
      name: string,
      options: { body: { action: string; payload: Record<string, unknown> } },
    ): PromiseLike<{
      data: { data: T; externalPublication: boolean } | null;
      error: { message?: string } | null;
    }>;
  };
}

export async function saveEditorialItemToRuntime(
  item: EditorialItem,
  client: EditorialRuntimeClient,
): Promise<EditorialItem> {
  const invoke = async <T>(action: string, payload: Record<string, unknown>): Promise<T> => {
    const result = await client.functions.invoke<T>('marketing-social-runtime', {
      body: { action, payload },
    });
    if (result.error || !result.data?.data || result.data.externalPublication !== false) {
      throw new Error(
        result.error ? await runtimeErrorMessage(result.error) : `No se confirmó ${action} en DEV.`,
      );
    }
    return result.data.data;
  };
  if (item.schedule) {
    const schedule = item.schedule;
    await invoke('SAVE_CONTENT_SCHEDULE', {
      ...schedule,
      scheduledFor: schedule.scheduledFor.toISOString(),
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
      operationKey: `editorial:schedule:${schedule.id}:${schedule.updatedAt.toISOString()}:${schedule.status}`,
    });
  }
  const publication = item.publication;
  await invoke('SAVE_PREPARED_PUBLICATION', {
    ...publication,
    preparedAt: publication.preparedAt.toISOString(),
    operationKey: `editorial:publication:${publication.id}:${publication.preparedAt.toISOString()}:${publication.status}`,
  });
  return item;
}

export async function saveEditorialItemInDev(
  item: EditorialItem,
  client: EditorialRuntimeClient = getBrowserSupabaseClient(import.meta.env),
): Promise<EditorialItem> {
  if (!import.meta.env.DEV)
    throw new Error('La persistencia editorial solo está habilitada en DEV.');
  return saveEditorialItemToRuntime(item, client);
}
export async function saveEditorialDraftToRuntime(
  item: EditorialItem,
  client: EditorialRuntimeClient,
): Promise<void> {
  if (item.publication.status !== 'PREPARED' || (item.schedule && item.schedule.status !== 'DRAFT'))
    throw new Error('Solo se sincronizan borradores; la aprobación local no activa el servidor.');
  if (
    !['INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'INSTAGRAM_REEL', 'FACEBOOK', 'TIKTOK'].includes(
      item.publication.channel,
    )
  )
    throw new Error('Canal fuera del workspace social.');
  await saveEditorialItemToRuntime(item, client);
}

export async function resolveProductAssociationsFromMedia(
  items: readonly EditorialItem[],
  products: readonly { readonly id: string }[],
  readProductImages: (productId: string) => Promise<readonly { readonly id: string }[]>,
  readProductVideos: (
    productId: string,
  ) => Promise<readonly { readonly id: string }[]> = async () => [],
): Promise<EditorialItem[]> {
  const mediaIds = new Set(items.flatMap((item) => item.publication.creativeAssetIds));
  if (!mediaIds.size) return [...items];
  const resolved = new Map<string, string>();
  const videos = new Map<string, string>();
  const needsVideo = items.some((item) => usesEditorialVideo(item.publication.channel));
  const needsImages = items.some((item) => !usesEditorialVideo(item.publication.channel));
  for (let start = 0; start < products.length; start += 6) {
    const group = products.slice(start, start + 6);
    const results = await Promise.all(
      group.map(async (product) => ({
        productId: product.id,
        images: needsImages ? await readProductImages(product.id) : [],
        videos: needsVideo ? await readProductVideos(product.id) : [],
      })),
    );
    for (const result of results) {
      for (const video of result.videos) {
        if (mediaIds.has(video.id)) videos.set(video.id, result.productId);
      }
      for (const image of result.images) {
        if (mediaIds.has(image.id)) resolved.set(image.id, result.productId);
      }
    }
  }
  return items.map((item) => ({
    ...item,
    productId:
      (usesEditorialVideo(item.publication.channel) ? videos : resolved).get(
        item.publication.creativeAssetIds[0] ?? '',
      ) ?? '',
  }));
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PublicHubBlockDraft,
  PublicHubBlockProps,
  PublicHubBlockStatus,
  PublicHubBlockType,
} from '../domain/public-hub-block';
import type { PublicHubRepository } from '../ports/public-hub-repository';

type AdminHubBlockRow = {
  id: string;
  block_type: PublicHubBlockType;
  status: PublicHubBlockStatus;
  sort_order: number;
  product_id: string | null;
  collection_key: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  cta_label: string | null;
  target_url: string | null;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};


function toPublicHubPersistenceError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? error ?? '');
  if (message.includes('LIHEN_PUBLIC_HUB_PRODUCT_NOT_PUBLISHABLE')) {
    return new Error('Este producto todavía no está listo para publicarse en el Hub. Revisa su visibilidad web, precio y media WEB_CARD.');
  }
  if (message.includes('LIHEN_PUBLIC_HUB_WRITE_FORBIDDEN')) {
    return new Error('Tu perfil no tiene permisos para modificar el Hub público.');
  }
  if (message.includes('LIHEN_PUBLIC_HUB_BLOCK_NOT_FOUND')) {
    return new Error('El bloque ya no existe o fue actualizado fuera de esta vista.');
  }
  return error instanceof Error ? error : new Error(message || 'No fue posible completar la operación del Hub público.');
}

function mapRow(row: AdminHubBlockRow): PublicHubBlockProps {
  return {
    id: row.id,
    blockType: row.block_type,
    status: row.status,
    sortOrder: row.sort_order,
    productId: row.product_id,
    collectionKey: row.collection_key,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    ctaLabel: row.cta_label,
    targetUrl: row.target_url,
    imageUrl: row.image_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabasePublicHubRepository implements PublicHubRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly enabled: boolean,
  ) {}

  private assertEnabled(): void {
    if (!this.enabled) throw new Error('La administración del Hub público está bloqueada por configuración.');
  }

  async listAdminBlocks(): Promise<readonly PublicHubBlockProps[]> {
    this.assertEnabled();
    const { data, error } = await this.client.rpc('get_public_hub_blocks_admin_controlled');
    if (error) throw error;
    return ((data ?? []) as AdminHubBlockRow[]).map(mapRow);
  }

  async saveBlock(draft: PublicHubBlockDraft, operationKey: string): Promise<string> {
    this.assertEnabled();
    const { data, error } = await this.client.rpc('save_public_hub_block_controlled', {
      p_operation_key: operationKey,
      p_block_id: draft.id ?? null,
      p_block_type: draft.blockType,
      p_status: draft.status ?? 'DRAFT',
      p_sort_order: draft.sortOrder ?? null,
      p_product_id: draft.productId ?? null,
      p_collection_key: draft.collectionKey ?? null,
      p_title: draft.title ?? null,
      p_subtitle: draft.subtitle ?? null,
      p_body: draft.body ?? null,
      p_cta_label: draft.ctaLabel ?? null,
      p_target_url: draft.targetUrl ?? null,
      p_image_url: draft.imageUrl ?? null,
      p_starts_at: draft.startsAt ?? null,
      p_ends_at: draft.endsAt ?? null,
    });
    if (error) throw toPublicHubPersistenceError(error);
    if (typeof data !== 'string') throw new Error('El Hub no devolvió el identificador del bloque.');
    return data;
  }

  async setStatus(id: string, status: PublicHubBlockStatus, operationKey: string): Promise<void> {
    this.assertEnabled();
    const { error } = await this.client.rpc('set_public_hub_block_status_controlled', {
      p_operation_key: operationKey,
      p_block_id: id,
      p_status: status,
    });
    if (error) throw toPublicHubPersistenceError(error);
  }

  async reorder(ids: readonly string[], operationKey: string): Promise<void> {
    this.assertEnabled();
    const { error } = await this.client.rpc('reorder_public_hub_blocks_controlled', {
      p_operation_key: operationKey,
      p_ordered_ids: [...ids],
    });
    if (error) throw toPublicHubPersistenceError(error);
  }
}

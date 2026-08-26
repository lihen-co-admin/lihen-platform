import { useEffect, useMemo, useState } from 'react';
import { createGetProductsQuery, type ProductListItemDTO } from '@lihen/products';
import {
  getPublicHubBlockPublicationState,
  publicHubBlockTypes,
  type PublicHubBlockDraft,
  type PublicHubBlockProps,
  type PublicHubBlockStatus,
  type PublicHubBlockType,
} from '@lihen/public-hub';
import { PageHeader } from '../components/PageHeader';
import { publicHubComposition } from '../composition/public-hub';
import { productsComposition } from '../composition/products';

const typeLabels: Record<PublicHubBlockType, string> = {
  LINK: 'Enlace',
  SOCIAL: 'Red social',
  PRODUCT: 'Producto',
  PRODUCT_COLLECTION: 'Colección',
  BANNER: 'Banner',
  TEXT: 'Texto',
  HEADING: 'Encabezado',
  CTA: 'CTA',
};

const statusLabels: Record<PublicHubBlockStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  HIDDEN: 'Oculto',
  ARCHIVED: 'Archivado',
};

const emptyDraft: PublicHubBlockDraft = {
  blockType: 'LINK',
  status: 'DRAFT',
  title: '',
  targetUrl: '',
};

const operationKey = (kind: string) => `public-hub:${kind}:${crypto.randomUUID()}`;

type HubFilter = 'ACTIVE' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED' | 'ALL';

const publicationStateLabels = {
  DRAFT: 'Borrador',
  HIDDEN: 'Oculto',
  ARCHIVED: 'Archivado',
  SCHEDULED: 'Programado',
  LIVE: 'Publicado ahora',
  EXPIRED: 'Finalizado',
} as const;

function effectiveStatus(block: Pick<PublicHubBlockProps, 'status' | 'startsAt' | 'endsAt'>): string {
  return publicationStateLabels[getPublicHubBlockPublicationState(block, new Date())];
}

function formatSchedule(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function blockMatchesFilter(block: PublicHubBlockProps, filter: HubFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ARCHIVED') return block.status === 'ARCHIVED';
  if (filter === 'PUBLISHED') return block.status === 'PUBLISHED' && effectiveStatus(block) === 'Publicado ahora';
  if (filter === 'SCHEDULED') return block.status === 'PUBLISHED' && effectiveStatus(block) === 'Programado';
  return block.status !== 'ARCHIVED';
}

function draftPreviewTitle(draft: PublicHubBlockDraft, products: readonly ProductListItemDTO[]): string {
  if (draft.title?.trim()) return draft.title.trim();
  if (draft.blockType === 'PRODUCT' && draft.productId) {
    return products.find((product) => product.id === draft.productId)?.name ?? 'Producto seleccionado';
  }
  return typeLabels[draft.blockType];
}

export function PublicHubPage() {
  const [blocks, setBlocks] = useState<readonly PublicHubBlockProps[]>([]);
  const [products, setProducts] = useState<readonly ProductListItemDTO[]>([]);
  const [draft, setDraft] = useState<PublicHubBlockDraft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<HubFilter>('ACTIVE');
  const [productQuery, setProductQuery] = useState('');

  const activeBlocks = useMemo(() => blocks.filter((block) => block.status !== 'ARCHIVED'), [blocks]);
  const visibleBlocks = useMemo(() => blocks.filter((block) => blockMatchesFilter(block, filter)), [blocks, filter]);
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase('es');
    if (!query) return products.slice(0, 80);
    return products
      .filter((product) => `${product.sku ?? ''} ${product.name} ${product.brandName ?? ''}`.toLocaleLowerCase('es').includes(query))
      .slice(0, 80);
  }, [productQuery, products]);

  const counts = useMemo(
    () => ({
      active: blocks.filter((block) => block.status !== 'ARCHIVED').length,
      published: blocks.filter((block) => effectiveStatus(block) === 'Publicado ahora').length,
      scheduled: blocks.filter((block) => effectiveStatus(block) === 'Programado').length,
      archived: blocks.filter((block) => block.status === 'ARCHIVED').length,
    }),
    [blocks],
  );

  async function load() {
    if (!publicHubComposition.enabled) return;
    try {
      const [hubBlocks, productList] = await Promise.all([
        publicHubComposition.getBlocks.execute(),
        productsComposition.getProducts.execute(createGetProductsQuery()),
      ]);
      setBlocks(hubBlocks);
      setProducts(productList.filter((product) => product.status === 'ACTIVE'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el Hub.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetEditor() {
    setEditing(null);
    setDraft(emptyDraft);
    setProductQuery('');
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload: PublicHubBlockDraft = editing ? { ...draft, id: editing } : draft;
      await publicHubComposition.saveBlock.execute(payload, operationKey(editing ? 'update' : 'create'));
      setNotice(editing ? 'Bloque actualizado.' : 'Bloque agregado al Hub.');
      resetEditor();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: PublicHubBlockStatus) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await publicHubComposition.setStatus.execute(id, status, operationKey('status'));
      setNotice(`Estado actualizado a ${statusLabels[status].toLocaleLowerCase('es')}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar.');
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= activeBlocks.length) return;
    const ids = activeBlocks.map((block) => block.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await publicHubComposition.reorder.execute(ids, operationKey('reorder'));
      setNotice('Orden actualizado.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible ordenar.');
    } finally {
      setBusy(false);
    }
  }

  function editBlock(block: PublicHubBlockProps) {
    setEditing(block.id);
    setDraft({ ...block, id: block.id });
    setProductQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!publicHubComposition.enabled) {
    return (
      <section>
        <PageHeader title="Hub público" description="Capability preparada y bloqueada por configuración." />
        <div className="warning-state">Activa <code>VITE_PUBLIC_HUB_MODE=controlled</code> en DEV.</div>
      </section>
    );
  }

  const previewTitle = draftPreviewTitle(draft, products);
  const previewStatus = effectiveStatus({
    status: draft.status ?? 'DRAFT',
    startsAt: draft.startsAt ?? null,
    endsAt: draft.endsAt ?? null,
  });

  return (
    <section className="public-hub-admin">
      <PageHeader
        title="Hub público"
        description="Administra el enlace central de LIHEN. Los productos se resuelven desde Product Master."
      />

      <div className="hub-admin-toolbar" aria-label="Resumen del Hub público">
        <div><strong>{counts.active}</strong><span>Activos</span></div>
        <div><strong>{counts.published}</strong><span>Publicados ahora</span></div>
        <div><strong>{counts.scheduled}</strong><span>Programados</span></div>
        <div><strong>{counts.archived}</strong><span>Archivados</span></div>
        <a className="hub-preview-link" href="/#descubre" target="_blank" rel="noreferrer">Abrir Hub público ↗</a>
      </div>

      {error ? <div className="error-state" role="alert">{error}</div> : null}
      {notice ? <div className="success-state" role="status">{notice}</div> : null}

      <div className="hub-admin-grid">
        <form className="panel-card hub-editor" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="hub-editor-heading">
            <div>
              <p className="hub-eyebrow">Edición</p>
              <h2>{editing ? 'Editar bloque' : 'Agregar bloque'}</h2>
            </div>
            {editing ? <button type="button" className="secondary-button" onClick={resetEditor}>Cancelar</button> : null}
          </div>

          <label>Tipo
            <select value={draft.blockType} onChange={(event) => setDraft({ ...draft, blockType: event.target.value as PublicHubBlockType })}>
              {publicHubBlockTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
            </select>
          </label>

          <label>Estado
            <select value={draft.status ?? 'DRAFT'} onChange={(event) => setDraft({ ...draft, status: event.target.value as PublicHubBlockStatus })}>
              {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <small className="field-help">Usa Borrador mientras preparas el contenido. Publicado respeta automáticamente las fechas programadas.</small>
          </label>

          {draft.blockType === 'PRODUCT' ? (
            <fieldset className="hub-product-picker">
              <legend>Producto canónico</legend>
              <label>Buscar producto
                <input
                  type="search"
                  value={productQuery}
                  placeholder="Nombre, marca o SKU"
                  onChange={(event) => setProductQuery(event.target.value)}
                />
              </label>
              <label>Seleccionar
                <select value={draft.productId ?? ''} onChange={(event) => setDraft({ ...draft, productId: event.target.value || null })}>
                  <option value="">Seleccionar…</option>
                  {filteredProducts.map((product) => (
                    <option key={product.id} value={product.id}>{product.sku ?? '—'} · {product.name}{product.brandName ? ` · ${product.brandName}` : ''}</option>
                  ))}
                </select>
              </label>
              <small className="field-help">Nombre, precio, marca e imagen pública se leen desde Product Master; aquí no se duplican.</small>
            </fieldset>
          ) : null}

          {draft.blockType === 'PRODUCT_COLLECTION' ? (
            <label>Colección
              <select value={draft.collectionKey ?? ''} onChange={(event) => setDraft({ ...draft, collectionKey: event.target.value || null })}>
                <option value="">Seleccionar…</option>
                <option value="CARE">Cuidado</option>
              </select>
              <small className="field-help">Solo se ofrecen colecciones que el Storefront sabe resolver actualmente.</small>
            </label>
          ) : null}

          <label>Título
            <input value={draft.title ?? ''} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label>Subtítulo
            <input value={draft.subtitle ?? ''} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} />
          </label>

          {draft.blockType === 'TEXT' ? (
            <label>Contenido
              <textarea rows={4} value={draft.body ?? ''} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
            </label>
          ) : null}

          {['LINK', 'SOCIAL', 'CTA', 'BANNER'].includes(draft.blockType) ? (
            <label>Destino URL
              <input type="url" value={draft.targetUrl ?? ''} onChange={(event) => setDraft({ ...draft, targetUrl: event.target.value })} placeholder="https://…" />
            </label>
          ) : null}

          <label>Texto del botón
            <input value={draft.ctaLabel ?? ''} onChange={(event) => setDraft({ ...draft, ctaLabel: event.target.value })} placeholder="Ej. Ver producto" />
          </label>

          {draft.blockType === 'BANNER' ? (
            <label>Imagen URL
              <input type="url" value={draft.imageUrl ?? ''} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="https://…" />
              <small className="field-help">En este corte se referencia una URL. No se crea un bucket nuevo ni se duplica media de producto.</small>
            </label>
          ) : null}

          <fieldset className="hub-schedule-card">
            <legend>Programación opcional</legend>
            <div className="hub-schedule">
              <label>Visible desde
                <input type="datetime-local" value={draft.startsAt?.slice(0, 16) ?? ''} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} />
              </label>
              <label>Visible hasta
                <input type="datetime-local" value={draft.endsAt?.slice(0, 16) ?? ''} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} />
              </label>
            </div>
          </fieldset>

          <aside className="hub-editor-preview" aria-label="Vista previa resumida del bloque">
            <span className="hub-type">{typeLabels[draft.blockType]}</span>
            <strong>{previewTitle}</strong>
            {draft.subtitle ? <span>{draft.subtitle}</span> : null}
            <small>{previewStatus}</small>
          </aside>

          <div className="form-actions">
            <button disabled={busy}>{editing ? 'Guardar cambios' : 'Agregar bloque'}</button>
          </div>
        </form>

        <div className="panel-card hub-admin-list-panel">
          <div className="hub-list-heading">
            <div>
              <p className="hub-eyebrow">Publicación</p>
              <h2>Bloques</h2>
            </div>
          </div>

          <div className="hub-filter-tabs" role="group" aria-label="Filtrar bloques">
            {([
              ['ACTIVE', `Activos (${counts.active})`],
              ['PUBLISHED', `En vivo (${counts.published})`],
              ['SCHEDULED', `Programados (${counts.scheduled})`],
              ['ARCHIVED', `Archivados (${counts.archived})`],
              ['ALL', `Todos (${blocks.length})`],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'is-selected' : ''}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >{label}</button>
            ))}
          </div>

          {visibleBlocks.length === 0 ? (
            <div className="empty-state">No hay bloques en esta vista.</div>
          ) : (
            <div className="hub-block-list">
              {visibleBlocks.map((block) => {
                const activeIndex = activeBlocks.findIndex((candidate) => candidate.id === block.id);
                const liveStatus = effectiveStatus(block);
                return (
                  <article key={block.id} className={`hub-admin-block hub-admin-block--${block.status.toLowerCase()}`}>
                    <div className="hub-admin-block__content">
                      <div className="hub-admin-block__meta">
                        <span className="hub-type">{typeLabels[block.blockType]}</span>
                        <span className={`hub-effective-status hub-effective-status--${liveStatus.toLocaleLowerCase('es').replaceAll(' ', '-')}`}>{liveStatus}</span>
                      </div>
                      <strong>{block.title || block.productId || block.collectionKey || 'Sin título'}</strong>
                      {block.subtitle ? <span>{block.subtitle}</span> : null}
                      <small>
                        Orden {block.sortOrder}
                        {block.startsAt ? ` · desde ${formatSchedule(block.startsAt)}` : ''}
                        {block.endsAt ? ` · hasta ${formatSchedule(block.endsAt)}` : ''}
                      </small>
                    </div>

                    <div className="hub-block-actions" aria-label={`Acciones para ${block.title || typeLabels[block.blockType]}`}>
                      <button type="button" onClick={() => editBlock(block)}>Editar</button>
                      {block.status === 'ARCHIVED' ? (
                        <button type="button" disabled={busy} onClick={() => void setStatus(block.id, 'DRAFT')}>Reactivar como borrador</button>
                      ) : (
                        <>
                          <button type="button" aria-label="Mover arriba" disabled={busy || activeIndex <= 0} onClick={() => void move(activeIndex, -1)}>↑</button>
                          <button type="button" aria-label="Mover abajo" disabled={busy || activeIndex < 0 || activeIndex >= activeBlocks.length - 1} onClick={() => void move(activeIndex, 1)}>↓</button>
                          {block.status !== 'PUBLISHED' ? (
                            <button type="button" disabled={busy} onClick={() => void setStatus(block.id, 'PUBLISHED')}>Publicar</button>
                          ) : (
                            <button type="button" disabled={busy} onClick={() => void setStatus(block.id, 'HIDDEN')}>Ocultar</button>
                          )}
                          <button type="button" disabled={busy} onClick={() => void setStatus(block.id, 'ARCHIVED')}>Archivar</button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

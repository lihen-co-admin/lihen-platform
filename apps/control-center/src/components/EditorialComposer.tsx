import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { EditorialProductSelector } from './EditorialProductSelector';
import { EditorialSuggestion, useEditorialSuggestions } from './EditorialSuggestions';
import type { ProductImageDTO, ProductListItemDTO } from '@lihen/products';
import type { InventoryBalance } from '@lihen/inventory';
import { productsComposition } from '../composition/products';
import { inventoryComposition } from '../composition/inventory';
import {
  readEditorialVideoAssets,
  usesEditorialVideo,
  type EditorialVideoAsset,
} from '../composition/editorial-video-assets';
import type { EditorialChannelDraft, EditorialDraft } from '../composition/editorial-workspace';
import { editorialChannels, type EditorialItem } from '../domain/editorial-planning';

export function EditorialComposer({
  item,
  products,
  busy,
  onSave,
  onClose,
  readVideos = readEditorialVideoAssets,
}: {
  item: EditorialItem | null;
  products: readonly ProductListItemDTO[];
  busy: boolean;
  onSave: (draft: EditorialDraft) => void;
  onClose: () => void;
  readVideos?: typeof readEditorialVideoAssets;
}) {
  const composerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    composerRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, []);
  const [draft, setDraft] = useState<EditorialDraft>(() => ({
    copy: item?.publication.copy ?? '',
    callToAction: item?.publication.callToAction ?? '',
    hashtags: item?.publication.hashtags.join(' ') ?? '',
    creativeAssetIds: [...(item?.publication.creativeAssetIds ?? [])],
    channels: item
      ? [item.publication.channel as EditorialDraft['channels'][number]]
      : ['INSTAGRAM_FEED'],
    productId: item?.productId ?? '',
    campaignName: item?.campaignName ?? '',
    date: item?.schedule
      ? new Date(item.schedule.scheduledFor.getTime() - 5 * 3600000).toISOString().slice(0, 16)
      : '',
    channelVariants: item
      ? {
          [item.publication.channel as EditorialDraft['channels'][number]]: {
            copy: item.publication.copy,
            callToAction: item.publication.callToAction,
            hashtags: item.publication.hashtags.map((tag) => `#${tag}`).join(' '),
            creativeAssetIds: [...item.publication.creativeAssetIds],
          },
        }
      : {},
  }));
  const [variantChannel, setVariantChannel] = useState<EditorialDraft['channels'][number]>(
    (item?.publication.channel as EditorialDraft['channels'][number]) ?? 'INSTAGRAM_FEED',
  );
  const [images, setImages] = useState<readonly ProductImageDTO[]>([]);
  const [videos, setVideos] = useState<readonly EditorialVideoAsset[]>([]);
  const [videoNotice, setVideoNotice] = useState('');
  const videoChannel = usesEditorialVideo(variantChannel);
  useEffect(() => {
    let active = true;
    if (!videoChannel || !draft.productId) return;
    readVideos(draft.productId)
      .then((assets) => {
        if (active) {
          setVideos(assets);
          setVideoNotice('');
        }
      })
      .catch(() => {
        if (active) {
          setVideos([]);
          setVideoNotice('Videos autorizados no disponibles.');
        }
      });
    return () => {
      active = false;
    };
  }, [draft.productId, videoChannel, readVideos]);
  const [balances, setBalances] = useState<readonly InventoryBalance[]>([]);
  const [mediaNotice, setMediaNotice] = useState('');
  useEffect(() => {
    let active = true;
    inventoryComposition.getInventory.execute().then(
      (stock) => {
        if (active) setBalances(stock);
      },
      () => {
        if (active) setBalances([]);
      },
    );
    return () => {
      active = false;
    };
  }, [draft.productId]);
  useEffect(() => {
    let active = true;
    if (!draft.productId) return;
    Promise.allSettled([
      productsComposition.canReadImages
        ? productsComposition.getProductImages.execute({ productId: draft.productId })
        : Promise.reject(new Error('Lectura de imágenes no habilitada.')),
    ]).then(([media]) => {
      if (!active) return;
      setImages(media.status === 'fulfilled' ? media.value : []);
      setMediaNotice(
        media.status === 'rejected' ? 'Imágenes no disponibles desde la fuente configurada.' : '',
      );
    });
    return () => {
      active = false;
    };
  }, [draft.productId]);
  const product = products.find((entry) => entry.id === draft.productId);
  const suggestions = useEditorialSuggestions({ product, draft, channel: variantChannel });
  const balance = balances.find((entry) => entry.productId === draft.productId);
  const activeVariant = draft.channelVariants?.[variantChannel] ?? {
    copy: draft.copy,
    callToAction: draft.callToAction,
    hashtags: draft.hashtags,
    creativeAssetIds: draft.creativeAssetIds,
  };
  function updateVariant(update: Partial<EditorialChannelDraft>) {
    setDraft((current) => ({
      ...current,
      channelVariants: {
        ...current.channelVariants,
        [variantChannel]: {
          ...(current.channelVariants?.[variantChannel] ?? activeVariant),
          ...update,
        },
      },
    }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(draft);
  }
  return (
    <section
      ref={composerRef}
      className="card stack editorial-composer"
      id="editorial-composer"
      aria-labelledby="compose-title"
    >
      <h2 id="compose-title">{item ? 'Editar borrador' : 'Crear contenido'}</h2>
      <p>
        Prepara una variante por canal. Guardar crea un borrador; después debes revisar, aprobar y
        confirmar su programación.
      </p>
      <form className="stack" onSubmit={submit}>
        <div className="editorial-intelligence">
          <button
            type="button"
            disabled={suggestions.disabled || busy}
            onClick={() => void suggestions.generate('all')}
          >
            ✨ Sugerir contenido con LIHEN Intelligence
          </button>
          <p>
            Intelligence propone; tú decides. Una sugerencia no es contenido oficial ni aprueba,
            programa o publica. Revisa los datos antes de usarla.
          </p>
          {!product && <small>Selecciona un producto para recibir recomendaciones.</small>}
          {suggestions.notice && (
            <p role="status" aria-live="polite">
              {suggestions.notice}
            </p>
          )}
        </div>
        <div className="editorial-fields">
          <EditorialProductSelector
            products={products}
            balances={balances}
            value={draft.productId}
            onChange={(productId) => {
              if (productId === draft.productId) return;
              setImages([]);
              setVideos([]);
              setDraft({
                ...draft,
                productId,
                creativeAssetIds: [],
                channelVariants: Object.fromEntries(
                  Object.entries(draft.channelVariants ?? {}).map(([channel, variant]) => [
                    channel,
                    { ...variant, creativeAssetIds: [] },
                  ]),
                ),
              });
            }}
          />
          <div>
            <label>
              Campaña editorial
              <input
                value={draft.campaignName}
                onChange={(event) => setDraft({ ...draft, campaignName: event.target.value })}
                placeholder="Ej. Cuidado de la piel"
              />
            </label>
            <EditorialSuggestion
              field="campaignName"
              label="campaña"
              currentValue={draft.campaignName}
              suggestions={suggestions}
              onUse={(campaignName) => setDraft((current) => ({ ...current, campaignName }))}
            />
          </div>
          <label>
            Fecha propuesta · America/Bogota (opcional)
            <input
              type="datetime-local"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
          </label>
        </div>
        {product && (
          <div className="info-state">
            <strong>{product.name}</strong>
            <p>
              {product.categoryName ?? 'Sin categoría'} · {product.status} ·{' '}
              {new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: product.salePrice.currency,
              }).format(product.salePrice.amount)}
            </p>
            <p>
              {balance
                ? `Inventario disponible: ${balance.stockAvailable}`
                : 'Inventario no disponible; no se presume stock.'}
            </p>
            {balance?.stockAvailable === 0 && (
              <p role="alert">
                Sin inventario disponible. Puedes guardar el borrador editorial; revisa las
                existencias antes de promocionar.
              </p>
            )}
            <Link to={`/products/${product.id}`}>Abrir producto</Link> ·{' '}
            <Link to="/inventory">Inventario</Link>
          </div>
        )}
        <p>
          Editando {editorialChannels.find((channel) => channel.id === variantChannel)?.label}:
          copy, CTA, hashtags y media independientes. Usa las pestañas para revisar cada canal.
        </p>
        <label>
          Copy / caption ·{' '}
          {editorialChannels.find((channel) => channel.id === variantChannel)?.label}
          <textarea
            required
            rows={5}
            value={activeVariant.copy}
            onChange={(event) => updateVariant({ copy: event.target.value })}
            placeholder="Cuenta qué hace especial a esta propuesta…"
          />
        </label>
        <EditorialSuggestion
          field="copy"
          label="copy"
          currentValue={activeVariant.copy}
          suggestions={suggestions}
          onUse={(copy) => updateVariant({ copy })}
        />
        <div className="editorial-fields">
          <div>
            <label>
              CTA
              <input
                value={activeVariant.callToAction}
                onChange={(event) => updateVariant({ callToAction: event.target.value })}
                placeholder="Conoce más en LIHEN.CO"
              />
            </label>
            <EditorialSuggestion
              field="callToAction"
              label="CTA"
              currentValue={activeVariant.callToAction}
              suggestions={suggestions}
              onUse={(callToAction) => updateVariant({ callToAction })}
            />
          </div>
          <div>
            <label>
              Hashtags
              <input
                value={activeVariant.hashtags}
                onChange={(event) => updateVariant({ hashtags: event.target.value })}
                placeholder="#LIHENCO #BeautyCare"
              />
            </label>
            <EditorialSuggestion
              field="hashtags"
              label="hashtags"
              currentValue={activeVariant.hashtags}
              suggestions={suggestions}
              onUse={(hashtags) => updateVariant({ hashtags })}
            />
          </div>
        </div>
        <fieldset>
          <legend>Canales · una pieza editable por canal</legend>
          <div className="editorial-channel-grid">
            {editorialChannels.map((channel) => (
              <label className="editorial-checkbox" key={channel.id}>
                <input
                  type="checkbox"
                  checked={draft.channels.includes(channel.id)}
                  disabled={Boolean(item)}
                  onChange={(event) => {
                    if (event.target.checked) {
                      const starter = activeVariant;
                      setDraft({
                        ...draft,
                        channels: [...draft.channels, channel.id],
                        channelVariants: {
                          ...draft.channelVariants,
                          [channel.id]: {
                            copy: '',
                            callToAction: '',
                            hashtags: '',
                            creativeAssetIds:
                              usesEditorialVideo(channel.id) === videoChannel
                                ? [...starter.creativeAssetIds]
                                : [],
                          },
                        },
                      });
                      setVariantChannel(channel.id);
                    } else {
                      const remaining = draft.channels.filter((id) => id !== channel.id);
                      const channelVariants = { ...draft.channelVariants };
                      delete channelVariants[channel.id];
                      setDraft({ ...draft, channels: remaining, channelVariants });
                      if (variantChannel === channel.id && remaining[0])
                        setVariantChannel(remaining[0]);
                    }
                  }}
                />
                {channel.label}
              </label>
            ))}
          </div>
          {draft.channels.length > 0 && (
            <div className="editorial-variant-tabs" aria-label="Editar variante por canal">
              {draft.channels.map((channelId) => {
                const channel = editorialChannels.find((entry) => entry.id === channelId);
                return (
                  <button
                    type="button"
                    key={channelId}
                    aria-pressed={variantChannel === channelId}
                    className={variantChannel === channelId ? 'is-selected' : ''}
                    onClick={() => setVariantChannel(channelId)}
                  >
                    {channel?.label ?? channelId}
                  </button>
                );
              })}
            </div>
          )}
          <p>
            WhatsApp se prepara en <Link to="/conversations">Conversation</Link>; SEND bloqueado.
          </p>
        </fieldset>
        <fieldset>
          <legend>Media del producto</legend>
          <p>
            Selecciona media durable autorizada para este producto. Reel y TikTok requieren un
            video. La selección no autoriza publicación. Este editor no carga archivos.
          </p>
          {videoChannel ? (
            <>
              {videoNotice && <p>{videoNotice}</p>}
              <label>
                Video autorizado
                <select
                  value={activeVariant.creativeAssetIds[0] ?? ''}
                  onChange={(event) =>
                    updateVariant({
                      creativeAssetIds: event.target.value ? [event.target.value] : [],
                    })
                  }
                >
                  <option value="">Selecciona un video</option>
                  {videos.map((video) => (
                    <option key={video.id} value={video.id}>
                      {video.id} · {video.mimeType}
                    </option>
                  ))}
                </select>
              </label>
              {!videos.length && (
                <p>Sin videos autorizados disponibles; puedes guardar el borrador.</p>
              )}
            </>
          ) : (
            <>
              {mediaNotice && <p>{mediaNotice}</p>}
              <div className="editorial-media">
                {images.map((image) => (
                  <label key={image.id}>
                    <img src={image.publicUrl} alt={image.altText ?? 'Imagen del producto'} />
                    <input
                      type="checkbox"
                      checked={activeVariant.creativeAssetIds.includes(image.id)}
                      onChange={(event) =>
                        updateVariant({
                          creativeAssetIds: event.target.checked
                            ? [...activeVariant.creativeAssetIds, image.id]
                            : activeVariant.creativeAssetIds.filter((id) => id !== image.id),
                        })
                      }
                    />
                    Usar imagen
                  </label>
                ))}
              </div>
              {!images.length && (
                <p>
                  Sin imágenes disponibles. Puedes guardar el borrador y completar la media después.
                </p>
              )}
            </>
          )}
        </fieldset>
        <div className="toolbar">
          <button type="submit" disabled={busy || !draft.channels.length}>
            Guardar borrador
          </button>
          <button type="button" className="button-ghost" disabled={busy} onClick={onClose}>
            Cerrar editor
          </button>
        </div>
      </form>
    </section>
  );
}

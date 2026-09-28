import {
  channelCapability,
  editorialStatus,
  type EditorialItem,
} from '../domain/editorial-planning';

export function relatedEditorialVariants(
  items: readonly EditorialItem[],
  current: EditorialItem,
): EditorialItem[] {
  const { campaignId, campaignContentId } = current.publication;
  if (!campaignId || !campaignContentId) return [current];
  return items.filter(
    ({ publication }) =>
      publication.campaignId === campaignId && publication.campaignContentId === campaignContentId,
  );
}

export function EditorialVariantComparison({
  items,
  current,
  onOpen,
}: {
  items: readonly EditorialItem[];
  current: EditorialItem;
  onOpen: (id: string) => void;
}) {
  const variants = relatedEditorialVariants(items, current);
  return (
    <section className="stack" aria-label="Comparación de variantes por canal">
      <h3>Variantes del mismo contenido · {variants.length}</h3>
      <p>
        Cada variante conserva su propia revisión y fecha. Abrir una variante no cambia su estado.
      </p>
      {variants.length === 1 && (
        <p>No hay otras variantes de este contenido en la biblioteca leída.</p>
      )}
      <div className="editorial-library">
        {variants.map((item) => (
          <article className="card stack" key={item.publication.id}>
            <h4>{channelCapability(item.publication.channel).label}</h4>
            <span className="editorial-chip">{editorialStatus(item)}</span>
            <p className="editorial-copy">{item.publication.copy}</p>
            <p>CTA: {item.publication.callToAction || 'Sin CTA'}</p>
            <p>{item.publication.hashtags.map((tag) => `#${tag}`).join(' ') || 'Sin hashtags'}</p>
            <p>Media: {item.publication.creativeAssetIds.length} referencia(s).</p>
            <p>
              {item.schedule
                ? `${item.schedule.scheduledFor.toLocaleString('es-CO', {
                    timeZone: 'America/Bogota',
                  })} · America/Bogota`
                : 'Sin fecha'}
            </p>
            <button
              type="button"
              className="button-ghost"
              aria-current={item.publication.id === current.publication.id ? 'true' : undefined}
              onClick={() => onOpen(item.publication.id)}
            >
              {item.publication.id === current.publication.id
                ? 'Variante actual'
                : 'Abrir variante'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

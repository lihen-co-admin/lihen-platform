import { getStorefrontProducts } from './storefront-api';
import { availabilityLabel, escapeHtml, money, type StorefrontProduct } from './storefront-product';
import { legacyMedia, mediaAttributes, type StorefrontMedia } from './storefront-media';
import { isSelected, subscribeSelection, toggleSelection, type SelectedProduct } from './selection-store';
import { buildProductWhatsAppUrl } from './whatsapp';
import { carouselArrowIcon } from './carousel-navigation';
import { getStorefrontProductEnrichment, type StorefrontProductEnrichment } from './product-enrichment';
import { renderProductCard } from './product-card';
import { bindProductInteractions } from './product-interactions';

function selectedFromProduct(product: StorefrontProduct): SelectedProduct {
  return {
    productId: product.product_id,
    sku: product.sku,
    name: product.product_name,
    brand: product.brand,
    price: product.sale_price,
    imageUrl: product.main_image_url,
    quantity: 1,
  };
}

function galleryFor(product: StorefrontProduct): StorefrontMedia[] {
  const fallback = product.card_media ?? legacyMedia(product.main_image_url);
  const limit = product.business_line === 'STYLE' ? 10 : 5;
  const source = product.gallery_media.length > 0
    ? product.gallery_media
    : product.detail_media
      ? [product.detail_media]
      : [fallback];

  return source
    .filter((media, index, all) => all.findIndex((candidate) => candidate.url === media.url) === index)
    .slice(0, limit);
}

async function findProduct(ref: string): Promise<StorefrontProduct | null> {
  const normalized = decodeURIComponent(ref).trim();
  for (let offset = 0; offset < 1200; offset += 100) {
    const page = await getStorefrontProducts({ limit: 100, offset });
    const found = page.items.find((product) =>
      product.product_id === normalized ||
      product.slug === normalized ||
      product.sku === normalized
    );
    if (found) return found;
    if (!page.hasMore) break;
  }
  return null;
}

function pendingItems(product: StorefrontProduct): string[] {
  return product.business_line === 'STYLE'
    ? ['Material y composición.', 'Talla, ajuste y medidas.', 'Colores o variantes verificadas.', 'Cuidados de la prenda.']
    : ['Beneficios y atributos comerciales.', 'Presentación o contenido de la referencia.', 'Uso, cuidados o recomendaciones.'];
}

function renderPage(product: StorefrontProduct, enrichment: StorefrontProductEnrichment, related: StorefrontProduct[]): string {
  const images = galleryFor(product);
  const hero = images[0];
  const lineLabel = product.business_line === 'STYLE' ? 'Style' : 'Beauty Care';
  const selectable = product.availability === 'AVAILABLE' || product.availability === 'LOW_STOCK';
  const selected = selectable && isSelected(product.product_id);
  const detailCount = images.filter((media) => media.profile === 'WEB_DETAIL').length;
  const galleryLabel = detailCount > 0
    ? `${detailCount} ${detailCount === 1 ? 'imagen verificada' : 'imágenes verificadas'}`
    : 'Vista de catálogo';
  const verifiedDescription = enrichment.summary ?? product.description?.trim() ?? null;
  const hasIntelligence = enrichment.evidenceCount > 0;
  const heroIsDetail = hero.profile === 'WEB_DETAIL';
  const relatedHref = product.brand
    ? `#catalogo?business_line=${encodeURIComponent(product.business_line)}&brand=${encodeURIComponent(product.brand)}`
    : `#catalogo?business_line=${encodeURIComponent(product.business_line)}`;

  return `
    <div class="product-page" data-product-page="${product.product_id}">
      <section class="product-page__hero">
        <div class="product-page__gallery">
          <div class="product-page__gallery-head">
            <a class="product-page__back" href="#catalogo">← Volver al catálogo</a>
            <div class="product-page__gallery-meta">
              <span>${lineLabel}</span>
              <span data-product-counter>1 / ${images.length}</span>
            </div>
          </div>

          <div class="product-page__hero-media ${heroIsDetail ? 'product-page__hero-media--detail' : 'product-page__hero-media--catalog'}">
            ${heroIsDetail ? '' : `<img class="product-page__hero-backdrop" ${mediaAttributes(hero, '100vw')} alt="" aria-hidden="true" />`}
            <img class="product-page__hero-image" ${mediaAttributes(hero, '(max-width: 900px) 94vw, 58vw', { priority: true })} alt="${escapeHtml(product.product_name)}" data-product-hero />
            ${images.length > 1 ? `
              <div class="product-page__gallery-nav" aria-label="Mover galería">
                <button class="lihen-carousel-button" type="button" data-product-prev aria-label="Imagen anterior">${carouselArrowIcon('previous')}</button>
                <button class="lihen-carousel-button" type="button" data-product-next aria-label="Imagen siguiente">${carouselArrowIcon('next')}</button>
              </div>
            ` : ''}
          </div>

          ${images.length > 1 ? `
            <div class="product-page__thumbs" aria-label="Miniaturas de producto">
              ${images.map((media, index) => `
                <button type="button" data-product-thumb="${index}" aria-current="${index === 0 ? 'true' : 'false'}" aria-label="Ver imagen ${index + 1}">
                  <img ${mediaAttributes(media, '76px')} alt="" />
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <aside class="product-page__summary">
          <div class="product-page__summary-inner">
            <div class="product-page__brand-row">
              <p class="lihen-eyebrow">${escapeHtml(product.brand ?? 'LIHEN.CO')}</p>
              <span>SKU ${escapeHtml(product.sku)}</span>
            </div>

            <h1>${escapeHtml(product.product_name)}</h1>

            <div class="product-page__price-row">
              <strong>${money(product.sale_price)}</strong>
              <div class="product-page__status">
                <span>${availabilityLabel(product.availability)}</span>
                <span>${galleryLabel}</span>
              </div>
            </div>

            <div class="product-page__buybox">
              <button class="lihen-button lihen-button--lilac" type="button" data-page-select ${selectable ? '' : 'disabled'}>
                ${selectable ? (selected ? '✓ En mi selección' : 'Agregar a mi selección') : (product.availability === 'COMING_SOON' ? 'Próximamente' : 'No disponible')}
              </button>
              <a class="lihen-button lihen-button--dark" href="${buildProductWhatsAppUrl(selectedFromProduct(product))}" target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
            </div>

            <div class="product-page__accordions">
              <details open>
                <summary>Información</summary>
                ${verifiedDescription
                  ? `<p>${escapeHtml(verifiedDescription)}</p>`
                  : `<p>LIHEN Intelligence está verificando la información comercial de esta referencia antes de publicarla.</p>`}
                ${hasIntelligence ? `<small class="product-page__evidence-note">${enrichment.evidenceCount} evidencias verificadas respaldan esta ficha.</small>` : ''}
              </details>

              ${enrichment.benefits.length > 0 ? `
                <details>
                  <summary>Beneficios</summary>
                  <ul>${enrichment.benefits.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
                </details>` : ''}

              ${enrichment.ingredients.length > 0 ? `
                <details>
                  <summary>Ingredientes destacados</summary>
                  <ul>${enrichment.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
                </details>` : ''}

              ${enrichment.presentation.length > 0 ? `
                <details>
                  <summary>Presentación</summary>
                  <ul>${enrichment.presentation.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
                </details>` : ''}

              ${enrichment.usageCare.length > 0 ? `
                <details>
                  <summary>Uso y cuidados</summary>
                  <ul>${enrichment.usageCare.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
                </details>` : ''}

              ${enrichment.variants.length > 0 ? `
                <details>
                  <summary>Variante verificada</summary>
                  <ul>${enrichment.variants.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
                </details>` : ''}

              <details>
                <summary>Detalles verificados</summary>
                <dl>
                  <div><dt>Línea</dt><dd>${lineLabel}</dd></div>
                  <div><dt>SKU</dt><dd>${escapeHtml(product.sku)}</dd></div>
                  ${product.category ? `<div><dt>Categoría</dt><dd>${escapeHtml(product.category)}</dd></div>` : ''}
                  ${product.subcategory ? `<div><dt>Subcategoría</dt><dd>${escapeHtml(product.subcategory)}</dd></div>` : ''}
                </dl>
              </details>

              ${!hasIntelligence ? `
                <details>
                  <summary>Información en verificación</summary>
                  <ul>${pendingItems(product).map((item) => `<li>${item}</li>`).join('')}</ul>
                </details>` : ''}
            </div>
          </div>
        </aside>
      </section>

      <section class="product-page__trust">
        <div class="lihen-shell product-page__trust-grid">
          <article><span>01</span><h2>Atención personalizada</h2><p>Te acompañamos por WhatsApp antes de confirmar tu compra.</p></article>
          <article><span>02</span><h2>Información verificada</h2><p>Los atributos de producto se publican cuando existe una fuente aprobada.</p></article>
          <article><span>03</span><h2>Selección unificada</h2><p>Puedes reunir Beauty Care y Style en una sola consulta.</p></article>
        </div>
      </section>

      <section class="product-page__related lihen-shell">
        <div class="product-page__section-head">
          <div>
            <p class="lihen-eyebrow">También te puede gustar</p>
            <h2 class="lihen-display">Sigue explorando LIHEN.</h2>
          </div>
          <a href="${relatedHref}">Ver catálogo relacionado</a>
        </div>
        ${related.length > 0
          ? `<div class="product-page__related-grid" data-related-products>${related.map((item, index) => renderProductCard(item, index < 2)).join('')}</div>`
          : `<div class="product-page__related-placeholder"><p>No hay recomendaciones adicionales disponibles en este momento.</p></div>`}
      </section>

      <section class="product-page__faq lihen-shell">
        <p class="lihen-eyebrow">Preguntas frecuentes</p>
        <h2 class="lihen-display">Antes de elegir.</h2>
        <div class="product-page__faq-list">
          ${enrichment.faq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}
          <details><summary>¿Cómo confirmo disponibilidad?</summary><p>Usa el botón de WhatsApp de esta ficha. El mensaje identifica la referencia consultada.</p></details>
          <details><summary>¿Puedo combinar Beauty Care y Style?</summary><p>Sí. Mi selección puede reunir referencias de ambas líneas antes de consultar por WhatsApp.</p></details>
          <details><summary>¿Cómo valida LIHEN.CO la información del producto?</summary><p>LIHEN Intelligence prioriza fuentes oficiales y evidencia aprobada antes de mostrar beneficios, ingredientes, tallas, materiales o recomendaciones.</p></details>
        </div>
      </section>
    </div>
  `;
}

function bindPage(root: HTMLElement, product: StorefrontProduct): void {
  const images = galleryFor(product);
  let index = 0;
  const hero = root.querySelector<HTMLImageElement>('[data-product-hero]');
  const counter = root.querySelector<HTMLElement>('[data-product-counter]');
  const prev = root.querySelector<HTMLButtonElement>('[data-product-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-product-next]');
  const thumbs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-product-thumb]'));

  const show = (target: number): void => {
    if (images.length === 0) return;
    index = Math.min(Math.max(target, 0), images.length - 1);
    const media = images[index];
    if (hero) {
      hero.src = media.url;
      hero.srcset = `${media.url} ${media.width}w`;
      hero.width = media.width;
      hero.height = media.height;
    }
    if (counter) counter.textContent = `${index + 1} / ${images.length}`;
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= images.length - 1;
    thumbs.forEach((thumb, thumbIndex) => thumb.setAttribute('aria-current', String(thumbIndex === index)));
  };

  thumbs.forEach((thumb) => thumb.addEventListener('click', () => show(Number(thumb.dataset.productThumb ?? '0'))));
  prev?.addEventListener('click', () => show(index - 1));
  next?.addEventListener('click', () => show(index + 1));

  root.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });

  const selectButton = root.querySelector<HTMLButtonElement>('[data-page-select]');
  const syncSelectButton = (): void => {
    if (!selectButton) return;
    const selectable = product.availability === 'AVAILABLE' || product.availability === 'LOW_STOCK';
    if (!selectable) return;
    selectButton.textContent = isSelected(product.product_id) ? '✓ En mi selección' : 'Agregar a mi selección';
  };
  selectButton?.addEventListener('click', () => {
    const selectable = product.availability === 'AVAILABLE' || product.availability === 'LOW_STOCK';
    if (!selectable) return;
    toggleSelection(product);
    syncSelectButton();
  });
  subscribeSelection(syncSelectButton);
  syncSelectButton();
  show(0);
}

export async function renderProductPage(root: HTMLElement, ref: string): Promise<StorefrontProduct | null> {
  root.innerHTML = `<section class="product-page-empty lihen-shell"><p>Cargando producto…</p></section>`;
  const product = await findProduct(ref);

  if (!product) {
    root.innerHTML = `
      <section class="product-page-empty lihen-shell">
        <p class="lihen-eyebrow">LIHEN.CO</p>
        <h1 class="lihen-display">Producto no encontrado.</h1>
        <p>Esta referencia no está disponible en el catálogo publicado.</p>
        <a class="lihen-button lihen-button--dark" href="#catalogo">Volver al catálogo</a>
      </section>`;
    return null;
  }

  const [enrichment, brandRelated] = await Promise.all([
    getStorefrontProductEnrichment(product.product_id),
    getStorefrontProducts({
      limit: 8,
      businessLine: product.business_line as 'BEAUTY_CARE' | 'STYLE',
      brand: product.brand ?? undefined,
    }),
  ]);

  let related = brandRelated.items.filter((item) => item.product_id !== product.product_id).slice(0, 4);
  if (related.length < 4) {
    const lineRelated = await getStorefrontProducts({
      limit: 12,
      businessLine: product.business_line as 'BEAUTY_CARE' | 'STYLE',
    });
    const existing = new Set(related.map((item) => item.product_id));
    related = related.concat(
      lineRelated.items.filter((item) => item.product_id !== product.product_id && !existing.has(item.product_id)),
    ).slice(0, 4);
  }

  root.innerHTML = renderPage(product, enrichment, related);
  bindPage(root, product);
  const relatedHost = root.querySelector<HTMLElement>('[data-related-products]');
  if (relatedHost && related.length > 0) bindProductInteractions(relatedHost, related, () => undefined);
  return product;
}

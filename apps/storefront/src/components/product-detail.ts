import { availabilityLabel, escapeHtml, money, type StorefrontProduct } from './storefront-product';
import { buildProductWhatsAppUrl } from './whatsapp';
import { legacyMedia, mediaAttributes, type StorefrontMedia } from './storefront-media';
import { isSelected, toggleSelection, type SelectedProduct } from './selection-store';
import { carouselArrowIcon } from './carousel-navigation';

function asSelectedProduct(product: StorefrontProduct): SelectedProduct {
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

export function openProductDetail(product: StorefrontProduct): void {
  document.querySelector('[data-product-dialog]')?.remove();
  const previousTitle = document.title;
  document.title = `${product.product_name} | LIHEN.CO`;
  const descriptionMeta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
  const previousDescription = descriptionMeta?.content ?? '';
  if (descriptionMeta) descriptionMeta.content = product.description ?? `Consulta ${product.product_name} en LIHEN.CO.`;

  const dialog = document.createElement('dialog');
  dialog.className = 'product-dialog';
  dialog.dataset.productDialog = product.product_id;
  const cardFallback = product.card_media ?? legacyMedia(product.main_image_url);
  const detailMedia = product.detail_media;
  const galleryLimit = product.business_line === 'STYLE' ? 10 : 5;
  const rawImages: StorefrontMedia[] = product.gallery_media.length > 0
    ? product.gallery_media
    : detailMedia
      ? [detailMedia]
      : [cardFallback];
  const images: StorefrontMedia[] = rawImages
    .filter((media, index, all) => all.findIndex((candidate) => candidate.url === media.url) === index)
    .slice(0, galleryLimit);
  const detailFallback = !detailMedia;
  const heroMedia = images[0] ?? cardFallback;
  const selectable = product.availability === 'AVAILABLE' || product.availability === 'LOW_STOCK';
  const selected = selectable && isSelected(product.product_id);
  const name = escapeHtml(product.product_name);
  const verifiedDescription = product.description?.trim() || null;
  const detailImageCount = images.filter((media) => media.profile === 'WEB_DETAIL').length;
  const galleryLabel = detailImageCount > 0
    ? `${detailImageCount} ${detailImageCount === 1 ? 'imagen verificada' : 'imágenes verificadas'}`
    : 'Vista de catálogo';
  const lineLabel = product.business_line === 'STYLE' ? 'Style' : 'Beauty Care';
  const pendingItems = product.business_line === 'STYLE'
    ? [
        'Material y composición.',
        'Talla, ajuste y medidas.',
        'Colores o variantes verificadas.',
        'Cuidados de la prenda.',
      ]
    : [
        'Beneficios y atributos comerciales.',
        'Presentación o contenido de la referencia.',
        'Uso, cuidados o recomendaciones.',
      ];

  dialog.innerHTML = `
    <div class="product-dialog__panel">
      <button class="product-dialog__close" type="button" data-dialog-close aria-label="Cerrar ficha">
        <span aria-hidden="true">×</span>
      </button>

      <div class="product-dialog__gallery">
        <div class="product-dialog__gallery-head">
          <span class="product-dialog__line-badge">${lineLabel}</span>
          <span class="product-dialog__gallery-counter" data-dialog-counter aria-live="polite">1 / ${images.length}</span>
        </div>

        <div class="product-dialog__hero ${detailFallback ? 'product-dialog__hero--fallback' : ''}">
          <img ${mediaAttributes(heroMedia, '(max-width: 900px) 94vw, 62vw', { priority: true, fallback: detailFallback })} alt="${name}" />
        </div>

        <div class="product-dialog__gallery-nav" ${images.length > 1 ? '' : 'hidden'} aria-label="Mover galería">
          <button class="lihen-carousel-button" type="button" data-dialog-prev aria-label="Imagen anterior">${carouselArrowIcon('previous')}</button>
          <button class="lihen-carousel-button" type="button" data-dialog-next aria-label="Imagen siguiente">${carouselArrowIcon('next')}</button>
        </div>

        ${images.length > 1 ? `
          <div class="product-dialog__thumbs" aria-label="Miniaturas de producto">
            ${images.map((media, index) => `
              <button type="button" data-dialog-image="${index}" aria-label="Ver imagen ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}">
                <img ${mediaAttributes(media, '76px')} alt="" />
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="product-dialog__content">
        <div class="product-dialog__content-inner">
          <header class="product-dialog__header">
            <div class="product-dialog__brand-row">
              <p class="lihen-eyebrow">${escapeHtml(product.brand ?? 'LIHEN.CO')}</p>
              <span class="product-dialog__sku">SKU ${escapeHtml(product.sku)}</span>
            </div>

            <h2>${name}</h2>

            <div class="product-dialog__commercial-row">
              <p class="product-dialog__price">${money(product.sale_price)}</p>
              <div class="product-dialog__status-row">
                <span class="product-dialog__availability">${availabilityLabel(product.availability)}</span>
                <span class="product-dialog__gallery-status">${galleryLabel}</span>
              </div>
            </div>
          </header>

          <section class="product-dialog__section product-dialog__section--about" aria-labelledby="product-about-${product.product_id}">
            <p class="product-dialog__section-kicker">Producto LIHEN.CO</p>
            <h3 id="product-about-${product.product_id}">Sobre este producto</h3>
            ${verifiedDescription
              ? `<p class="product-dialog__description">${escapeHtml(verifiedDescription)}</p>`
              : `<div class="product-dialog__verification-note">
                  <strong>Información en preparación</strong>
                  <p>Esta ficha todavía no tiene una descripción comercial verificada. Solo mostramos información respaldada por fuentes aprobadas.</p>
                </div>`}
          </section>

          <section class="product-dialog__section" aria-labelledby="product-details-${product.product_id}">
            <p class="product-dialog__section-kicker">Información confirmada</p>
            <h3 id="product-details-${product.product_id}">Detalles del producto</h3>
            <dl class="product-dialog__meta">
              <div><dt>Línea</dt><dd>${lineLabel}</dd></div>
              <div><dt>SKU</dt><dd>${escapeHtml(product.sku)}</dd></div>
              ${product.category ? `<div><dt>Categoría</dt><dd>${escapeHtml(product.category)}</dd></div>` : ''}
              ${product.subcategory ? `<div><dt>Subcategoría</dt><dd>${escapeHtml(product.subcategory)}</dd></div>` : ''}
            </dl>
          </section>

          ${verifiedDescription ? '' : `
            <section class="product-dialog__section product-dialog__section--pending" aria-label="Información pendiente">
              <p class="product-dialog__section-kicker">Ficha en actualización</p>
              <h3>Próximamente en esta ficha</h3>
              <ul>${pendingItems.map((item) => `<li>${item}</li>`).join('')}</ul>
            </section>
          `}
        </div>

        <div class="product-dialog__action-dock">
          <div class="product-dialog__action-summary">
            <span>${money(product.sale_price)}</span>
            <small>${availabilityLabel(product.availability)}</small>
          </div>
          <div class="product-dialog__actions">
            <button class="lihen-button lihen-button--lilac" type="button" data-dialog-select aria-pressed="${selected}" ${selectable ? '' : 'disabled'}>${selectable ? (selected ? '✓ En mi selección' : 'Agregar a mi selección') : (product.availability === 'COMING_SOON' ? 'Próximamente' : 'No disponible')}</button>
            <a class="lihen-button lihen-button--dark" href="${buildProductWhatsAppUrl(asSelectedProduct(product))}" target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.append(dialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelector<HTMLButtonElement>('[data-dialog-close]')?.addEventListener('click', () => dialog.close());
  let currentImageIndex = 0;
  const hero = dialog.querySelector<HTMLImageElement>('.product-dialog__hero img');
  const prevImage = dialog.querySelector<HTMLButtonElement>('[data-dialog-prev]');
  const nextImage = dialog.querySelector<HTMLButtonElement>('[data-dialog-next]');
  const imageButtons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-dialog-image]'));
  const counter = dialog.querySelector<HTMLElement>('[data-dialog-counter]');

  const showImage = (index: number): void => {
    if (images.length === 0) return;
    currentImageIndex = Math.min(Math.max(index, 0), images.length - 1);
    const media = images[currentImageIndex];
    if (hero && media) {
      hero.src = media.url;
      hero.srcset = `${media.url} ${media.width}w`;
      hero.width = media.width;
      hero.height = media.height;
    }
    imageButtons.forEach((button, buttonIndex) => {
      button.setAttribute('aria-current', String(buttonIndex === currentImageIndex));
    });
    if (prevImage) prevImage.disabled = currentImageIndex <= 0;
    if (nextImage) nextImage.disabled = currentImageIndex >= images.length - 1;
    if (counter) counter.textContent = `${currentImageIndex + 1} / ${images.length}`;
  };

  imageButtons.forEach((button) => {
    button.addEventListener('click', () => showImage(Number(button.dataset.dialogImage ?? '0')));
  });
  prevImage?.addEventListener('click', () => showImage(currentImageIndex - 1));
  nextImage?.addEventListener('click', () => showImage(currentImageIndex + 1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showImage(currentImageIndex - 1);
    if (event.key === 'ArrowRight') showImage(currentImageIndex + 1);
  });
  showImage(0);
  dialog.querySelector<HTMLButtonElement>('[data-dialog-select]')?.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    if (!selectable) return;
    const active = toggleSelection(product);
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? '✓ En mi selección' : 'Agregar a mi selección';
    document.querySelectorAll<HTMLButtonElement>(`[data-product-select="${product.product_id}"]`).forEach((control) => {
      control.classList.toggle('is-selected', active);
      control.setAttribute('aria-pressed', String(active));
      control.textContent = active ? '✓' : '+';
    });
  });
  dialog.addEventListener('close', () => {
    document.title = previousTitle;
    if (descriptionMeta) descriptionMeta.content = previousDescription;
    dialog.remove();
  }, { once: true });
  dialog.showModal();
}

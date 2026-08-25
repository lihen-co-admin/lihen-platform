import { availabilityLabel, escapeHtml, money, type StorefrontProduct } from './storefront-product';
import { buildProductWhatsAppUrl } from './whatsapp';
import { legacyMedia, mediaAttributes, type StorefrontMedia } from './storefront-media';
import { isSelected, toggleSelection, type SelectedProduct } from './selection-store';

function asSelectedProduct(product: StorefrontProduct): SelectedProduct {
  return {
    productId: product.product_id,
    sku: product.sku,
    name: product.product_name,
    brand: product.brand,
    price: product.sale_price,
    imageUrl: product.main_image_url,
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
  const images: StorefrontMedia[] = product.gallery_media.length > 0
    ? product.gallery_media
    : detailMedia
      ? [detailMedia]
      : [cardFallback];
  const detailFallback = !detailMedia;
  const heroMedia = images[0] ?? cardFallback;
  const selected = isSelected(product.product_id);
  const name = escapeHtml(product.product_name);

  dialog.innerHTML = `
    <div class="product-dialog__panel">
      <button class="product-dialog__close" type="button" data-dialog-close aria-label="Cerrar">×</button>
      <div class="product-dialog__gallery">
        <div class="product-dialog__hero ${detailFallback ? 'product-dialog__hero--fallback' : ''}"><img ${mediaAttributes(heroMedia, '(max-width: 720px) 92vw, 560px', { priority: true, fallback: detailFallback })} alt="${name}" /></div>
        ${images.length > 1 ? `<div class="product-dialog__thumbs">${images.map((media, index) => `<button type="button" data-dialog-image="${index}" aria-label="Ver imagen ${index + 1}"><img ${mediaAttributes(media, '70px')} alt="" /></button>`).join('')}</div>` : ''}
      </div>
      <div class="product-dialog__content">
        <p class="lihen-eyebrow">${escapeHtml(product.brand ?? 'LIHEN.CO')}</p>
        <h2>${name}</h2>
        <p class="product-dialog__price">${money(product.sale_price)}</p>
        <p class="product-dialog__availability">${availabilityLabel(product.availability)}</p>
        ${product.description ? `<p class="product-dialog__description">${escapeHtml(product.description)}</p>` : ''}
        <dl class="product-dialog__meta">
          <div><dt>SKU</dt><dd>${escapeHtml(product.sku)}</dd></div>
          ${product.category ? `<div><dt>Categoría</dt><dd>${escapeHtml(product.category)}</dd></div>` : ''}
        </dl>
        <div class="product-dialog__actions">
          <button class="lihen-button lihen-button--lilac" type="button" data-dialog-select aria-pressed="${selected}">${selected ? '✓ En mi selección' : 'Agregar a mi selección'}</button>
          <a class="lihen-button lihen-button--dark" href="${buildProductWhatsAppUrl(asSelectedProduct(product))}" target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
        </div>
      </div>
    </div>
  `;

  document.body.append(dialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelector<HTMLButtonElement>('[data-dialog-close]')?.addEventListener('click', () => dialog.close());
  dialog.querySelectorAll<HTMLButtonElement>('[data-dialog-image]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.dialogImage ?? '0');
      const hero = dialog.querySelector<HTMLImageElement>('.product-dialog__hero img');
      const media = images[index];
      if (hero && media) {
        hero.src = media.url;
        hero.srcset = `${media.url} ${media.width}w`;
        hero.width = media.width;
        hero.height = media.height;
      }
    });
  });
  dialog.querySelector<HTMLButtonElement>('[data-dialog-select]')?.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
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

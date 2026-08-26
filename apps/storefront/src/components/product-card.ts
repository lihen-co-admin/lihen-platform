import { availabilityLabel, escapeHtml, money, type StorefrontProduct } from './storefront-product';
import { legacyMedia, mediaAttributes } from './storefront-media';
import { getSelectionQuantity, isSelected } from './selection-store';

export function renderProductCard(product: StorefrontProduct, priority = false): string {
  const brand = product.brand ? escapeHtml(product.brand) : 'LIHEN.CO';
  const name = escapeHtml(product.product_name);
  const selectable = product.availability === 'AVAILABLE' || product.availability === 'LOW_STOCK';
  const selected = selectable && isSelected(product.product_id);
  const quantity = Math.max(getSelectionQuantity(product.product_id), 1);
  const availability = availabilityLabel(product.availability);
  const media = product.card_media ?? legacyMedia(product.main_image_url);

  return `
    <article class="product-card ${selected ? 'is-selected' : ''}" data-product-card="${product.product_id}">
      <a class="product-card__media" href="#producto/${encodeURIComponent(product.product_id)}" aria-label="Ver ${name}">
        <img ${mediaAttributes(media, '(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 260px', { priority })} alt="${name}" />
        <span class="product-card__availability product-card__availability--${product.availability.toLowerCase()}">${availability}</span>
      </a>
      <div class="product-card__body">
        <p class="product-card__brand">${brand}</p>
        <a class="product-card__name" href="#producto/${encodeURIComponent(product.product_id)}">${name}</a>
        <div class="product-card__footer">
          <strong>${money(product.sale_price)}</strong>
          <div class="product-card__selection" data-product-selection="${product.product_id}" data-product-selectable="${selectable}">
            ${selectable ? `
              <button class="product-card__select ${selected ? 'is-selected' : ''}" type="button" data-product-select="${product.product_id}" aria-pressed="${selected}" aria-label="${selected ? 'Quitar de' : 'Agregar a'} mi selección" ${selected ? 'hidden' : ''}>+</button>
              <div class="product-card__quantity" data-product-quantity-controls ${selected ? '' : 'hidden'} aria-label="Cantidad de ${name}">
                <button type="button" data-product-decrement="${product.product_id}" aria-label="Disminuir cantidad de ${name}">−</button>
                <span data-product-quantity="${product.product_id}" aria-live="polite">${quantity}</span>
                <button type="button" data-product-increment="${product.product_id}" aria-label="Aumentar cantidad de ${name}">+</button>
              </div>
            ` : `<span class="product-card__unavailable">${product.availability === 'COMING_SOON' ? 'Próximamente' : 'No disponible'}</span>`}
          </div>
        </div>
      </div>
    </article>
  `;
}

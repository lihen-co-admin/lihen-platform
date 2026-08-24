import { availabilityLabel, escapeHtml, money, type StorefrontProduct } from './storefront-product';
import { isSelected } from './selection-store';

export function renderProductCard(product: StorefrontProduct, priority = false): string {
  const brand = product.brand ? escapeHtml(product.brand) : 'LIHEN.CO';
  const name = escapeHtml(product.product_name);
  const selected = isSelected(product.product_id);
  const availability = availabilityLabel(product.availability);

  return `
    <article class="product-card" data-product-card="${product.product_id}">
      <button class="product-card__media" type="button" data-product-open="${product.product_id}" aria-label="Ver ${name}">
        <img src="${product.main_image_url}" alt="${name}" ${priority ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
        <span class="product-card__availability product-card__availability--${product.availability.toLowerCase()}">${availability}</span>
      </button>
      <div class="product-card__body">
        <p class="product-card__brand">${brand}</p>
        <button class="product-card__name" type="button" data-product-open="${product.product_id}">${name}</button>
        <div class="product-card__footer">
          <strong>${money(product.sale_price)}</strong>
          <button class="product-card__select ${selected ? 'is-selected' : ''}" type="button" data-product-select="${product.product_id}" aria-pressed="${selected}" aria-label="${selected ? 'Quitar de' : 'Agregar a'} mi selección">${selected ? '✓' : '+'}</button>
        </div>
      </div>
    </article>
  `;
}

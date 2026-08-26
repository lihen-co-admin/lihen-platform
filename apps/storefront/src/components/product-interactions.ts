import type { StorefrontProduct } from './storefront-product';
import { isSelected, removeFromSelection, toggleSelection } from './selection-store';

export type ProductDetailOpener = (product: StorefrontProduct) => void;

export function bindProductInteractions(root: ParentNode, products: readonly StorefrontProduct[], openDetail: ProductDetailOpener): void {
  const byId = new Map(products.map((product) => [product.product_id, product]));

  products.forEach((product) => {
    const selectable = product.availability === 'AVAILABLE' || product.availability === 'LOW_STOCK';
    if (!selectable && isSelected(product.product_id)) removeFromSelection(product.product_id);
  });

  root.querySelectorAll<HTMLButtonElement>('[data-product-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = byId.get(button.dataset.productOpen ?? '');
      if (product) openDetail(product);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-product-select]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = byId.get(button.dataset.productSelect ?? '');
      if (!product) return;
      const selectable = product.availability === 'AVAILABLE' || product.availability === 'LOW_STOCK';
      if (!selectable) return;
      const selected = toggleSelection(product);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = selected ? '✓' : '+';
    });
  });
}

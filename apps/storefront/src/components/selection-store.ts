import type { StorefrontProduct } from './storefront-product';

export interface SelectedProduct {
  productId: string;
  sku: string;
  name: string;
  brand: string | null;
  price: string | number;
  imageUrl: string;
}

const STORAGE_KEY = 'lihen.storefront.selection.v1';
const listeners = new Set<(items: SelectedProduct[]) => void>();

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSelection(): SelectedProduct[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SelectedProduct => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<SelectedProduct>;
      return typeof candidate.productId === 'string' && typeof candidate.name === 'string' && typeof candidate.imageUrl === 'string';
    });
  } catch {
    return [];
  }
}

function writeSelection(items: SelectedProduct[]): void {
  browserStorage()?.setItem(STORAGE_KEY, JSON.stringify(items));
  listeners.forEach((listener) => listener(items));
}

export function toggleSelection(product: StorefrontProduct): boolean {
  const items = readSelection();
  const index = items.findIndex((item) => item.productId === product.product_id);
  if (index >= 0) {
    items.splice(index, 1);
    writeSelection(items);
    return false;
  }

  items.push({
    productId: product.product_id,
    sku: product.sku,
    name: product.product_name,
    brand: product.brand,
    price: product.sale_price,
    imageUrl: product.main_image_url,
  });
  writeSelection(items);
  return true;
}

export function removeFromSelection(productId: string): void {
  writeSelection(readSelection().filter((item) => item.productId !== productId));
}

export function clearSelection(): void {
  writeSelection([]);
}

export function isSelected(productId: string): boolean {
  return readSelection().some((item) => item.productId === productId);
}

export function subscribeSelection(listener: (items: SelectedProduct[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

import type { StorefrontProduct } from './storefront-product';

export interface SelectedProduct {
  productId: string;
  sku: string;
  name: string;
  brand: string | null;
  price: string | number;
  imageUrl: string;
  quantity: number;
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

function normalizeQuantity(value: unknown): number {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

export function readSelection(): SelectedProduct[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): SelectedProduct[] => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Partial<SelectedProduct>;
      if (typeof candidate.productId !== 'string' || typeof candidate.name !== 'string' || typeof candidate.imageUrl !== 'string') return [];
      return [{
        productId: candidate.productId,
        sku: typeof candidate.sku === 'string' ? candidate.sku : '',
        name: candidate.name,
        brand: typeof candidate.brand === 'string' ? candidate.brand : null,
        price: typeof candidate.price === 'number' || typeof candidate.price === 'string' ? candidate.price : 0,
        imageUrl: candidate.imageUrl,
        quantity: normalizeQuantity(candidate.quantity),
      }];
    });
  } catch {
    return [];
  }
}

function writeSelection(items: SelectedProduct[]): void {
  browserStorage()?.setItem(STORAGE_KEY, JSON.stringify(items));
  listeners.forEach((listener) => listener(items));
}

function fromProduct(product: StorefrontProduct, quantity = 1): SelectedProduct {
  return {
    productId: product.product_id,
    sku: product.sku,
    name: product.product_name,
    brand: product.brand,
    price: product.sale_price,
    imageUrl: product.main_image_url,
    quantity: normalizeQuantity(quantity),
  };
}

export function toggleSelection(product: StorefrontProduct): boolean {
  const items = readSelection();
  const index = items.findIndex((item) => item.productId === product.product_id);
  if (index >= 0) {
    items.splice(index, 1);
    writeSelection(items);
    return false;
  }

  items.push(fromProduct(product));
  writeSelection(items);
  return true;
}

export function setSelectionQuantity(productId: string, quantity: number): void {
  const items = readSelection();
  const item = items.find((candidate) => candidate.productId === productId);
  if (!item) return;
  item.quantity = normalizeQuantity(quantity);
  writeSelection(items);
}

export function incrementSelectionQuantity(productId: string): void {
  const item = readSelection().find((candidate) => candidate.productId === productId);
  if (!item) return;
  setSelectionQuantity(productId, item.quantity + 1);
}

export function decrementSelectionQuantity(productId: string): void {
  const item = readSelection().find((candidate) => candidate.productId === productId);
  if (!item) return;
  if (item.quantity <= 1) {
    removeFromSelection(productId);
    return;
  }
  setSelectionQuantity(productId, item.quantity - 1);
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

export function getSelectionQuantity(productId: string): number {
  return readSelection().find((item) => item.productId === productId)?.quantity ?? 0;
}

export function subscribeSelection(listener: (items: SelectedProduct[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

import type { SelectedProduct } from './selection-store';
import { money } from './storefront-product';

const WHATSAPP_BASE = 'https://wa.me/message/2JDWBH57SQG4F1';

export function buildSelectionWhatsAppUrl(items: SelectedProduct[]): string {
  const detail = items.map((item, index) => `${index + 1}. ${item.name}${item.brand ? ` · ${item.brand}` : ''} · ${money(item.price)} · ${item.sku}`).join('\n');
  const message = [
    'Hola, LIHEN.CO 👋',
    'Quiero consultar disponibilidad de esta selección:',
    '',
    detail,
    '',
    '¿Me ayudan a confirmar disponibilidad y entrega? Gracias ✨',
  ].join('\n');

  return `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`;
}

export function buildProductWhatsAppUrl(item: SelectedProduct): string {
  return buildSelectionWhatsAppUrl([item]);
}

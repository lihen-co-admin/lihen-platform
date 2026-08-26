import type { SelectedProduct } from './selection-store';

const WHATSAPP_BASE = 'https://wa.me/573057384163';

function numericPrice(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}


function whatsappMoney(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  return `$${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export function buildSelectionWhatsAppMessage(items: readonly SelectedProduct[]): string {
  const detail = items.map((item) => `• ${item.quantity} × ${item.name} — ${whatsappMoney(numericPrice(item.price) * item.quantity)}`).join('\n');
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + numericPrice(item.price) * item.quantity, 0);

  return [
    '🌸 ¡Hola LIHEN.CO!',
    '',
    'Quiero consultar disponibilidad de estos productos:',
    '',
    detail,
    '',
    `Total de referencias: ${items.length}`,
    `Cantidad total: ${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'}`,
    `Valor de referencia: ${whatsappMoney(totalValue)}`,
    '',
    '¿Me confirmas disponibilidad, por favor?',
  ].join('\n');
}

export function buildSelectionWhatsAppUrl(items: SelectedProduct[]): string {
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(buildSelectionWhatsAppMessage(items))}`;
}

export function buildProductWhatsAppUrl(item: SelectedProduct): string {
  return buildSelectionWhatsAppUrl([item]);
}

import { describe, expect, it } from 'vitest';
import { buildSelectionWhatsAppMessage } from '../src/components/whatsapp';
import type { SelectedProduct } from '../src/components/selection-store';

const items: SelectedProduct[] = [
  {
    productId: 'p-1',
    sku: 'BC-001',
    name: 'Brocha Cejas',
    brand: 'LIHEN.CO',
    price: 6000,
    imageUrl: '/brocha-cejas.webp',
    quantity: 2,
  },
  {
    productId: 'p-2',
    sku: 'BC-002',
    name: 'Brocha Polvos',
    brand: 'LIHEN.CO',
    price: 14000,
    imageUrl: '/brocha-polvos.webp',
    quantity: 1,
  },
];

describe('QA-A WhatsApp selection message', () => {
  it('uses the approved LIHEN greeting and dynamic quantities', () => {
    const message = buildSelectionWhatsAppMessage(items);

    expect(message).toContain('🌸 ¡Hola LIHEN.CO!');
    expect(message).toContain('• 2 × Brocha Cejas — $12.000');
    expect(message).toContain('• 1 × Brocha Polvos — $14.000');
    expect(message).toContain('Total de referencias: 2');
    expect(message).toContain('Cantidad total: 3 unidades');
    expect(message).toContain('Valor de referencia: $26.000');
    expect(message).toContain('¿Me confirmas disponibilidad, por favor?');
  });
});

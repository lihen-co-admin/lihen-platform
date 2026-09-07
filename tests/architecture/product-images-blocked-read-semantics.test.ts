import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Product Images blocked-read semantics', () => {
  const source = readFileSync(
    'apps/control-center/src/pages/ProductImagesPage.tsx',
    'utf8',
  );

  it('does not present blocked image reads as confirmed media absence', () => {
    expect(source).toContain(
      "if (!canReadImages) return 'Lectura bloqueada';",
    );
    expect(source).toContain(
      'mediaStatusLabel(images, productsComposition.canReadImages)',
    );
    expect(source).toContain(
      "productsComposition.canReadImages ? images.length : 'No verificable'",
    );
    expect(source).toContain(
      "productsComposition.canReadImages ? (mainImage ? 'Sí' : 'No') : 'No verificable'",
    );
    expect(source).toContain(
      "productsComposition.canReadImages ? `${altCoverage}/${images.length}` : 'No verificable'",
    );
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Product Images blocked-read semantics', () => {
  const source = readFileSync('apps/control-center/src/pages/ProductImagesPage.tsx', 'utf8');

  it('does not present blocked image reads as confirmed media absence', () => {
    expect(source).toContain("if (!canReadImages) return 'Lectura bloqueada';");
    expect(source).toContain('mediaStatusLabel(images, productsComposition.canReadImages)');
    expect(source).toContain(
      "productsComposition.canReadImages ? images.length : 'No verificable'",
    );
    expect(source).toMatch(
      /value:\s*productsComposition\.canReadImages\s*\?\s*mainImage\s*\?\s*'Sí'\s*:\s*'No'\s*:\s*'No verificable'/,
    );
    expect(source).toMatch(
      /value:\s*productsComposition\.canReadImages\s*\?\s*`\$\{altCoverage\}\/\$\{images\.length\}`\s*:\s*'No verificable'/,
    );
  });
});

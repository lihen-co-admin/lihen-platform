import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LIHEN Control Center detail visual system', () => {
  const summary = readFileSync(
    'apps/control-center/src/components/SummaryStrip.tsx',
    'utf8',
  );
  const detail = readFileSync(
    'apps/control-center/src/pages/ProductDetailPage.tsx',
    'utf8',
  );
  const css = readFileSync(
    'apps/control-center/src/styles/app.css',
    'utf8',
  );

  it('adapts SummaryStrip typography to value length', () => {
    expect(summary).toContain("summaryValueSize");
    expect(summary).toContain("summary-strip__item--value-${valueSize}");
    expect(css).toContain('.summary-strip__item--value-short strong');
    expect(css).toContain('.summary-strip__item--value-medium strong');
    expect(css).toContain('.summary-strip__item--value-long strong');
  });

  it('protects long summary and metadata values from destructive overflow', () => {
    expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));');
    expect(css).toContain('overflow-wrap: break-word;');
    expect(css).toContain('word-break: normal;');
    expect(css).not.toContain('.detail-grid dd {\n  margin: 0;\n  overflow-wrap: anywhere;');
  });

  it('presents canonical product metadata as a structured detail card', () => {
    expect(detail).toContain('detail-card detail-card--metadata');
    expect(detail).toContain('className="detail-card__heading"');
    expect(detail).toContain('Información canónica');
    expect(detail).toContain('Datos del producto');
  });
});

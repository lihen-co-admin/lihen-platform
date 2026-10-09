import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const page = read('apps/control-center/src/pages/CustomerBenefitsPage.tsx');
const css = read('apps/control-center/src/styles/app.css').replace(/\r\n/g, '\n');

describe('BONOS · presentación de Lifecycle Controlado', () => {
  it('conserva los controles de emisión, búsqueda y elegibilidad del servidor', () => {
    expect(page).toContain('className="stack benefit-lifecycle__form"');
    expect(page).toContain('!benefitActionAllowed(action, benefit)');
    expect(page).toContain('void execute()');
    expect(page).toContain('void loadSaleOptions()');
    expect(page).toContain('void loadOrderOptions()');
  });
  it('distingue el panel, campos y CTA sin tocar el preview creativo', () => {
    expect(page).toContain('className="card stack benefit-lifecycle"');
    expect(page).toContain('className="benefit-lifecycle__two-col"');
    expect(page).toContain('className="benefit-lifecycle__submit"');
    expect(page).toContain('Diseña y previsualiza tu bono');
    expect(css).toContain('.customer-benefits-page .benefit-lifecycle__form label');
    expect(css).toContain('@media (max-width: 720px)');
  });
  it('cierra el media query de 520px antes de los estilos de BONOS', () => {
    expect(css).toContain('@media (max-width: 520px) {\n  .intelligence-brand-context__grid {\n    grid-template-columns: 1fr;\n  }\n}\n\n/* CUSTOMER BENEFITS');
    expect(css).not.toContain('.intelligence-brand-context__grid {\n\n/* CUSTOMER BENEFITS');
  });
});

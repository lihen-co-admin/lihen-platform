import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const file = (name: string) => readFileSync(resolve(process.cwd(), name), 'utf8');
const page = file('apps/control-center/src/pages/CustomerBenefitsPage.tsx');
const creative = file('apps/control-center/src/components/CustomerBenefitCreative.tsx');
const canvas = file('apps/control-center/src/components/customer-benefit-reference-canvas.ts');
const workflow = file('.github/workflows/pages-dev.yml');

describe('GitHub Pages DEV: bono de muestra sin emisión', () => {
  it('habilita demo solamente con flag dedicado y origen esperado', () => {
    expect(workflow).toContain('VITE_CUSTOMER_BENEFIT_DEMO_ENABLED: "true"');
    expect(page).toContain("import.meta.env.VITE_CUSTOMER_BENEFIT_DEMO_ENABLED === 'true'");
    expect(page).toContain("window.location.hostname === 'lihen-co-admin.github.io'");
    expect(page).toContain('{demoPreviewEnabled ? (');
    expect(page).not.toContain('{import.meta.env.DEV ? (');
  });
  it('es ejemplo sin código canjeable ni persistencia', () => {
    expect(page).toContain("benefit_code: 'DEMO-NO-CANJE'");
    expect(page).toContain("status: 'GENERATED'");
    expect(page).toContain('demonstration');
    expect(page).toContain('NO VÁLIDO PARA CANJE');
  });
  it('marca el PNG real y su vista previa mediante el mismo canvas', () => {
    expect(canvas).toContain('if (demonstration) {');
    expect(canvas).toContain("context.fillText('NO VÁLIDO PARA CANJE'");
    expect(creative).toContain('demonstration={demonstration}');
    expect(creative).toContain('          demonstration,');
  });
  it('inhibe copiar, compartir y abrir WhatsApp en demostraciones', () => {
    expect(creative).toContain("const mayShareRealBenefit = !demonstration &&");
    expect(creative).toContain("benefit.status === 'ACTIVE'");
    expect(creative).toContain("new Date(benefit.valid_until)");
    expect(creative).toContain('if (!mayShareRealBenefit) return;');
    expect(creative).toContain('disabled={!mayShareRealBenefit}');
    expect(creative).toContain('disabled={busy || !mayShareRealBenefit}');
  });
  it('permite redactar el mensaje real sin envío automático', () => {
    expect(creative).toContain('onChange={(event) => setEditedMessage(event.target.value)}');
    expect(creative).toContain('editedMessage,');
    expect(creative).not.toContain('readOnly\n                value={message}');
  });
});

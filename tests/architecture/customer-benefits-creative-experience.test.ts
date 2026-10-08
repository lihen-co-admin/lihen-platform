import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const page = readFileSync(
  join(root, 'apps/control-center/src/pages/CustomerBenefitsPage.tsx'),
  'utf8',
);

const creative = readFileSync(
  join(root, 'apps/control-center/src/components/CustomerBenefitCreative.tsx'),
  'utf8',
);

const domain = readFileSync(
  join(root, 'apps/control-center/src/domain/customer-benefit-creative.ts'),
  'utf8',
);

describe('Customer Benefits creative experience architecture', () => {
  it('keeps lifecycle and Creative separated', () => {
    expect(page).toContain('CustomerBenefitCreative');
    expect(creative).not.toMatch(/\.rpc\s*\(/);
    expect(creative).not.toContain('benefitActions');
    expect(domain).not.toMatch(/\.rpc\s*\(/);
  });

  it('uses browser-local PNG generation and file sharing', () => {
    expect(creative).toMatch(/canvas\s*\.\s*toBlob\s*\(/);
    expect(creative).toMatch(/new\s+File\s*\(\s*\[blob\]/);
    expect(creative).toMatch(/navigator\s*\.\s*canShare/);
    expect(creative).toMatch(/navigator\s*\.\s*share/);
    expect(creative).toContain('downloadBlob');
  });

  it('keeps WhatsApp text-only and manual', () => {
    expect(creative).toContain('customerBenefitWhatsAppUrl');
    expect(creative).toMatch(/window\s*\.\s*open\s*\(/);
    expect(creative).not.toContain('conversation-whatsapp-runtime');
    expect(creative).not.toContain('WHATSAPP_SENDING_ENABLED');
    expect(creative).not.toMatch(/\bfetch\s*\(/);
    expect(domain).toContain('https://wa.me/');
  });

  it('supports clipboard copy without automatic sending', () => {
    expect(creative).toMatch(
      /navigator\s*\.\s*clipboard\s*\.\s*writeText\s*\(/,
    );
    expect(creative).toContain('Copiar mensaje');
    expect(creative).toContain('Abrir WhatsApp');
  });

  it('prevents the historic number/percent overlap contract', () => {
    expect(creative).toContain(
      'data-layout-contract="single-token-percentage"',
    );

    expect(creative).toMatch(
      /context\s*\.\s*fillText\s*\(\s*model\s*\.\s*discountLabel/,
    );

    expect(domain).toMatch(
      /`\$\{benefit\.discount_percent\}%`/,
    );
  });

  it('scrolls and focuses benefit detail after Ver bono', () => {
    expect(page).toMatch(
      /detailRef\s*\.\s*current\?\.\s*scrollIntoView\s*\(/,
    );
    expect(page).toContain("behavior: 'smooth'");
    expect(page).toMatch(
      /detailRef\s*\.\s*current\?\.\s*focus\s*\(/,
    );
    expect(page).toContain('Ver bono');
  });

  it('does not expose technical IDs in the visual card component', () => {
    expect(creative).not.toContain('customer_id');
    expect(creative).not.toContain('source_sale_id');
    expect(creative).not.toContain('source_order_id');
    expect(creative).not.toContain('redeemed_sale_id');
    expect(creative).not.toContain('redeemed_order_id');
  });

  it('retains the official LIHEN logo asset', () => {
    expect(creative).toContain(
      "../assets/brand/lihen-logo-official.png",
    );
  });
});

describe('Customer Benefits safe DEV preview', () => {
  it('provides a non-persistent Creative preview only in local DEV', () => {
    expect(page).toContain('import.meta.env.DEV');
    expect(page).toContain('DEV · PREVIEW SEGURO');
    expect(page).toContain(
      'no crea Customer Benefits ni ejecuta RPCs',
    );
    expect(page).toMatch(
      /setDevPreviewLine\s*\(\s*'BEAUTY_CARE'\s*\)/,
    );
    expect(page).toMatch(
      /setDevPreviewLine\s*\(\s*'STYLE'\s*\)/,
    );
  });

  it('keeps the preview synthetic and outside lifecycle execution', () => {
    expect(page).toContain('LIHENBC-DEV-PREVIEW');
    expect(page).toContain('LIHENST-DEV-PREVIEW');
    expect(page).toContain('CustomerBenefitCreative');
  });
});

describe('LIHEN dreamy-luxury visual refinement', () => {
  it('centralizes Beauty Care and Style creative tokens', () => {
    expect(domain).toContain('benefitCreativeThemes');
    expect(domain).toContain('limeGlow');
    expect(domain).toContain('emotionalCopy');
    expect(domain).toContain('validityValue');
  });

  it('uses the same visual model for HTML and Canvas', () => {
    expect(creative).toContain('buildCustomerBenefitVisualModel');
    expect(creative).toMatch(
      /visual\s*\.\s*themeTokens/,
    );
    expect(creative).toMatch(
      /model\s*\.\s*emotionalCopy/,
    );
    expect(creative).toMatch(
      /model\s*\.\s*validityValue/,
    );
  });

  it('preserves the official LIHEN logo and single-token percentage', () => {
    expect(creative).toContain(
      "../assets/brand/lihen-logo-official.png",
    );

    expect(creative).toContain(
      'data-layout-contract="single-token-percentage"',
    );

    expect(creative).toMatch(
      /context\s*\.\s*fillText\s*\(/,
    );

    expect(creative).toMatch(
      /model\s*\.\s*discountLabel/,
    );
  });

  it('keeps Creative isolated from lifecycle and sending', () => {
    expect(creative).not.toMatch(/\.rpc\s*\(/);
    expect(creative).not.toContain('WHATSAPP_SENDING_ENABLED');
    expect(creative).not.toContain('conversation-whatsapp-runtime');
    expect(domain).toContain('https://wa.me/');
  });
});

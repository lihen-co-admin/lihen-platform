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

describe('Customer Benefits LIHEN brand governance integration', () => {
  it('uses governed Creative QA in the benefit experience', () => {
    expect(creative).toContain(
      'auditLihenCreativeRequest',
    );

    expect(creative).toContain(
      'LIHEN_BRAND_CONTEXT',
    );

    expect(creative).toContain(
      'OFFICIAL_ASSET_BACKGROUND_NEUTRALIZED',
    );

    expect(creative).toContain(
      'benefit-brand-audit',
    );
  });

  it('neutralizes the official logo background without replacing the asset', () => {
    expect(creative).toContain(
      "../assets/brand/lihen-logo-official.png",
    );

    expect(creative).toContain(
      "globalCompositeOperation = 'multiply'",
    );

    expect(creative).not.toContain(
      'lihen-logo-transparent',
    );
  });
});

describe('Customer Benefits restored card composition', () => {
  it('keeps the official logo constrained as a header instead of primary content', () => {
    expect(creative).toContain(
      "../assets/brand/lihen-logo-official.png",
    );

    expect(creative).toContain(
      'const logoWidth =',
    );

    expect(creative).toMatch(
      /const\s+logoWidth\s*=\s*190/,
    );

    expect(creative).toContain(
      "globalCompositeOperation = 'multiply'",
    );
  });

  it('preserves every customer-facing card layer', () => {
    expect(creative).toContain('brand-header');
    expect(creative).toContain('brand-header');
    expect(creative).toContain('intro-copy');
    expect(creative).toContain('script-headline');
    expect(creative).toContain('discount-ticket');
    expect(creative).toContain('discount-ticket');
    expect(creative).toContain('exclusive-code');
    expect(creative).toContain('validity-benefit');
    expect(creative).toContain('closing');
    expect(creative).toContain('brand-footer');

    expect(creative).toContain(
      'LIHEN.CO | Beauty Care • Style',
    );
  });

  it('uses separate organic and editorial Canvas decoration treatments', () => {
    expect(creative).toContain(
      'drawOrganicContours',
    );

    expect(creative).toContain(
      'drawEditorialContours',
    );

    expect(creative).toContain(
      "model.theme === 'style'",
    );
  });

  it('retains Creative QA and PREPARED_ONLY governance', () => {
    expect(creative).toContain(
      'benefit-brand-audit',
    );

    expect(creative).toContain(
      'brandAudit.executionState',
    );

    expect(creative).toContain(
      'OFFICIAL_ASSET_BACKGROUND_NEUTRALIZED',
    );
  });
});

describe('Customer Benefits premium coupon presentation', () => {
  it('renders a complete customer-facing coupon hierarchy', () => {
    expect(creative).toContain('benefit-coupon__header');
    expect(creative).toContain('intro-copy');
    expect(creative).toContain('discount-ticket');
    expect(creative).toContain('exclusive-code');
    expect(creative).toContain('validity-benefit');
    expect(creative).toContain('closing');
    expect(creative).toContain('brand-footer');
  });

  it('keeps technical Creative QA outside the customer-facing benefit card', () => {
    const cardStart =
      creative.indexOf('className={`benefit-visual');

    const cardEnd =
      creative.indexOf('className="card stack benefit-share-panel"');

    const customerCard =
      creative.slice(cardStart, cardEnd);

    expect(customerCard)
      .not.toContain('benefit-brand-audit');

    expect(creative.slice(cardEnd))
      .toContain('benefit-brand-audit');
  });

  it('keeps customer-facing facts sourced from the visual model', () => {
    expect(creative).toContain('visual.discountLabel');
    expect(creative).toContain('visual.codeLabel');
    expect(creative).toContain('visual.validityValue');
    expect(creative).toContain('visual.statusLabel');
    expect(creative).toContain('visual.emotionalHeadline');
    expect(creative).toContain('visual.closingCopy');
  });

  it('does not introduce technical identifiers into the coupon', () => {
    expect(creative).not.toContain('source_sale_id');
    expect(creative).not.toContain('source_order_id');
    expect(creative).not.toContain('redeemed_sale_id');
    expect(creative).not.toContain('redeemed_order_id');
  });

  it('retains safe logo integration and single-token percentage', () => {
    expect(creative).toContain(
      "globalCompositeOperation = 'multiply'",
    );

  });
});


describe(
  'Customer Benefits reference-aligned render contract',
  () => {
    it(
      'uses one renderer for preview and downloaded PNG',
      () => {
        expect(
          creative,
        ).toContain(
          'CustomerBenefitReferencePreview',
        );

        expect(
          creative,
        ).toContain(
          'createReferenceBenefitPng',
        );

        expect(
          creative,
        ).toContain(
          'data-customer-benefit-reference-preview="true"',
        );
      },
    );

    it(
      'keeps the complete customer-facing hierarchy explicit',
      () => {
        expect(
          creative,
        ).toContain(
          'brand-header script-headline intro-copy discount-ticket exclusive-code validity-benefit closing brand-footer',
        );
      },
    );

    it(
      'keeps operator controls separate from customer preview',
      () => {
        const preview =
          creative.indexOf(
            'CustomerBenefitReferencePreview',
          );

        const operator =
          creative.indexOf(
            'benefit-share-panel',
          );

        expect(preview)
          .toBeGreaterThanOrEqual(0);

        expect(operator)
          .toBeGreaterThan(preview);
      },
    );
  },
);


describe(
  'Customer Benefits single-source commercial-value contract',
  () => {
    it(
      'keeps percentage and commercial values model-driven in the reference renderer',
      () => {
        const canvasSource =
          readFileSync(
            resolve(
              process.cwd(),
              'apps/control-center/src/components/customer-benefit-reference-canvas.ts',
            ),
            'utf8',
          );

        expect(canvasSource)
          .toContain(
            'model.discountLabel',
          );

        expect(canvasSource)
          .toContain(
            'model.codeLabel',
          );

        expect(canvasSource)
          .toContain(
            'model.validityValue',
          );

        expect(canvasSource)
          .toContain(
            'model.statusLabel',
          );
      },
    );
  },
);

describe(
  'Customer Benefits operator share panel',
  () => {
    it(
      'keeps Creative QA operator-facing and separate from the customer creative',
      () => {
        expect(creative)
          .toContain(
            'benefit-operator-qa',
          );

        expect(creative)
          .toContain(
            'CustomerBenefitReferencePreview',
          );

        const preview =
          creative.indexOf(
            'CustomerBenefitReferencePreview',
          );

        const operatorQa =
          creative.indexOf(
            'benefit-operator-qa',
          );

        expect(operatorQa)
          .toBeGreaterThan(preview);
      },
    );


    it(
      'retains the governed audit states',
      () => {
        expect(creative)
          .toContain(
            'brandAudit.brandCheck',
          );

        expect(creative)
          .toContain(
            'brandAudit.logoIntegrity',
          );

        expect(creative)
          .toContain(
            'brandAudit.executionState',
          );

        expect(creative)
          .toContain(
            "'PREPARED_ONLY'",
          );
      },
    );


    it(
      'keeps the manual sharing workflow explicit',
      () => {
        expect(creative)
          .toContain(
            'benefit-share-workflow',
          );

        expect(creative)
          .toContain(
            'Comparte o descarga el PNG.',
          );

        expect(creative)
          .toContain(
            'Copia el texto preparado.',
          );

        expect(creative)
          .toContain(
            'Abre el chat y decide si deseas enviarlo.',
          );
      },
    );


    it(
      'keeps all four operator actions',
      () => {
        expect(creative)
          .toContain(
            'Compartir imagen',
          );

        expect(creative)
          .toContain(
            'Descargar PNG',
          );

        expect(creative)
          .toContain(
            'Copiar mensaje',
          );

        expect(creative)
          .toContain(
            'Abrir WhatsApp',
          );

        expect(creative)
          .not.toContain(
            'Enviar WhatsApp',
          );
      },
    );


    it(
      'states that the prepared message is not automatically sent',
      () => {
        expect(creative)
          .toContain(
            'El mensaje no se envía automáticamente.',
          );
      },
    );
  },
);

describe(
  'Customer Benefits operator share panel',
  () => {
    it(
      'keeps Creative QA operator-facing and separate from the customer creative',
      () => {
        expect(creative)
          .toContain(
            'benefit-operator-qa',
          );

        expect(creative)
          .toContain(
            'CustomerBenefitReferencePreview',
          );

        const preview =
          creative.indexOf(
            'CustomerBenefitReferencePreview',
          );

        const operatorQa =
          creative.indexOf(
            'benefit-operator-qa',
          );

        expect(operatorQa)
          .toBeGreaterThan(preview);
      },
    );


    it(
      'retains the governed audit states',
      () => {
        expect(creative)
          .toContain(
            'brandAudit.brandCheck',
          );

        expect(creative)
          .toContain(
            'brandAudit.logoIntegrity',
          );

        expect(creative)
          .toContain(
            'brandAudit.executionState',
          );

        expect(creative)
          .toContain(
            "'PREPARED_ONLY'",
          );
      },
    );


    it(
      'keeps the manual sharing workflow explicit',
      () => {
        expect(creative)
          .toContain(
            'benefit-share-workflow',
          );

        expect(creative)
          .toContain(
            'Comparte o descarga el PNG.',
          );

        expect(creative)
          .toContain(
            'Copia el texto preparado.',
          );

        expect(creative)
          .toContain(
            'Abre el chat y decide si deseas enviarlo.',
          );
      },
    );


    it(
      'keeps all four operator actions',
      () => {
        expect(creative)
          .toContain(
            'Compartir imagen',
          );

        expect(creative)
          .toContain(
            'Descargar PNG',
          );

        expect(creative)
          .toContain(
            'Copiar mensaje',
          );

        expect(creative)
          .toContain(
            'Abrir WhatsApp',
          );

        expect(creative)
          .not.toContain(
            'Enviar WhatsApp',
          );
      },
    );


    it(
      'states that the prepared message is not automatically sent',
      () => {
        expect(creative)
          .toContain(
            'El mensaje no se envía automáticamente.',
          );
      },
    );
  },
);

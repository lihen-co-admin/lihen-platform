import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from 'vitest';


const root =
  process.cwd();


const page =
  readFileSync(
    join(
      root,
      'apps/control-center/src/pages/CustomerBenefitsPage.tsx',
    ),
    'utf8',
  );


const creative =
  readFileSync(
    join(
      root,
      'apps/control-center/src/components/CustomerBenefitCreative.tsx',
    ),
    'utf8',
  );


const canvas =
  readFileSync(
    join(
      root,
      'apps/control-center/src/components/customer-benefit-reference-canvas.ts',
    ),
    'utf8',
  );


const domain =
  readFileSync(
    join(
      root,
      'apps/control-center/src/domain/customer-benefit-creative.ts',
    ),
    'utf8',
  );


describe(
  'Customer Benefits Creative architecture',
  () => {
    it(
      'keeps lifecycle mutation outside Creative',
      () => {
        expect(page)
          .toContain(
            'CustomerBenefitCreative',
          );

        expect(creative)
          .not.toMatch(
            /\.rpc\s*\(/,
          );

        expect(canvas)
          .not.toMatch(
            /\.rpc\s*\(/,
          );

        expect(domain)
          .not.toMatch(
            /\.rpc\s*\(/,
          );
      },
    );


    it(
      'keeps Customer Benefit actions outside Creative',
      () => {
        expect(creative)
          .not.toContain(
            'benefitActions',
          );

        expect(canvas)
          .not.toContain(
            'benefitActions',
          );
      },
    );


    it(
      'uses browser-local PNG generation',
      () => {
        expect(canvas)
          .toContain(
            'document.createElement(',
          );

        expect(canvas)
          .toContain(
            "'canvas'",
          );

        expect(canvas)
          .toMatch(
            /canvas\s*\.\s*toBlob\s*\(/,
          );

        expect(creative)
          .toContain(
            'createReferenceBenefitPng',
          );
      },
    );


    it(
      'supports browser file sharing with fallback download',
      () => {
        expect(creative)
          .toMatch(
            /new\s+File\s*\(\s*\[blob\]/,
          );

        expect(creative)
          .toMatch(
            /navigator\s*\.\s*canShare/,
          );

        expect(creative)
          .toMatch(
            /navigator\s*\.\s*share/,
          );

        expect(creative)
          .toContain(
            'downloadBlob',
          );
      },
    );


    it(
      'keeps WhatsApp text-only and manual',
      () => {
        expect(creative)
          .toContain(
            'customerBenefitWhatsAppUrl',
          );

        expect(creative)
          .toMatch(
            /window\s*\.\s*open\s*\(/,
          );

        expect(creative)
          .not.toContain(
            'conversation-whatsapp-runtime',
          );

        expect(creative)
          .not.toContain(
            'WHATSAPP_SENDING_ENABLED',
          );

        expect(creative)
          .not.toMatch(
            /\bfetch\s*\(/,
          );

        expect(domain)
          .toContain(
            'https://wa.me/',
          );
      },
    );


    it(
      'supports clipboard copy without automatic sending',
      () => {
        expect(creative)
          .toMatch(
            /navigator\s*\.\s*clipboard\s*\.\s*writeText\s*\(/,
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
      'keeps the percentage as one model-driven token',
      () => {
        expect(domain)
          .toMatch(
            /`\$\{benefit\.discount_percent\}%`/,
          );

        expect(canvas)
          .toContain(
            'model.discountLabel',
          );
      },
    );


    it(
      'keeps customer-facing values sourced from the visual model',
      () => {
        expect(canvas)
          .toContain(
            'model.discountLabel',
          );

        expect(canvas)
          .toContain(
            'model.codeLabel',
          );

        expect(canvas)
          .toContain(
            'model.validityValue',
          );

        expect(canvas)
          .toContain(
            'model.statusLabel',
          );

        expect(canvas)
          .toContain(
            'model.emotionalHeadline',
          );

        expect(canvas)
          .toContain(
            'model.closingCopy',
          );
      },
    );


    it(
      'does not expose technical IDs in the customer creative',
      () => {
        for (
          const technicalId
          of [
            'customer_id',
            'source_sale_id',
            'source_order_id',
            'redeemed_sale_id',
            'redeemed_order_id',
          ]
        ) {
          expect(creative)
            .not.toContain(
              technicalId,
            );

          expect(canvas)
            .not.toContain(
              technicalId,
            );
        }
      },
    );
  },
);


describe(
  'Customer Benefits safe DEV preview',
  () => {
    it(
      'keeps preview local-only and non-persistent',
      () => {
        expect(page)
          .toContain(
            "import.meta.env.VITE_CUSTOMER_BENEFIT_DEMO_ENABLED === 'true'",
          );

        expect(page)
          .toContain(
            'DEV · PREVIEW SEGURO',
          );

        expect(page)
          .toContain(
            'sin crear bonos ni ejecutar RPCs',
          );
      },
    );


    it(
      'provides Beauty Care and Style preview variants',
      () => {
        expect(page)
          .toMatch(
            /setDevPreviewLine\s*\(\s*'BEAUTY_CARE'\s*\)/,
          );

        expect(page)
          .toMatch(
            /setDevPreviewLine\s*\(\s*'STYLE'\s*\)/,
          );

        expect(page)
          .toContain(
            "benefit_code: 'DEMO-NO-CANJE'",
          );

        expect(page)
          .toContain(
            "status: 'GENERATED'",
          );
      },
    );


    it(
      'keeps Ver bono navigation visible and focused',
      () => {
        expect(page)
          .toMatch(
            /detailRef\s*\.\s*current\?\.\s*scrollIntoView\s*\(/,
          );

        expect(page)
          .toContain(
            "behavior: 'smooth'",
          );

        expect(page)
          .toMatch(
            /detailRef\s*\.\s*current\?\.\s*focus\s*\(/,
          );

        expect(page)
          .toContain(
            'Ver bono',
          );
      },
    );
  },
);


describe(
  'LIHEN Customer Benefit visual governance',
  () => {
    it(
      'centralizes Beauty Care and Style theme tokens',
      () => {
        expect(domain)
          .toContain(
            'benefitCreativeThemes',
          );

        expect(domain)
          .toContain(
            'BEAUTY_CARE',
          );

        expect(domain)
          .toContain(
            'STYLE',
          );

        expect(canvas)
          .toContain(
            'BEAUTY_PALETTE',
          );

        expect(canvas)
          .toContain(
            'STYLE_PALETTE',
          );
      },
    );


    it(
      'preserves the official LIHEN logo asset',
      () => {
        expect(canvas)
          .toContain(
            "../assets/brand/lihen-logo-official.png",
          );

        expect(canvas)
          .not.toContain(
            'lihen-logo-transparent',
          );
      },
    );


    it(
      'neutralizes the opaque logo background at presentation time',
      () => {
        expect(canvas)
          .toMatch(
            /globalCompositeOperation\s*=\s*[\r\n\s]*'multiply'/,
          );

        expect(creative)
          .toContain(
            'OFFICIAL_ASSET_BACKGROUND_NEUTRALIZED',
          );
      },
    );


    it(
      'keeps canonical LIHEN Brand Context governance',
      () => {
        expect(creative)
          .toContain(
            'auditLihenCreativeRequest',
          );

        expect(creative)
          .toContain(
            'LIHEN_BRAND_CONTEXT',
          );

        expect(creative)
          .toContain(
            'LIHEN_BRAND_CONTEXT.brand',
          );
      },
    );


    it(
      'keeps PASS and PREPARED_ONLY audit state operator-facing',
      () => {
        expect(creative)
          .toContain(
            'benefit-operator-qa',
          );

        expect(creative)
          .toContain(
            'brandAudit.overall',
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

        expect(creative)
          .toContain(
            "'PREPARED ONLY'",
          );
      },
    );
  },
);


describe(
  'Reference-aligned single-source coupon',
  () => {
    it(
      'uses one Canvas renderer for preview and download',
      () => {
        expect(creative)
          .toContain(
            'CustomerBenefitReferencePreview',
          );

        expect(creative)
          .toContain(
            'createReferenceBenefitPng',
          );

        expect(creative)
          .toContain(
            'data-customer-benefit-reference-preview="true"',
          );
      },
    );


    it(
      'keeps the full customer-facing hierarchy explicit',
      () => {
        expect(creative)
          .toContain(
            'brand-header script-headline intro-copy discount-ticket exclusive-code validity-benefit closing brand-footer',
          );

        expect(canvas)
          .toContain(
            'DE DESCUENTO',
          );

        expect(canvas)
          .toContain(
            'TU CÓDIGO EXCLUSIVO',
          );

        expect(canvas)
          .toContain(
            'VÁLIDO HASTA',
          );

        expect(canvas)
          .toContain(
            'BENEFICIO',
          );

        expect(canvas)
          .toContain(
            '¡Te esperamos!',
          );

        expect(canvas)
          .toContain(
            'LIHEN.CO',
          );
      },
    );


    it(
      'keeps customer preview separate from operator controls',
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
          .toBeGreaterThanOrEqual(
            0,
          );

        expect(operator)
          .toBeGreaterThan(
            preview,
          );
      },
    );
  },
);


describe(
  'Customer Benefits operator share panel refinement',
  () => {
    it(
      'keeps Creative QA outside the customer-facing creative',
      () => {
        const preview =
          creative.indexOf(
            'CustomerBenefitReferencePreview',
          );

        const operatorQa =
          creative.indexOf(
            'benefit-operator-qa',
          );

        expect(operatorQa)
          .toBeGreaterThan(
            preview,
          );
      },
    );


    it(
      'renders the three-step sharing workflow',
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
      'provides a governed suggested-message workspace',
      () => {
        expect(creative)
          .toContain(
            'benefit-share-message',
          );

        expect(creative)
          .toContain(
            'benefit-share-message__textarea',
          );

        expect(creative)
          .toContain(
            'El mensaje no se envía automáticamente.',
          );
      },
    );


    it(
      'retains all explicit user-controlled sharing actions',
      () => {
        for (
          const action
          of [
            'Compartir imagen',
            'Descargar PNG',
            'Copiar mensaje',
            'Abrir WhatsApp',
          ]
        ) {
          expect(creative)
            .toContain(
              action,
            );
        }
      },
    );


    it(
      'keeps WhatsApp as open-chat rather than automatic send',
      () => {
        expect(creative)
          .toContain(
            'customerBenefitWhatsAppUrl',
          );

        expect(creative)
          .toContain(
            'window.open',
          );

        expect(creative)
          .not.toContain(
            'sendWhatsApp',
          );
      },
    );
  },
);

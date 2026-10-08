import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  LIHEN_BRAND_CONTEXT,
  auditLihenCreativeRequest,
  formatLihenBrandContextForModel,
  withLihenBrandConstraints,
} from '../src';


describe(
  'LIHEN brand-aware creative governance',
  () => {

    it(
      'provides canonical LIHEN identity and signature',
      () => {
        expect(
          LIHEN_BRAND_CONTEXT.brand,
        ).toBe(
          'LIHEN.CO | Beauty Care • Style',
        );

        expect(
          LIHEN_BRAND_CONTEXT.signature,
        ).toBe(
          'Tu cuidado, tu estilo, tu esencia.',
        );

        expect(
          LIHEN_BRAND_CONTEXT.officialLogoAsset,
        ).toBe(
          'LIHEN_LOGO_OFFICIAL',
        );
      },
    );


    it(
      'distinguishes Beauty Care and Style while preserving shared brand rules',
      () => {
        const beauty =
          formatLihenBrandContextForModel(
            'BEAUTY_CARE',
          );

        const style =
          formatLihenBrandContextForModel(
            'STYLE',
          );

        expect(beauty)
          .toContain(
            'soft luminous beauty-boutique direction',
          );

        expect(style)
          .toContain(
            'editorial fashion direction',
          );

        expect(beauty)
          .toContain(
            'Preserve the official LIHEN logo exactly.',
          );

        expect(style)
          .toContain(
            'Preserve the official LIHEN logo exactly.',
          );
      },
    );


    it(
      'detects an accidental opaque white logo background',
      () => {
        const audit =
          auditLihenCreativeRequest({
            instruction:
              'Prepare a Beauty Care benefit visual.',
            intendedUse:
              'WHATSAPP_BENEFIT',
            businessLine:
              'BEAUTY_CARE',
            logoObservation:
              'OPAQUE_WHITE_BACKGROUND',
          });

        expect(
          audit.logoIntegrity,
        ).toBe(
          'WARNING',
        );

        expect(
          audit.recommendations
            .join(' '),
        ).toContain(
          'transparent logo',
        );

        expect(
          audit.executionState,
        ).toBe(
          'PREPARED_ONLY',
        );
      },
    );


    it(
      'fails closed when a brief asks to redesign the official logo',
      () => {
        const audit =
          auditLihenCreativeRequest({
            instruction:
              'Redesign the LIHEN logo for this campaign.',
            intendedUse:
              'SOCIAL',
            businessLine:
              'STYLE',
          });

        expect(
          audit.overall,
        ).toBe(
          'FAIL',
        );

        expect(
          audit.recommendations
            .join(' '),
        ).toContain(
          'official LIHEN logo',
        );
      },
    );


    it(
      'adds canonical brand constraints without removing existing constraints',
      () => {
        const constraints =
          withLihenBrandConstraints(
            [
              'preserve product identity',
            ],
            'BEAUTY_CARE',
          );

        expect(constraints)
          .toContain(
            'preserve product identity',
          );

        expect(
          constraints.join(' '),
        ).toContain(
          'official LIHEN logo',
        );

        expect(
          constraints.join(' '),
        ).toContain(
          'GENERATED != OFFICIAL',
        );
      },
    );
  },
);

describe('official logo safe presentation correction', () => {
  it('passes when the official asset background is neutralized without redesign', () => {
    const audit =
      auditLihenCreativeRequest({
        instruction:
          'Render a LIHEN customer benefit with the official logo.',
        intendedUse:
          'CUSTOMER_BENEFIT_SHARE',
        businessLine:
          'BEAUTY_CARE',
        logoObservation:
          'OFFICIAL_ASSET_BACKGROUND_NEUTRALIZED',
      });

    expect(audit.logoIntegrity)
      .toBe('PASS');

    expect(audit.overall)
      .toBe('PASS');

    expect(audit.executionState)
      .toBe('PREPARED_ONLY');

    expect(audit.messages.join(' '))
      .toContain('preserved');
  });
});

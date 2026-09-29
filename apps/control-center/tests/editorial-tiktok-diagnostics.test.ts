import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EditorialOperationalActions } from '../src/components/EditorialOperationalActions';
import { createEditorialDraft } from '../src/composition/editorial-workspace';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: vi.fn(actual.useState) };
});

describe('TikTok operational diagnostics', () => {
  it.each([
    ['TIKTOK_PROVIDER_CONTRACT_UNVERIFIED', 'El contrato oficial de TikTok está codificado'],
    [
      'TIKTOK_VIDEO_DURATION_VERIFICATION_UNAVAILABLE',
      'todavía no existe una medición confiable de la duración del video en el servidor',
    ],
  ])('explains %s without enabling publication', (blocker, explanation) => {
    const item = createEditorialDraft(
      {
        copy: 'Video',
        callToAction: '',
        hashtags: '',
        creativeAssetIds: ['video'],
        channels: ['TIKTOK'],
        productId: 'product',
        campaignName: '',
        date: '',
      },
      new Date(),
      () => 'publication',
    )[0]!;
    vi.mocked(useState).mockReturnValueOnce([
      {
        channel: 'TIKTOK',
        copy: 'Video',
        callToAction: '',
        hashtags: [],
        creativeAssetIds: ['video'],
        blockers: [blocker],
        nextAction: null,
      },
      vi.fn(),
    ]);
    const html = renderToStaticMarkup(
      createElement(EditorialOperationalActions, {
        item,
        disabled: false,
        onRefresh: async () => {},
        onBusyChange: () => {},
      }),
    );
    expect(html).toContain(explanation);
    expect(html).toContain('permanece bloqueada');
    expect(html).not.toContain(blocker);
    expect(html).not.toContain('Contrato exacto del proveedor TikTok pendiente de verificación');
    expect(html).not.toContain('Crear intento pendiente');
  });
});

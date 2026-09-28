import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  EditorialVariantComparison,
  relatedEditorialVariants,
} from '../src/components/EditorialVariantComparison';
import { createEditorialDraft } from '../src/composition/editorial-workspace';

function fixture() {
  let sequence = 0;
  return createEditorialDraft(
    {
      copy: 'Contenido compartido',
      callToAction: '',
      hashtags: '',
      creativeAssetIds: [],
      channels: ['INSTAGRAM_FEED', 'FACEBOOK'],
      channelVariants: {
        FACEBOOK: {
          copy: 'Copy exclusivo Facebook',
          callToAction: 'Conoce LIHEN',
          hashtags: '#LIHEN',
          creativeAssetIds: ['image-1'],
        },
      },
      productId: '',
      campaignName: '',
      date: '',
    },
    new Date('2026-09-28T16:00:00Z'),
    () => `id-${++sequence}`,
  );
}

describe('editorial variant comparison', () => {
  it('groups durable identities after reload without relying on product or campaign labels', () => {
    const items = fixture();
    const current = items[0]!;
    const unrelated = {
      ...current,
      publication: { ...current.publication, id: 'other', campaignContentId: 'other-content' },
    };
    const otherCampaign = {
      ...current,
      publication: { ...current.publication, id: 'other-campaign', campaignId: 'other' },
    };
    const reloaded = items.map((item) => ({ ...item, productId: '', campaignName: '' }));
    expect(relatedEditorialVariants([...reloaded, unrelated, otherCampaign], current)).toEqual(
      reloaded,
    );
  });

  it('does not invent a group for missing identities', () => {
    const items = fixture().map((item) => ({
      ...item,
      publication: { ...item.publication, campaignContentId: '' },
    }));
    expect(relatedEditorialVariants(items, items[0]!)).toEqual([items[0]]);
  });

  it('renders independent fields and cancelled siblings without mutations or actions', () => {
    const items = fixture();
    items[1] = {
      ...items[1]!,
      publication: { ...items[1]!.publication, status: 'CANCELLED' },
    };
    const before = JSON.stringify(items);
    const onOpen = vi.fn();
    const html = renderToStaticMarkup(
      createElement(EditorialVariantComparison, { items, current: items[0]!, onOpen }),
    );
    for (const value of [
      'Instagram Feed',
      'Facebook',
      'Copy exclusivo Facebook',
      'Conoce LIHEN',
      '#LIHEN',
      'Cancelado',
      'Borrador',
      'Sin fecha',
      'Sin CTA',
      'Sin hashtags',
      'Variante actual',
      'Abrir variante',
      'aria-current="true"',
    ])
      expect(html).toContain(value);
    expect(JSON.stringify(items)).toBe(before);
    expect(onOpen).not.toHaveBeenCalled();
    expect(items.every((item) => item.attempts.length === 0)).toBe(true);
  });

  it('limits the single variant empty state to the library actually read', () => {
    const items = fixture().slice(0, 1);
    expect(
      renderToStaticMarkup(
        createElement(EditorialVariantComparison, {
          items,
          current: items[0]!,
          onOpen: () => undefined,
        }),
      ),
    ).toContain('No hay otras variantes de este contenido en la biblioteca leída.');
  });
});

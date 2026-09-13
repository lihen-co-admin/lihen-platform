import { describe, expect, it } from 'vitest';

import {
  compareVisibleText,
  evaluateVisibleEvidence,
  isPassingProductTextMatch,
  normalizeVisiblePrices,
  parseCopPrice,
} from '../src/visible-evidence';

describe('visible supplier evidence', () => {
  describe('parseCopPrice', () => {
    it.each([
      ['DETAL $60.000', 60000],
      ['MAYOR $33.000', 33000],
      ['DETAL $38.900', 38900],
      ['MAYOR $29.000', 29000],
      ['DETAL $44.000', 44000],
      ['$19.000', 19000],
      ['44.900', 44900],
      ['105.000', 105000],
      ['7.500', 7500],
    ])(
      'normalizes %s deterministically',
      (rawText, expected) => {
        expect(parseCopPrice(rawText)).toBe(expected);
      },
    );

    it('supports Colombian decimal notation without delegating semantics to the provider', () => {
      expect(
        parseCopPrice('DETAL $38.900,50'),
      ).toBe(38900.5);
    });

    it('returns null when no supported amount is visible', () => {
      expect(parseCopPrice('SIN PRECIO')).toBeNull();
      expect(parseCopPrice(null)).toBeNull();
    });
  });

  describe('compareVisibleText', () => {
    it('distinguishes exact and normalized exact matches', () => {
      expect(
        compareVisibleText(
          'ANCESTRAL',
          'ANCESTRAL',
        ),
      ).toBe('EXACT_MATCH');

      expect(
        compareVisibleText(
          'Ácido Hialurónico',
          'ACIDO HIALURONICO',
        ),
      ).toBe('NORMALIZED_EXACT_MATCH');
    });

    it('does not promote partial product text to a passing exact match', () => {
      const result = compareVisibleText(
        'AGUA MICELAR',
        'AGUA',
      );

      expect(result).toBe('PARTIAL_MATCH');
      expect(
        isPassingProductTextMatch(result),
      ).toBe(false);
    });

    it('marks unrelated visible product text as contradictory', () => {
      expect(
        compareVisibleText(
          'ACIDO HIALURONICO',
          'ANYCLUB',
        ),
      ).toBe('CONTRADICTORY');
    });

    it('marks a missing side explicitly', () => {
      expect(
        compareVisibleText(
          'ANCESTRAL',
          null,
        ),
      ).toBe('MISSING');
    });
  });

  describe('visible evidence normalization', () => {
    it('preserves raw provider evidence while adding deterministic normalized amounts', () => {
      const prices = normalizeVisiblePrices([
        {
          label: 'MAYOR',
          rawText: 'MAYOR $33.000',
        },
        {
          label: 'DETAL',
          rawText: 'DETAL $38.900',
        },
      ]);

      expect(prices).toEqual([
        {
          label: 'MAYOR',
          rawText: 'MAYOR $33.000',
          amount: 33000,
        },
        {
          label: 'DETAL',
          rawText: 'DETAL $38.900',
          amount: 38900,
        },
      ]);
    });

    it('evaluates the real diagnostic shape without rewriting provider output', () => {
      const actual = {
        productText: 'ANCESTRAL',
        brandText: 'COCON',
        prices: [
          {
            label: 'MAYOR',
            rawText: 'MAYOR $33.000',
          },
          {
            label: 'DETAL',
            rawText: 'DETAL $38.900',
          },
        ],
        warnings: [
          'Product name is uncertain',
        ],
      } as const;

      const evaluated = evaluateVisibleEvidence(
        'ANCESTRAL',
        actual,
      );

      expect(
        evaluated.productTextMatch,
      ).toBe('EXACT_MATCH');

      expect(
        evaluated.normalizedPrices.map(
          (price) => price.amount,
        ),
      ).toEqual([
        33000,
        38900,
      ]);

      expect(actual.prices[0].rawText).toBe(
        'MAYOR $33.000',
      );
    });
  });
});

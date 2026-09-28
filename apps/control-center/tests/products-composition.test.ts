import { afterEach, describe, expect, it } from 'vitest';

import { resetBrowserSupabaseClientForTests } from '@lihen/database';
import { InMemoryProductRepository, SupabaseProductRepository } from '@lihen/products';

import { createProductsComposition } from '../src/composition/products';

afterEach(() => resetBrowserSupabaseClientForTests());

describe('Control Center Product Master composition', () => {
  it('uses the authenticated browser Supabase adapter when DEV source is supabase', () => {
    const composition = createProductsComposition({
      VITE_PRODUCT_READ_SOURCE: 'supabase',
      VITE_AUTH_MODE: 'supabase',
      VITE_SUPABASE_URL: 'https://vnmkupzptujtywnnabkp.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-browser-publishable-key',
    });

    expect(composition.source).toBe('supabase');
    expect(composition.repository).toBeInstanceOf(SupabaseProductRepository);
    expect(composition.repository).not.toBeInstanceOf(InMemoryProductRepository);
    expect(composition.canCreate).toBe(false);
    expect(composition.canUpdate).toBe(false);
    expect(composition.canChangePrice).toBe(false);
  });

  it('uses memory only when explicitly selected', () => {
    const composition = createProductsComposition({
      VITE_PRODUCT_READ_SOURCE: 'memory',
      VITE_AUTH_MODE: 'disabled',
    });

    expect(composition.source).toBe('memory');
    expect(composition.repository).toBeInstanceOf(InMemoryProductRepository);
  });
});

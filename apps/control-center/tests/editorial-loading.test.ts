import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editorialReadDeadline } from '../src/composition/editorial-read-deadline';

const operator = vi.hoisted(() => ({ authorized: true, role: 'OWNER' }));
vi.mock('../src/auth/auth-context', () => ({
  useAuth: () => ({
    enabled: true,
    authorized: operator.authorized,
    user: { id: 'test-owner' },
    profile: { roleCode: operator.role },
  }),
}));
vi.mock('../src/composition/products', () => ({ productsComposition: { source: 'supabase' } }));
import { SocialContentPage } from '../src/pages/SocialContentPage';
import { EditorialComposer } from '../src/components/EditorialComposer';
import { createEditorialDraft } from '../src/composition/editorial-workspace';

beforeEach(() => {
  operator.authorized = true;
  operator.role = 'OWNER';
  vi.stubEnv('DEV', false);
  vi.stubEnv('VITE_EDITORIAL_DEV_SYNC_ENABLED', 'true');
  vi.stubEnv('VITE_PRODUCT_READ_SOURCE', 'supabase');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://vnmkupzptujtywnnabkp.supabase.co');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
const markup = () =>
  renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(SocialContentPage)));
const button = (html: string, label: string) =>
  html.match(new RegExp(`<button[^>]*>[^<]*${label}[^<]*</button>`))?.[0];

describe('editorial controls in the published production-mode DEV configuration', () => {
  it.each(['without-product', 'product-without-media', 'product-with-media'])(
    'explains durable product association for %s',
    (scenario) => {
      let id = 0;
      const item = createEditorialDraft(
        {
          copy: 'EDITORIAL TEST',
          callToAction: '',
          hashtags: '',
          channels: ['INSTAGRAM_FEED'],
          productId: scenario === 'without-product' ? '' : 'product',
          creativeAssetIds: scenario === 'product-with-media' ? ['image'] : [],
          campaignName: '',
          date: '',
        },
        new Date(),
        () => `fixture-${++id}`,
      )[0]!;
      const html = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          {},
          createElement(EditorialComposer, {
            item,
            products: [],
            busy: false,
            onSave: () => undefined,
            onClose: () => undefined,
          }),
        ),
      );
      expect(html.includes('Seleccionar un producto no conserva su asociación por sí solo')).toBe(
        scenario === 'product-without-media',
      );
      if (scenario === 'without-product')
        expect(html).toContain('Puedes guardar un borrador sin producto asociado');
    },
  );
  it('lets OWNER open creation and diagnostics during the initial library read', () => {
    const html = markup();
    expect(html).toContain('Cargando productos');
    for (const label of [
      'Crear contenido',
      'Consultar configuración server-side',
      'Verificar cuentas y permisos Meta',
    ]) {
      expect(button(html, label)).toBeDefined();
      expect(button(html, label)).not.toContain('disabled');
    }
    expect(button(html, 'Actualizar desde DEV')).toContain('disabled');
    expect(html).toContain('no publica contenido ni crea intentos');
  });
  it.each(['unauthorized', 'role', 'flag', 'project'])('keeps %s blocked', (reason) => {
    if (reason === 'unauthorized') operator.authorized = false;
    if (reason === 'role') operator.role = 'VIEWER';
    if (reason === 'flag') vi.stubEnv('VITE_EDITORIAL_DEV_SYNC_ENABLED', 'false');
    if (reason === 'project') vi.stubEnv('VITE_SUPABASE_URL', 'https://example.invalid');
    const html = markup();
    expect(button(html, 'Crear contenido')).toContain('disabled');
    expect(button(html, 'Verificar cuentas y permisos Meta')).toContain('disabled');
  });
  it('releases a pending read with its phase and ignores its late result', async () => {
    vi.useFakeTimers();
    let finish!: (value: string) => void;
    const read = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const result = editorialReadDeadline(read, 'la biblioteca editorial');
    const rejection = expect(result).rejects.toThrow(
      'la biblioteca editorial en DEV superó 15 segundos',
    );
    await vi.advanceTimersByTimeAsync(15000);
    await rejection;
    finish('late');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('returns successful reads and clears timers', async () => {
    vi.useFakeTimers();
    await expect(
      editorialReadDeadline(Promise.resolve('confirmed'), 'Product Master'),
    ).resolves.toBe('confirmed');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves runtime read errors instead of presenting local success', async () => {
    await expect(
      editorialReadDeadline(Promise.reject(new Error('OWNER_REQUIRED')), 'library'),
    ).rejects.toThrow('OWNER_REQUIRED');
  });
});

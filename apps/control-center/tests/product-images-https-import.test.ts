import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';

const fixtures = vi.hoisted(() => ({
  stateIndex: 0,
  updates: [] as unknown[],
  product: { id: 'product-fixture', name: 'Manual fixture', businessLine: 'BEAUTY_CARE' },
  images: [
    {
      id: 'image-fixture',
      isMain: true,
      publicUrl: 'https://example.invalid/existing.webp',
      sourceType: 'STORAGE',
      altText: 'Existing',
    },
  ],
  optimize: vi.fn(),
  importUrl: vi.fn(),
}));
// Exercise the real page event handlers without mounting auth effects or invoking any backend.
// Only the two loaded resources and loading state are seeded; updates are captured for assertions.
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffect: vi.fn(),
  // This handler-only harness has no app provider; navigation is covered in Chromium.
  useContext: () => null,
  useId: () => 'manual-intake-fixture',
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    const index = fixtures.stateIndex++;
    const value =
      index === 0
        ? fixtures.product
        : index === 1
          ? fixtures.images
          : initial === true
            ? false
            : initial;
    return [value, (next: unknown) => fixtures.updates.push(next)];
  },
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'product-fixture' }), Link: 'a' }));
vi.mock('../src/auth/auth-context', () => ({
  useAuth: () => ({
    enabled: true,
    authorized: true,
    user: { id: 'owner-fixture' },
    profile: { roleCode: 'OWNER' },
  }),
}));
vi.mock('../src/composition/products', () => ({
  productsComposition: {
    canReadImages: true,
    canUploadWebp: true,
    canManageImages: false,
  },
}));
vi.mock('../src/lib/product-image-webp', async (original) => ({
  ...(await original<typeof import('../src/lib/product-image-webp')>()),
  LIHEN_MAX_IMAGES: 10,
  optimizeProductImage: fixtures.optimize,
  imageFileFromUrl: fixtures.importUrl,
}));

import { ProductImagesPage } from '../src/pages/ProductImagesPage';

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join('');
  if (value && typeof value === 'object' && 'props' in value)
    return text((value as Node).props.children);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
function event(node: Node, name: string, value?: unknown) {
  return (node.props[name] as (event?: unknown) => unknown)(value);
}

beforeEach(() => {
  fixtures.stateIndex = 0;
  fixtures.updates = [];
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProductImagesPage HTTPS import block and manual intake', () => {
  it('disables the HTTPS controls and blocks forced handler calls without downloads or staging', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const tree = nodes(ProductImagesPage());
    const section = tree.find((node) => node.props['aria-labelledby'] === 'webp-url-title')!;
    const controls = nodes(section);
    const field = controls.find((node) => node.type === 'input')!;
    const button = controls.find((node) => node.type === 'button')!;
    expect(field.props.disabled).toBe(true);
    expect(button.props.disabled).toBe(true);
    const notice =
      'Importación por URL pendiente de verificación de identidad exacta y derechos comerciales';
    expect(text(section)).toContain(notice);
    await event(button, 'onClick');
    expect(fixtures.updates).toEqual([notice]);
    expect(fetch).not.toHaveBeenCalled();
    expect(fixtures.importUrl).not.toHaveBeenCalled();
    expect(fixtures.optimize).not.toHaveBeenCalled();
  });
  it.each(['file', 'drop', 'paste'])(
    'keeps %s manual conversion and the existing gallery functional',
    async (method) => {
      const source = new File(['manual'], 'own.png', { type: 'image/png' });
      const optimized = new File(['webp'], 'own.webp', { type: 'image/webp' });
      fixtures.optimize.mockResolvedValue({ file: optimized, originalBytes: source.size });
      const tree = nodes(ProductImagesPage());
      expect(
        tree.some(
          (node) => node.type === 'img' && node.props.src === fixtures.images[0]!.publicUrl,
        ),
      ).toBe(true);
      const group = tree.find((node) => node.props['aria-label'] === 'Arrastrar o pegar imágenes')!;
      if (method === 'file') {
        const field = nodes(group).find((node) => node.type === 'input' && node.props.multiple)!;
        expect(field.props.disabled).toBe(false);
        event(field, 'onChange', { target: { files: [source], value: 'own.png' } });
      } else if (method === 'drop') {
        event(group, 'onDrop', { preventDefault: vi.fn(), dataTransfer: { files: [source] } });
      } else {
        event(group, 'onPaste', { preventDefault: vi.fn(), clipboardData: { files: [source] } });
      }
      await vi.waitFor(() =>
        expect(
          fixtures.updates.some((update) => {
            if (typeof update !== 'function') return false;
            const value = update([]);
            return (
              Array.isArray(value) &&
              value[0]?.file === optimized &&
              /^[a-f0-9]{64}$/.test(value[0]?.key)
            );
          }),
        ).toBe(true),
      );
      expect(fixtures.optimize).toHaveBeenCalledWith(source);
      expect(fixtures.importUrl).not.toHaveBeenCalled();
    },
  );
});

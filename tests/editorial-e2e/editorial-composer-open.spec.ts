import { expect, test } from '@playwright/test';

test('OWNER clicks + Crear contenido and the real composer opens in view', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      external.push(url.href);
      return route.abort();
    }
    if (url.pathname === '/src/composition/inventory.ts') {
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'export const inventoryComposition = { getInventory: { execute: async () => [] } };',
      });
    }
    if (url.pathname === '/src/composition/products.ts') {
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'export const productsComposition = { source: "supabase", canReadImages: false, getProducts: { execute: async () => [] } };',
      });
    }
    if (
      url.pathname === '/src/composition/editorial-workspace.ts' &&
      !url.searchParams.has('actual')
    ) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'export * from "/src/composition/editorial-workspace.ts?actual"; export async function readEditorialWorkspace() { return []; }',
      });
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/tests/fixtures/editorial-page.html');
  const create = page.getByRole('button', { name: '+ Crear contenido', exact: true });
  await expect(create).toBeEnabled();
  await expect(
    page.getByText('Biblioteca editorial leída desde DEV.', { exact: true }),
  ).toBeVisible();
  await create.click();
  const composer = page.getByRole('region', { name: 'Crear contenido', exact: true });
  await expect(composer).toBeVisible();
  await expect(
    composer.getByRole('heading', { name: 'Crear contenido', exact: true }),
  ).toBeInViewport();
  await expect(composer.getByLabel('Producto a promocionar')).toBeFocused();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await composer.getByRole('button', { name: 'Cerrar editor' }).click();
  await expect(composer).toHaveCount(0);
  await create.click();
  await expect(page.getByRole('region', { name: 'Crear contenido', exact: true })).toBeVisible();
  await expect(page.getByLabel('Producto a promocionar')).toBeFocused();
});

test('existing draft reports unsupported product and confirms an edit after durable readback', async ({
  page,
}) => {
  const external: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      external.push(url.href);
      return route.abort();
    }
    if (url.pathname === '/src/composition/inventory.ts') {
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'export const inventoryComposition = { getInventory: { execute: async () => [] } };',
      });
    }
    if (url.pathname === '/src/composition/products.ts') {
      return route.fulfill({
        contentType: 'application/javascript',
        body: `
        export const productsComposition = { source: 'supabase', canReadImages: true,
          getProductImages: { execute: async () => [] },
          getProducts: { execute: async () => [{ id: 'rose', name: 'Agua de rosas', sku: 'BC-067',
            status: 'ACTIVE', salePrice: { amount: 10000, currency: 'COP' } }] } };
      `,
      });
    }
    if (
      url.pathname === '/src/composition/editorial-workspace.ts' &&
      !url.searchParams.has('actual')
    ) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: `
        export * from '/src/composition/editorial-workspace.ts?actual';
        import * as actual from '/src/composition/editorial-workspace.ts?actual';
        let row = { id: 'existing', campaign_id: 'campaign', campaign_content_id: 'content',
          channel_variant_id: 'variant', schedule_id: null, channel: 'INSTAGRAM_FEED',
          copy: 'Borrador original', cta: '', hashtags: [], creative_asset_ids: [],
          status: 'PREPARED', prepared_at: '2026-10-01T12:00:00.000Z' };
        const client = { functions: { invoke: async (_, { body: { action, payload } }) => {
          if (action === 'SAVE_PREPARED_PUBLICATION') {
            row = { ...row, copy: payload.copy, cta: payload.callToAction,
              hashtags: payload.hashtags, creative_asset_ids: payload.creativeAssetIds };
            return { data: { data: [row], externalPublication: false }, error: null };
          }
          if (action !== 'READ_EDITORIAL_WORKSPACE') throw new Error('Unexpected action');
          return { data: { data: { publications: [row], schedules: [], attempts: [] },
            externalPublication: false }, error: null };
        } } };
        export const readEditorialWorkspace = (_, id) => actual.readEditorialWorkspace(client, id);
        export const saveEditorialItemInDev = (item, _, resolve) => actual.saveEditorialItemInDev(item, client, resolve);
      `,
      });
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/tests/fixtures/editorial-page.html');
  await page.getByRole('button', { name: /Borrador original/ }).click();
  await page.getByRole('button', { name: 'Editar borrador', exact: true }).click();
  const composer = page.getByRole('region', { name: 'Editar borrador', exact: true });
  await composer.getByLabel(/Copy \/ caption/).fill('Borrador editado');
  await composer.getByRole('combobox', { name: 'Producto a promocionar' }).click();
  await composer.getByRole('option', { name: /Agua de rosas/ }).click();
  await composer.getByRole('button', { name: 'Guardar borrador' }).click();
  const error = page.getByRole('alert').filter({ hasText: 'DEV no conserva el producto' });
  await expect(error).toBeInViewport();
  await expect(composer).toBeVisible();
  await composer.getByRole('combobox', { name: 'Producto a promocionar' }).click();
  await composer.getByRole('option', { name: 'Sin producto asociado', exact: true }).click();
  await composer.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(composer).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Guardado en DEV.' })).toBeInViewport();
  await page.getByRole('button', { name: 'Actualizar desde DEV' }).click();
  await expect(page.getByRole('button', { name: /Borrador editado/ })).toBeVisible();
  expect(external).toEqual([]);
});

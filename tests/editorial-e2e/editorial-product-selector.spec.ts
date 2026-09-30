import { expect, test } from '@playwright/test';

const products = [
  {
    id: 'durable-product-1',
    name: 'Crema facial',
    sku: 'CARE-001',
    status: 'ACTIVE',
    salePrice: { amount: 25000, currency: 'COP' },
  },
  {
    id: 'durable-product-2',
    name: 'Labial rojo',
    sku: 'LIP-002',
    status: 'ACTIVE',
    salePrice: { amount: 18000, currency: 'COP' },
  },
  {
    id: 'durable-product-3',
    name: 'Serum',
    sku: 'SER-003',
    status: 'ACTIVE',
    salePrice: { amount: 20000, currency: 'COP' },
  },
  {
    id: 'durable-product-4',
    name: 'Balsamo',
    sku: 'BAL-004',
    status: 'ACTIVE',
    salePrice: { amount: 15000, currency: 'COP' },
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') throw new Error(`Unexpected external request: ${url.origin}`);
    const fulfill = (body: string) =>
      route.fulfill({ contentType: 'application/javascript', body });
    if (url.pathname === '/src/composition/products.ts')
      return fulfill(`
      export const productsComposition = { source: 'supabase', canReadImages: true,
        getProducts: { execute: async () => ${JSON.stringify(products)} },
        getProductImages: { execute: async ({productId}) => [{ id: 'image-' + productId, publicUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E', altText: 'Media ' + productId }] }
      };`);
    if (url.pathname === '/src/composition/inventory.ts')
      return fulfill(
        `export const inventoryComposition = { getInventory: { execute: async () => [{ productId: 'durable-product-1', stockAvailable: 0 }, { productId: 'durable-product-2', stockAvailable: 8 }, { productId: 'durable-product-3', stockAvailable: 0 }, { productId: 'durable-product-4', stockAvailable: 3 }] } };`,
      );
    if (
      url.pathname === '/src/composition/editorial-video-assets.ts' &&
      !url.searchParams.has('actual')
    )
      return fulfill(
        `export * from '/src/composition/editorial-video-assets.ts?actual'; export async function readEditorialVideoAssets(productId) { return [{id: 'video-' + productId, mimeType: 'video/mp4'}]; }`,
      );
    if (
      url.pathname === '/src/composition/editorial-workspace.ts' &&
      !url.searchParams.has('actual')
    )
      return fulfill(`
      export * from '/src/composition/editorial-workspace.ts?actual';
      export async function readEditorialWorkspace() { return []; }
      export async function saveEditorialItemInDev(item) { document.body.dataset.saved = JSON.stringify(item); return item; }
    `);
    return route.continue();
  });
  await page.goto('/tests/fixtures/editorial-page.html');
  await page.getByRole('button', { name: '+ Crear contenido', exact: true }).click();
});

test('catalog opens without typing a SKU and supports name and SKU filters', async ({ page }) => {
  const selector = page.getByRole('combobox', { name: 'Producto a promocionar' });
  await selector.click();
  await expect(selector).toHaveValue('');
  await expect(
    page.getByRole('listbox', { name: 'Productos disponibles' }).getByRole('option'),
  ).toHaveText([
    'Sin producto asociado',
    'Labial rojo · LIP-002 · Stock: 8',
    'Balsamo · BAL-004 · Stock: 3',
    'Crema facial · CARE-001 · Sin stock',
    'Serum · SER-003 · Sin stock',
  ]);
  await expect(page.getByRole('option', { name: 'Crema facial · CARE-001' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Labial rojo · LIP-002' })).toBeVisible();
  await selector.fill('crema');
  await expect(page.getByRole('option', { name: 'Crema facial · CARE-001' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Labial rojo · LIP-002' })).toHaveCount(0);
  await selector.fill('lip-002');
  await expect(page.getByRole('option', { name: 'Labial rojo · LIP-002' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Crema facial · CARE-001' })).toHaveCount(0);
  await selector.press('ArrowDown');
  await selector.press('Enter');
  await expect(selector).toHaveValue('Labial rojo · LIP-002');
  await selector.fill('no-match');
  await expect(
    page.getByRole('status').filter({ hasText: 'No hay productos que coincidan' }),
  ).toBeVisible();
  await selector.press('Escape');
  await expect(selector).toHaveValue('Labial rojo · LIP-002');
});

test('zero stock warns without blocking a draft and preserves durable product and image IDs', async ({
  page,
}) => {
  await page.getByRole('combobox', { name: 'Producto a promocionar' }).click();
  await expect(
    page.getByRole('option', { name: 'Crema facial · CARE-001 · Sin stock', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('option', { name: 'Crema facial · CARE-001 · Sin stock', exact: true })
    .click();
  await expect(page.getByText('Inventario disponible: 0', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText(
    'Sin inventario disponible. Puedes guardar el borrador editorial; revisa las existencias antes de promocionar.',
  );
  await page.getByLabel('Usar imagen').check();
  await page.getByLabel(/Copy \/ caption/).fill('Contenido de prueba');
  await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled();
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-saved',
    /"productId":"durable-product-1"/,
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-saved',
    /"creativeAssetIds":\["image-durable-product-1"\]/,
  );
});

test('changing product reloads images and videos and clears media across channels', async ({
  page,
}) => {
  const selector = page.getByRole('combobox', { name: 'Producto a promocionar' });
  await selector.click();
  await page.getByRole('option', { name: 'Crema facial · CARE-001' }).click();
  await page.getByLabel('Usar imagen').check();
  await page.getByRole('checkbox', { name: 'Facebook', exact: true }).check();
  await expect(page.getByLabel('Usar imagen')).toBeChecked();
  await page.getByRole('checkbox', { name: 'TikTok', exact: true }).check();
  await page.getByLabel('Video autorizado').selectOption('video-durable-product-1');
  await selector.click();
  await page.getByRole('option', { name: 'Labial rojo · LIP-002' }).click();
  await expect(
    page.getByLabel('Video autorizado').locator('option', { hasText: 'video-durable-product-2' }),
  ).toHaveCount(1);
  await expect(page.getByLabel('Video autorizado')).toHaveValue('');
  await expect(
    page.getByLabel('Video autorizado').locator('option', { hasText: 'video-durable-product-1' }),
  ).toHaveCount(0);
  await expect(page.getByText('Inventario disponible: 8', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  for (const channel of ['Facebook', 'Instagram Feed']) {
    await page.getByRole('button', { name: channel, exact: true }).click();
    await expect(page.getByAltText('Media durable-product-2')).toBeVisible();
    await expect(page.getByAltText('Media durable-product-1')).toHaveCount(0);
    await expect(page.getByLabel('Usar imagen')).not.toBeChecked();
  }
});

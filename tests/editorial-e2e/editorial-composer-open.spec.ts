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

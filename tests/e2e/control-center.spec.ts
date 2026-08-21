import { expect, test } from '@playwright/test';

test('opens LIHEN Control Center', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('LIHEN CONTROL CENTER').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('loads the Product Read Slice through the in-memory repository', async ({ page }) => {
  await page.goto('/products');

  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
  await expect(page.getByText('Producto demo Beauty Care')).toBeVisible();
  await expect(page.getByText('Producto demo Style')).toBeVisible();
  await expect(page.getByText('Fuente: repositorio en memoria')).toBeVisible();
});

test('opens a product detail through GetProductById', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('link', { name: 'Producto demo Beauty Care' }).click();

  await expect(page).toHaveURL(/\/products\/demo-bc-080$/);
  await expect(page.getByRole('heading', { name: 'Detalle de producto' })).toBeVisible();
  await expect(page.getByText('BC-080')).toBeVisible();
  await expect(page.getByText('LIHEN-DEMO-080')).toBeVisible();
  await expect(page.getByText('repositorio en memoria')).toBeVisible();
});

test('renders product not found without leaking infrastructure details', async ({ page }) => {
  await page.goto('/products/not-real');

  await expect(page.getByText('Producto no encontrado.')).toBeVisible();
  await expect(page.getByText(/Supabase error/i)).toHaveCount(0);
});


test('creates a product only through the in-memory command slice', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('link', { name: 'Nuevo producto' }).click();

  await expect(page.getByRole('heading', { name: 'Crear producto' })).toBeVisible();
  await page.getByLabel('Nombre *').fill('Producto creado en memoria');
  await page.getByLabel('SKU').fill('BC-999');
  await page.getByLabel('Código catálogo').fill('LIHEN-DEMO-999');
  await page.getByLabel('Precio de venta (COP) *').fill('59000');
  await page.getByRole('button', { name: 'Crear producto' }).click();

  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);
  await expect(page.getByText('Producto creado en memoria')).toBeVisible();
  await expect(page.getByText('BC-999')).toBeVisible();
  await expect(page.getByText('LIHEN-DEMO-999')).toBeVisible();
});


test('updates a product only through the in-memory command slice', async ({ page }) => {
  await page.goto('/products/demo-bc-080');
  await page.getByRole('link', { name: 'Editar producto' }).click();

  await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();
  await page.getByLabel('Nombre *').fill('Producto demo Beauty Care actualizado');
  await page.getByLabel('SKU').fill('BC-081');
  await page.getByLabel('Código catálogo').fill('LIHEN-DEMO-081');
  await page.getByLabel('Estado').selectOption('INACTIVE');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(page).toHaveURL(/\/products\/demo-bc-080$/);
  await expect(page.getByText('Producto demo Beauty Care actualizado')).toBeVisible();
  await expect(page.getByText('BC-081')).toBeVisible();
  await expect(page.getByText('LIHEN-DEMO-081')).toBeVisible();
});


test('changes sale price through the historical command slice', async ({ page }) => {
  await page.goto('/products/demo-bc-080');
  await page.getByRole('link', { name: 'Cambiar precio' }).click();

  await expect(page.getByRole('heading', { name: 'Cambiar precio de venta' })).toBeVisible();
  await page.getByLabel('Nuevo precio de venta (COP) *').fill('31000');
  await page.getByLabel('Motivo del cambio *').fill('Ajuste comercial aprobado');
  await page.getByRole('button', { name: 'Cambiar precio' }).click();

  await expect(page).toHaveURL(/\/products\/demo-bc-080$/);
  await expect(page.getByText(/31\.000/).first()).toBeVisible();
  await expect(page.getByText('Ajuste comercial aprobado')).toBeVisible();
});

test('manages product images only through the in-memory image command slice', async ({ page }) => {
  await page.goto('/products/demo-bc-080');
  await page.getByRole('link', { name: 'Imágenes' }).click();

  await expect(page.getByRole('heading', { name: 'Imágenes del producto' })).toBeVisible();
  await page.getByLabel('URL pública de imagen *').fill('https://example.com/product-a.jpg');
  await page.getByLabel('Texto alternativo').fill('Vista frontal');
  await page.getByRole('button', { name: 'Agregar imagen' }).click();
  await expect(page.getByText('Principal')).toBeVisible();

  await page.getByLabel('URL pública de imagen *').fill('https://example.com/product-b.jpg');
  await page.getByLabel('Texto alternativo').fill('Vista posterior');
  await page.getByRole('button', { name: 'Agregar imagen' }).click();
  await page.getByRole('button', { name: 'Hacer principal' }).click();

  await expect(page.getByText('Principal')).toHaveCount(1);
  await expect(page.getByText('Vista frontal')).toBeVisible();
  await expect(page.getByText('Vista posterior')).toBeVisible();
});

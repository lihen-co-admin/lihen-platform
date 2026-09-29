import { expect, test } from '@playwright/test';

test('selects a durable TikTok video and rehydrates its product with local doubles', async ({
  page,
}) => {
  const external: string[] = [];
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') {
      external.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await page.goto('/tests/fixtures/editorial-operations.html?mode=video');
  const select = page.getByLabel('Video autorizado');
  await expect(select.locator('option', { hasText: 'durable-video' })).toHaveCount(1);
  await select.selectOption('durable-video');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-saved-video', 'durable-video');
  await expect(page.locator('body')).toHaveAttribute('data-restored-product', 'product');
  expect(external).toEqual([]);
});

test('never defaults TikTok privacy/consent and requires reassessment after choices', async ({
  page,
}) => {
  const external: string[] = [];
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') {
      external.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await page.goto('/tests/fixtures/editorial-operations.html?mode=tiktok');
  await expect(page.getByLabel('Privacidad')).toHaveCount(0);
  await page.getByRole('button', { name: 'Consultar creador TikTok' }).click();
  await expect(page.getByLabel('Privacidad')).toHaveValue('');
  const consent = page.getByLabel('Consiento esta publicación de prueba');
  await expect(consent).not.toBeChecked();
  await expect(consent).toBeDisabled();
  await page.getByLabel('Privacidad').selectOption('SELF_ONLY');
  await expect(consent).toBeDisabled();
  await expect(page.getByLabel('Interacción de prueba')).toHaveValue('');
  await expect(page.getByLabel('Interacción restringida')).toBeDisabled();
  await page.getByLabel('Interacción de prueba').selectOption('false');
  await consent.check();
  await expect(page.getByRole('button', { name: 'Crear intento pendiente' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Evaluar estado actual en servidor' }).click();
  await expect(page.getByRole('button', { name: 'Crear intento pendiente' })).toBeDisabled();
  await page.getByLabel('Apruebo crear este intento sin publicar.').check();
  await page.getByRole('button', { name: 'Crear intento pendiente' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-refreshed',
    'EXECUTE_PUBLICATION_ATTEMPT',
  );
  expect(external).toEqual([]);
});

test('requires two separate human confirmations and never sends a network operation', async ({
  page,
}) => {
  const external: string[] = [];
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') {
      external.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await page.goto('/tests/fixtures/editorial-operations.html');
  await expect(page.getByRole('heading', { name: 'Operación gobernada DEV' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Evaluar estado actual en servidor' }).click();
  const create = page.getByRole('button', { name: 'Crear intento pendiente' });
  await expect(create).toBeDisabled();
  await page.getByRole('checkbox').check();
  await create.click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-refreshed',
    'EXECUTE_PUBLICATION_ATTEMPT',
  );
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-calls', '2');
  await page.getByRole('button', { name: 'Evaluar estado actual en servidor' }).click();
  const execute = page.getByRole('button', { name: 'Ejecutar publicación aprobada' });
  await expect(execute).toBeDisabled();
  await page.getByRole('checkbox').check();
  await execute.click();
  await expect(page.locator('body')).toHaveAttribute('data-refreshed', 'DONE');
  await page.getByRole('button', { name: 'Evaluar estado actual en servidor' }).click();
  await expect(page.getByText(/Hay intentos terminales/)).toBeVisible();
  await expect(execute).toHaveCount(0);
  await expect(create).toHaveCount(0);
  expect(external).toEqual([]);
});

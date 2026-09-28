import { expect, test } from '@playwright/test';

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

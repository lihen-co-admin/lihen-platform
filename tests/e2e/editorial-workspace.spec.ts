import { expect, test } from '@playwright/test';

test('requires authenticated durable DEV before opening the editorial composer', async ({
  page,
}) => {
  const externalRequests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      externalRequests.push(route.request().url());
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto('/content/social');
  await expect(page.getByRole('heading', { name: 'Contenido y calendario' })).toBeVisible();
  await expect(page.getByText(/Conecta el Control Center a Supabase DEV/)).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Crear contenido' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /PUBLICAR PRUEBA REAL/ })).toHaveCount(0);
  await expect(page.getByText(/Producto demo/)).toHaveCount(0);
  expect(externalRequests).toEqual([]);
  await page.screenshot({ path: 'test-results/editorial-dev-required.png', fullPage: true });
});

test('WhatsApp preparation never exposes sending', async ({ page }) => {
  await page.goto('/conversations');
  await expect(page.getByRole('heading', { name: 'Conversaciones / WhatsApp' })).toBeVisible();
  await page
    .getByLabel('Respuesta sugerida')
    .fill('Hola, revisaremos la disponibilidad antes de confirmar.');
  await page.getByRole('button', { name: 'Preparar revisión' }).click();
  await page.getByRole('button', { name: 'Marcar revisada en esta sesión' }).click();
  await expect(page.getByRole('status')).toContainText('APPROVED · Sin enviar');
  await expect(page.getByRole('button', { name: 'Enviar WhatsApp · bloqueado' })).toBeDisabled();
});

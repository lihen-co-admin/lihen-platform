import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') {
      await route.abort();
      throw new Error('External network forbidden in scheduling UX test');
    }
    await route.continue();
  });
});
async function approve(page: import('@playwright/test').Page, mode = '') {
  await page.goto('/tests/fixtures/editorial-scheduling.html?mode=' + mode);
  await expect(page.getByRole('button', { name: 'Confirmar programación editorial' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await page.getByRole('button', { name: 'Aprobar contenido' }).click();
}
test('approval, explicit date confirmation, durable confirmation and no execution', async ({
  page,
}) => {
  await approve(page);
  const submit = page.getByRole('button', { name: 'Confirmar programación editorial' });
  const consent = page.getByRole('checkbox');
  await expect(submit).toBeDisabled();
  await expect(consent).not.toBeChecked();
  await page.getByLabel('Fecha y hora · America/Bogota', { exact: true }).fill('2026-09-30T23:30');
  await expect(submit).toBeDisabled();
  await consent.check();
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(page.getByText('Sin programación confirmada', { exact: true })).toBeVisible();
  await expect(page.getByText('Programado editorialmente · APPROVED', { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Simular confirmación durable' }).click();
  await expect(
    page.getByText('Programado editorialmente · APPROVED', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('30/09/2026, 23:30', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Intentos')).toHaveText('0');
  await expect(page.locator('body')).toHaveAttribute('data-schedule-calls', '1');
  await expect(
    page.getByText(
      'La ejecución externa automática continúa desactivada. Programar no crea intentos ni publica en Instagram, Facebook o TikTok.',
      { exact: true },
    ),
  ).toBeVisible();
});
test('date changes invalidate confirmation and past dates cannot be scheduled', async ({
  page,
}) => {
  await approve(page);
  const date = page.getByLabel('Fecha y hora · America/Bogota', { exact: true });
  const submit = page.getByRole('button', { name: 'Confirmar programación editorial' });
  await date.fill('2026-09-28T10:30');
  await expect(page.getByRole('alert')).toContainText('futuras');
  await expect(page.getByRole('checkbox')).toBeDisabled();
  await date.fill('2026-09-30T10:30');
  await page.getByRole('checkbox').check();
  await expect(submit).toBeEnabled();
  await date.fill('2026-10-01T10:30');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(submit).toBeDisabled();
});
test('failed persistence leaves scheduling unconfirmed without automatic retry', async ({
  page,
}) => {
  await approve(page, 'failure');
  await page.getByLabel('Fecha y hora · America/Bogota', { exact: true }).fill('2026-09-30T10:30');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Confirmar programación editorial' }).click();
  await expect(page.getByRole('alert')).toContainText('DEV no confirmó');
  await expect(page.getByText('Sin programación confirmada', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirmar programación editorial' }),
  ).toBeDisabled();
  await expect(page.locator('body')).toHaveAttribute('data-schedule-calls', '1');
  await expect(page.getByLabel('Intentos')).toHaveText('0');
});

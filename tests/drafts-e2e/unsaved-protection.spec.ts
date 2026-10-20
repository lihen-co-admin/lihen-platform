import { expect, test } from '@playwright/test';

const base = '/tests/drafts-browser/protection.html#';
test('editorial proposed date remains available after cancelled navigation', async ({ page }) => {
  await page.goto(base + '/schedule');
  const date = page.locator('input[type="datetime-local"]');
  await date.fill('2030-12-20T12:00');
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir trabajando' }).click();
  await expect(date).toHaveValue('2030-12-20T12:00');
});
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
});

test('real purchase cost-only edit blocks navigation and discards only explicitly', async ({
  page,
}) => {
  await page.goto(base + '/purchases');
  const cost = page.getByLabel('Costo cotizado unitario');
  await cost.fill('0');
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Seguir trabajando' }).click();
  await expect(cost).toHaveValue('0');
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar y salir' }).click();
  await expect(page.getByRole('heading', { name: 'Otro módulo' })).toBeVisible();
});

test('real supplier contact warns on reload and remains only in memory', async ({ page }) => {
  await page.goto(base + '/suppliers');
  const contact = page.getByLabel('Contacto', { exact: true });
  await contact.fill('Contacto privado de prueba');
  const dialog = page.waitForEvent('dialog');
  // A cancelled reload does not reach load; bound that expected wait separately.
  const reload = page.reload({ timeout: 2000 }).catch(() => null);
  const warning = await dialog;
  expect(warning.type()).toBe('beforeunload');
  await warning.dismiss();
  await reload;
  await expect(contact).toHaveValue('Contacto privado de prueba');
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain('Contacto privado');
});

test('browser back is blocked without unmounting the pending form', async ({ page }) => {
  await page.goto(base + '/other');
  await page.getByRole('link', { name: 'Trabajo', exact: true }).click();
  await page.getByLabel('Trabajo pendiente').fill('No perder');
  await page.evaluate(() => history.back());
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Seguir trabajando' }).click();
  await expect(page.getByLabel('Trabajo pendiente')).toHaveValue('No perder');
  await expect(page).toHaveURL(/#\/work$/);
});

test('same-identity revalidation keeps work; another identity clears it', async ({ page }) => {
  await page.goto(base + '/work');
  await page.getByLabel('Trabajo pendiente').fill('Solo usuario A');
  await page.getByRole('button', { name: 'Renovar sesión aislada' }).click();
  await expect(page.getByLabel('Trabajo pendiente')).toHaveValue('Solo usuario A');
  await page.getByRole('button', { name: 'Cambio externo de usuario' }).click();
  await expect(page.getByLabel('Trabajo pendiente')).toHaveValue('');
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('logout can be cancelled; explicit logout clears memory', async ({ page }) => {
  await page.goto(base + '/work');
  await page.getByLabel('Trabajo pendiente').fill('Pendiente');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByLabel('Trabajo pendiente')).toHaveValue('Pendiente');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByLabel('Trabajo pendiente')).toHaveCount(0);
});

test('successful save clears warning; a failed save retains it', async ({ page }) => {
  await page.goto(base + '/work');
  await page.getByLabel('Trabajo pendiente').fill('Guardar');
  await page.getByRole('button', { name: 'Guardar aislado', exact: true }).click();
  await expect(page.getByLabel('Escrituras')).toHaveText('1');
  await page.getByRole('button', { name: 'Navegación programática' }).click();
  await expect(page.getByRole('heading', { name: 'Otro módulo' })).toBeVisible();
  await page.getByRole('link', { name: 'Trabajo', exact: true }).click();
  await page.getByLabel('Trabajo pendiente').fill('Fallo');
  await page.getByLabel('Fallar guardado').check();
  await page.getByRole('button', { name: 'Guardar aislado', exact: true }).click();
  await expect(page.getByLabel('Escrituras')).toHaveText('0');
  await page.getByRole('button', { name: 'Navegación programática' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('navigation and renewal never submit a write', async ({ page }) => {
  let writes = 0;
  page.on('request', (request) => {
    if (request.method() !== 'GET') writes++;
  });
  await page.goto(base + '/purchases');
  await page.getByLabel('Costo cotizado unitario').fill('1500');
  await page.getByRole('button', { name: 'Renovar sesión aislada' }).click();
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar y salir' }).click();
  expect(writes).toBe(0);
});

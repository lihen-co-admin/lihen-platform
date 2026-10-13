import { expect, test, type Page } from '@playwright/test';

const url = '/tests/drafts-browser/index.html#/products/product-a/edit';
const name = (page: Page) => page.getByLabel('Nombre *', { exact: true });
const restore = (page: Page) => page.getByRole('button', { name: 'Restaurar borrador local' });
test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  page.on('dialog', (dialog) => dialog.accept());
  await page.route('**/__draft_test__/write', (route) =>
    route.fulfill({ json: { committed: true, fail: false } }),
  );
});

test('reproduces state loss when draft preservation is disabled', async ({ page }) => {
  await page.goto(url.replace('index.html#', 'index.html?drafts=off#'));
  await name(page).fill('Sin guardar');
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await page.goBack();
  await expect(name(page)).toHaveValue('Producto original');
});

test('navigation, browser back and refresh preserve drafts with explicit restoration', async ({
  page,
}) => {
  await page.goto(url);
  await name(page).fill('Borrador conservado');
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Otro m\u00f3dulo' })).toBeVisible();
  await page.goBack();
  await restore(page).click();
  await expect(name(page)).toHaveValue('Borrador conservado');
  const unload = page.waitForEvent('dialog');
  await page.reload();
  expect((await unload).type()).toBe('beforeunload');
  await expect(name(page)).toHaveValue('Producto original');
  await restore(page).click();
  await expect(name(page)).toHaveValue('Borrador conservado');
});

test('confirmed write and readback clear the local draft', async ({ page }) => {
  await page.goto(url);
  await name(page).fill('Guardado confirmado');
  await page.getByRole('button', { name: 'Guardar Product Master' }).click();
  await expect(page.getByRole('heading', { name: 'Otro módulo' })).toBeVisible();
  await page.getByRole('link', { name: 'Editar A' }).click();
  await expect(name(page)).toHaveValue('Guardado confirmado');
  await expect(restore(page)).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('lihen:dev:form-draft:')),
    ),
  ).toEqual([]);
});

test('lost response reload reuses one stable operation; no automatic writes', async ({ page }) => {
  const keys: string[] = [];
  await page.route('**/__draft_test__/write', (route) => {
    keys.push(JSON.parse(route.request().postData()!).operationKey);
    return route.fulfill({ json: { committed: keys.length > 1, fail: keys.length === 1 } });
  });
  await page.goto(url);
  await name(page).fill('Respuesta incierta');
  await page.getByRole('button', { name: 'Guardar Product Master' }).click();
  await expect(page.getByRole('button', { name: 'Verificar guardado pendiente' })).toBeVisible();
  await page.reload();
  await restore(page).click();
  expect(keys).toHaveLength(1);
  await expect(name(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Guardar Product Master' }).click();
  await expect(page.getByRole('heading', { name: 'Otro módulo' })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test('uncertain committed write is reconciled by readback without another write', async ({
  page,
}) => {
  let writes = 0;
  await page.route('**/__draft_test__/write', (route) => {
    writes++;
    return route.fulfill({ json: { committed: true, fail: true } });
  });
  await page.goto(url);
  await name(page).fill('Confirmar después');
  await page.getByRole('button', { name: 'Guardar Product Master' }).click();
  await page.reload();
  await restore(page).click();
  await page.getByRole('button', { name: 'Verificar guardado pendiente' }).click();
  await expect(page.getByRole('heading', { name: 'Otro módulo' })).toBeVisible();
  expect(writes).toBe(1);
});

test('logout hides inputs, isolates users, and preserves same-user recovery', async ({ page }) => {
  await page.goto(url);
  await name(page).fill('Solo usuario A');
  await page.getByRole('button', { name: 'Cerrar sesión de prueba' }).click();
  await expect(name(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Usuario B', exact: true }).click();
  await expect(name(page)).toHaveValue('Producto original');
  await expect(restore(page)).toHaveCount(0);
  await name(page).fill('Solo usuario B');
  await page.getByRole('button', { name: 'Usuario A', exact: true }).click();
  await restore(page).click();
  await expect(name(page)).toHaveValue('Solo usuario A');
});

test('entity scope and authorization teardown do not overwrite another draft', async ({ page }) => {
  await page.goto(url);
  await name(page).fill('Entidad A');
  await page.getByRole('button', { name: 'Simular autorización' }).click();
  await restore(page).click();
  await expect(name(page)).toHaveValue('Entidad A');
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await page.getByRole('link', { name: 'Editar B' }).click();
  await expect(name(page)).toHaveValue('Producto original');
  await expect(restore(page)).toHaveCount(0);
});

test('RPC success without matching readback preserves the draft as uncertain', async ({ page }) => {
  await page.route('**/__draft_test__/write', (route) =>
    route.fulfill({ json: { committed: true, fail: false, staleReadback: true } }),
  );
  await page.goto(url);
  await name(page).fill('Falta evidencia');
  await page.getByRole('button', { name: 'Guardar Product Master' }).click();
  await expect(page.getByRole('button', { name: 'Verificar guardado pendiente' })).toBeVisible();
  await page.reload();
  await restore(page).click();
  await expect(name(page)).toHaveValue('Falta evidencia');
});

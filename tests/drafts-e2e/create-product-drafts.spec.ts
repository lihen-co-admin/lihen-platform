import { expect, test, type Page } from '@playwright/test';

const url = '/tests/drafts-browser/index.html#/products/new';
const name = (page: Page) => page.getByLabel('Nombre *', { exact: true });
const price = (page: Page) => page.getByLabel('Precio de venta (COP) *', { exact: true });
const create = (page: Page) =>
  page.getByRole('button', { name: 'Crear Product Master', exact: true });
const restore = (page: Page) => page.getByRole('button', { name: 'Restaurar borrador local' });
const verify = (page: Page) => page.getByRole('button', { name: 'Verificar creación pendiente' });
test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  page.on('dialog', (dialog) => dialog.accept());
  await page.route('**/__draft_test__/create', (route) =>
    route.fulfill({ json: { committed: true, fail: false } }),
  );
});

test('navigation, bare create route and reload recover the same provisional draft, excluding price', async ({
  page,
}) => {
  await page.goto(url);
  await name(page).fill('Creación conservada');
  await price(page).fill('7000');
  const initialUrl = page.url();
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await page.getByRole('link', { name: 'Crear producto', exact: true }).click();
  await expect(page).toHaveURL(initialUrl);
  await restore(page).click();
  await expect(name(page)).toHaveValue('Creación conservada');
  await expect(price(page)).toHaveValue('');
  await page.reload();
  await expect(name(page)).toHaveValue('');
  await restore(page).click();
  await expect(name(page)).toHaveValue('Creación conservada');
  const records = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('lihen:dev:form-draft:'))
      .map((key) => JSON.parse(localStorage.getItem(key)!)),
  );
  expect(records).toHaveLength(1);
  expect(records[0].value).not.toHaveProperty('salePrice');
  expect(records[0].value).not.toHaveProperty('price');
});

test('authorization teardown and logout keep drafts isolated between users', async ({ page }) => {
  await page.goto(url);
  await name(page).fill('Creación de A');
  await page.getByRole('button', { name: 'Simular autorización' }).click();
  await restore(page).click();
  await expect(name(page)).toHaveValue('Creación de A');
  await page.getByRole('button', { name: 'Cerrar sesión de prueba' }).click();
  await expect(name(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Usuario B', exact: true }).click();
  await expect(name(page)).toHaveValue('');
  await expect(restore(page)).toHaveCount(0);
  await name(page).fill('Creación de B');
  await page.getByRole('button', { name: 'Usuario A', exact: true }).click();
  await restore(page).click();
  await expect(name(page)).toHaveValue('Creación de A');
});

test('different provisional identities retain independent drafts in the shared registry', async ({
  page,
}) => {
  await page.goto(url);
  await name(page).fill('Identidad uno');
  const firstUrl = page.url();
  await page.getByRole('button', { name: 'Iniciar otra creación' }).click();
  await expect(name(page)).toHaveValue('');
  await name(page).fill('Identidad dos');
  expect(page.url()).not.toBe(firstUrl);
  await page.getByRole('link', { name: /^Recuperar creación / }).click();
  await restore(page).click();
  await expect(name(page)).toHaveValue('Identidad uno');
});

test('restored deleted brand and incompatible category are blocked before creation', async ({
  page,
}) => {
  let writes = 0;
  await page.route('**/__draft_test__/create', (route) => {
    writes++;
    return route.fulfill({ json: { committed: true, fail: false } });
  });
  await page.goto(url);
  await name(page).fill('Taxonomía antigua');
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith('lihen:dev:form-draft:'))!;
    const record = JSON.parse(localStorage.getItem(key)!);
    record.value.brandId = 'deleted';
    record.value.categoryId = 'deleted';
    localStorage.setItem(key, JSON.stringify(record));
  });
  await page.reload();
  await restore(page).click();
  await price(page).fill('100');
  await expect(page.getByRole('alert').filter({ hasText: 'marca restaurada' })).toBeVisible();
  await expect(create(page)).toBeDisabled();
  expect(writes).toBe(0);
});

test('uncertain uncommitted creation never sends a retry or changes operation identity', async ({
  page,
}) => {
  let writes = 0;
  await page.route('**/__draft_test__/create', (route) => {
    writes++;
    return route.fulfill({ json: { committed: false, fail: true } });
  });
  await page.goto(url);
  await name(page).fill('Resultado incierto');
  await price(page).fill('100');
  await create(page).click();
  await expect(verify(page)).toBeVisible();
  const identity = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((key) => key.startsWith('lihen:dev:form-draft:'))!,
        )!,
      ).operation.key,
  );
  const initialUrl = page.url();
  await page.reload();
  await restore(page).click();
  await price(page).fill('100');
  await expect(create(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Iniciar otra creación' })).toBeDisabled();
  await verify(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'no se reenviará' })).toBeVisible();
  await page.getByRole('link', { name: 'Otro módulo', exact: true }).click();
  await page.getByRole('link', { name: 'Crear producto', exact: true }).click();
  await expect(page).toHaveURL(initialUrl);
  expect(writes).toBe(1);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((key) => key.startsWith('lihen:dev:form-draft:'))!,
          )!,
        ).operation.key,
    ),
  ).toBe(identity);
});

test('lost committed response reconciles exact ID and reentered price without another create', async ({
  page,
}) => {
  let writes = 0;
  let sentId = '';
  await page.route('**/__draft_test__/create', (route) => {
    writes++;
    sentId = route.request().postDataJSON().id;
    return route.fulfill({ json: { committed: true, fail: true } });
  });
  await page.goto(url);
  await name(page).fill('Creado sin respuesta');
  await price(page).fill('100');
  await create(page).click();
  await expect(verify(page)).toBeVisible();
  await page.reload();
  await restore(page).click();
  await price(page).fill('999');
  await verify(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'no se reenviará' })).toBeVisible();
  await price(page).fill('100');
  await verify(page).click();
  await expect(page).toHaveURL(new RegExp('/products/' + sentId + '$'));
  expect(writes).toBe(1);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('lihen:dev:form-draft:')),
    ),
  ).toEqual([]);
});

test('confirmed creation reads back before clearing the draft', async ({ page }) => {
  await page.goto(url);
  await name(page).fill('Creación confirmada');
  await price(page).fill('100');
  await create(page).click();
  await expect(page.getByRole('heading', { name: 'Otro módulo' })).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('lihen:dev:form-draft:')),
    ),
  ).toEqual([]);
});

test('a returned creation without readback evidence keeps the draft and blocks another write', async ({
  page,
}) => {
  let writes = 0;
  await page.route('**/__draft_test__/create', (route) => {
    writes++;
    return route.fulfill({ json: { committed: true, fail: false, staleReadback: true } });
  });
  await page.goto(url);
  await name(page).fill('Falta lectura');
  await price(page).fill('100');
  await create(page).click();
  await expect(verify(page)).toBeVisible();
  await expect(create(page)).toBeDisabled();
  expect(writes).toBe(1);
  await page.reload();
  await restore(page).click();
  await expect(name(page)).toHaveValue('Falta lectura');
});

test('corrupt local record is preserved and blocks creation', async ({ page }) => {
  await page.goto(url);
  await name(page).fill('Antes de corrupción');
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith('lihen:dev:form-draft:'))!;
    localStorage.setItem(key, '{broken');
  });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo leer' })).toBeVisible();
  await expect(create(page)).toBeDisabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        Object.keys(localStorage).find((key) => key.startsWith('lihen:dev:form-draft:'))!,
      ),
    ),
  ).toBe('{broken');
});

test('quota failure blocks dispatch and warns about unpreserved changes', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('lihen:dev:form-draft:')) throw new Error('quota');
      return set.call(this, key, value);
    };
  });
  let writes = 0;
  await page.route('**/__draft_test__/create', (route) => {
    writes++;
    return route.fulfill({ json: { committed: true, fail: false } });
  });
  await page.goto(url);
  await name(page).fill('Cuota agotada');
  await expect(
    page.getByRole('alert').filter({ hasText: 'No se pudo leer o conservar' }),
  ).toBeVisible();
  await expect(create(page)).toBeDisabled();
  expect(writes).toBe(0);
});

test('simultaneous submissions produce one creation request', async ({ page }) => {
  let writes = 0;
  await page.route('**/__draft_test__/create', (route) => {
    writes++;
    return route.fulfill({ json: { committed: true, fail: false } });
  });
  await page.goto(url);
  await name(page).fill('Un envío');
  await price(page).fill('100');
  await page.evaluate(() => {
    const form = document.querySelector('form')!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole('heading', { name: 'Otro módulo' })).toBeVisible();
  expect(writes).toBe(1);
});

test('refreshes canonical brand status immediately before dispatch', async ({ page }) => {
  let writes = 0;
  await page.route('**/__draft_test__/create', (route) => {
    writes++;
    return route.fulfill({ json: { committed: true, fail: false } });
  });
  await page.goto(url);
  await name(page).fill('Fresh taxonomy');
  await price(page).fill('100');
  await page
    .getByRole('combobox', { name: 'Marca can\u00f3nica', exact: true })
    .selectOption('brand-active');
  await page.evaluate(() => localStorage.setItem('fixture:brand-inactive', 'true'));
  await create(page).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'marca restaurada' }).first(),
  ).toBeVisible();
  await expect(create(page)).toBeDisabled();
  expect(writes).toBe(0);
});

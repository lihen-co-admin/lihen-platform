import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') throw new Error(`Unexpected remote call: ${url.origin}`);
    const fulfill = (body: string) =>
      route.fulfill({ contentType: 'application/javascript', body });
    if (
      url.pathname === '/src/composition/editorial-research.ts' &&
      !url.searchParams.has('actual')
    )
      return fulfill(`
      export async function researchEditorialGrounding(internal) {
        const mode = new URLSearchParams(location.search).get('mode');
        document.body.dataset.searchStarted = 'true';
        if (mode === 'late-search' && internal.productIdentity.productId.endsWith('1')) {
          await new Promise(resolve => setTimeout(resolve, 1800));
        }
        document.body.dataset.searchCompleted = 'true';
        return internal;
      }
    `);
    if (url.pathname === '/src/composition/products.ts')
      return fulfill(`export const productsComposition = { canReadImages: true,
      getProductById: { execute: async ({productId}) => ({ id: productId, name: productId.endsWith('1') ? 'Producto uno' : 'Producto dos',
        sku: productId.endsWith('1') ? 'SKU-1' : 'SKU-2', brandId: productId.endsWith('1') ? 'brand-a' : 'brand-b',
        brandName: productId.endsWith('1') ? 'Marca A' : 'Marca B', categoryName: 'Cuidado', salePrice: { amount: 10000, currency: 'COP' } }) },
      getProductImages: { execute: async ({productId}) => [{ id: 'image-' + productId, productId, publicUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E' }] } };`);
    if (url.pathname === '/src/composition/inventory.ts')
      return fulfill(
        `export const inventoryComposition = { getInventory: { execute: async () => [{ productId: 'durable-product-1', stockAvailable: 0 }] } };`,
      );
    if (
      url.pathname === '/src/composition/editorial-video-assets.ts' &&
      !url.searchParams.has('actual')
    )
      return fulfill(
        `export * from '/src/composition/editorial-video-assets.ts?actual'; export async function readEditorialVideoAssets() { return []; }`,
      );
    if (url.pathname === '/src/composition/assistant-runtime.ts')
      return fulfill(`
      let requests = [];
      export const assistantRuntimeInvoker = { async invokeProductTurn(request) {
        requests.push(request); document.body.dataset.requests = JSON.stringify(requests);
        const mode = new URLSearchParams(location.search).get('mode');
        await new Promise(resolve => setTimeout(resolve, mode === 'late' && request.productId.endsWith('1') ? 1800 : 250));
        if (mode === 'error') throw new Error('fixture provider failure');
        if (mode === 'unavailable') return { status: 'PROVIDER_NOT_CONFIGURED' };
        const context = JSON.parse(request.prompt.split('CONTEXTO_EDITORIAL_USUARIO_JSON: ')[1]);
        const evidence = JSON.parse(request.prompt.split('EVIDENCIA_ADMITIDA_JSON: ')[1].split(String.fromCharCode(10) + 'CONTEXTO_EDITORIAL_USUARIO_JSON: ')[0]);
        const identity = evidence.productIdentity;
        const copy = { INSTAGRAM_FEED: 'feed.invite', INSTAGRAM_STORY: 'story.look', INSTAGRAM_REEL: 'reel.hook', FACEBOOK: 'facebook.context', TIKTOK: 'tiktok.hook' };
        const cta = { INSTAGRAM_FEED: 'cta.explore', INSTAGRAM_STORY: 'cta.discover', INSTAGRAM_REEL: 'cta.save', FACEBOOK: 'cta.ask', TIKTOK: 'cta.comment' };
        if (mode === 'late' && request.productId.endsWith('1')) document.body.dataset.lateCompleted = 'true';
        document.body.dataset.lastModelCompleted = request.productId;
        return { status: 'SUCCESS', contextSource: 'ProductMaster:GetProductById',
          context: { type: 'PRODUCT', entityId: identity.productId, attributes: { product: { id: identity.productId, name: identity.productName, sku: identity.sku,
            brandId: identity.brandId, brandName: identity.brand, categoryName: identity.category } } },
          recommendations: [], messages: [], answer: JSON.stringify({
          productId: request.productId, campaignName: [{editorial: 'campaign.focus'}, {fact: 'internal:name'}],
          variants: context.variants.map(variant => ({ channel: variant.channel,
            copy: mode === 'claim' ? [{fact: 'internal:benefits'}] : [{editorial: copy[variant.channel]}, {fact: 'internal:name'}],
            callToAction: [{editorial: cta[variant.channel]}],
            hashtags: ['editorial:lihen', variant.channel === 'TIKTOK' ? 'internal:name' : 'internal:category']
          }))
        }) };
      } };
    `);
    return route.continue();
  });
});

async function open(page: Page, mode = '') {
  await page.goto(`/tests/fixtures/editorial-intelligence.html?mode=${mode}`);
  await expect(
    page.getByRole('button', { name: '✨ Sugerir contenido con LIHEN Intelligence' }),
  ).toBeDisabled();
  await page.getByRole('combobox', { name: 'Producto a promocionar' }).click();
  await page.getByRole('option', { name: /Producto uno/ }).click();
}
const proposal = (page: Page, field: string) =>
  page.getByRole('group', { name: `Recomendación de ${field}`, exact: true });
const generate = (page: Page) =>
  page.getByRole('button', { name: '✨ Sugerir contenido con LIHEN Intelligence' }).click();
const ctas: Record<string, string> = {
  INSTAGRAM_FEED: 'Explora este producto',
  INSTAGRAM_STORY: 'Descubre más en LIHEN.CO',
  INSTAGRAM_REEL: 'Guarda esta idea para inspirarte',
  FACEBOOK: 'Cuéntanos qué te gustaría saber',
  TIKTOK: '¿Lo incluirías en tu selección? Cuéntanos',
};

test('grounded proposals remain independent across all tabs and never silently replace manual content', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel(/Copy \/ caption/).fill('Copy manual IG');
  await page.getByLabel('CTA', { exact: true }).fill('CTA manual IG');
  await page.getByLabel('Hashtags', { exact: true }).fill('#ManualIG');
  await page.getByLabel('Campaña editorial', { exact: true }).fill('Campaña manual');
  const channels = [
    ['Instagram Feed', 'INSTAGRAM_FEED'],
    ['Instagram Story', 'INSTAGRAM_STORY'],
    ['Instagram Reel', 'INSTAGRAM_REEL'],
    ['Facebook', 'FACEBOOK'],
    ['TikTok', 'TIKTOK'],
  ];
  for (const [channel] of channels.slice(1)) {
    await page.getByRole('checkbox', { name: channel!, exact: true }).check();
    await expect(page.getByLabel('CTA', { exact: true })).toHaveValue('');
  }
  await generate(page);
  await expect(page.getByRole('status')).toHaveText('Generando…');
  await expect(proposal(page, 'copy')).toContainText('Sugerencia lista');
  const copies: string[] = [];
  for (const [label, channel] of channels) {
    await page.getByRole('button', { name: label!, exact: true }).click();
    await expect(proposal(page, 'CTA').locator('.editorial-suggestion-text')).toHaveText(
      ctas[channel!]!,
    );
    copies.push(
      (await proposal(page, 'copy').locator('.editorial-suggestion-text').textContent())!,
    );
  }
  expect(new Set(copies).size).toBe(5);
  await page.getByRole('button', { name: 'Instagram Feed', exact: true }).click();
  await expect(page.getByLabel(/Copy \/ caption/)).toHaveValue('Copy manual IG');
  await expect(page.getByLabel('CTA', { exact: true })).toHaveValue('CTA manual IG');
  await expect(page.getByLabel('Hashtags', { exact: true })).toHaveValue('#ManualIG');
  await expect(page.getByLabel('Campaña editorial', { exact: true })).toHaveValue('Campaña manual');
  await expect(page.locator('body')).not.toHaveAttribute('data-saved');
  await proposal(page, 'CTA')
    .getByRole('button', { name: 'Reemplazar este campo con sugerencia' })
    .click();
  await page.getByLabel('CTA', { exact: true }).fill('CTA ajustado por operadora');
  await proposal(page, 'hashtags').getByRole('button', { name: 'Descartar', exact: true }).click();
  await page.getByRole('button', { name: 'TikTok', exact: true }).click();
  await expect(page.getByLabel('CTA', { exact: true })).toHaveValue('');
  await expect(proposal(page, 'hashtags').locator('.editorial-suggestion-text')).toHaveText(
    '#LIHENCO #Productouno',
  );
  await page.getByRole('button', { name: 'Instagram Feed', exact: true }).click();
  await expect(page.getByLabel('CTA', { exact: true })).toHaveValue('CTA ajustado por operadora');
});

test('Ver fuentes shows exact identity, actual internal provenance and missing evidence without model reasoning', async ({
  page,
}) => {
  await open(page);
  await generate(page);
  const copy = proposal(page, 'copy');
  await expect(copy).toContainText('Sugerencia lista');
  await copy.getByText(/Basado en .* fuentes · Ver fuentes/).click();
  const sources = copy.locator('details');
  for (const text of [
    'SKU-1',
    'Marca A',
    'durable-product-1',
    'Catálogo LIHEN',
    'VERIFIED_INTERNAL',
    'Stock: 0',
    'image-durable-product-1',
    'INSUFFICIENT_EVIDENCE',
    'ingredients',
    'GENERAL_EDITORIAL_CONTEXT',
    'Investigación web no configurada',
  ])
    await expect(sources).toContainText(text);
  await expect(sources).not.toContainText('CONTEXTO_EDITORIAL_USUARIO_JSON');
  await expect(sources).not.toContainText('VOCABULARIO_EDITORIAL_NEUTRAL');
  await expect(sources.locator('a')).toHaveCount(0);
});

test('explicitly applied per-channel content saves only drafts, without approval, schedule or attempts', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('checkbox', { name: 'TikTok', exact: true }).check();
  await generate(page);
  await expect(proposal(page, 'copy')).toContainText('Sugerencia lista');
  for (const channel of ['Instagram Feed', 'TikTok']) {
    await page.getByRole('button', { name: channel, exact: true }).click();
    for (const field of ['copy', 'CTA', 'hashtags'])
      await proposal(page, field)
        .getByRole('button', { name: 'Usar sugerencia', exact: true })
        .click();
  }
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  const saved = JSON.parse((await page.locator('body').getAttribute('data-saved'))!);
  expect(saved).toHaveLength(2);
  for (const item of saved) {
    expect(item.productId).toBe('durable-product-1');
    expect(item.publication.callToAction).toBe(ctas[item.publication.channel]);
    expect(item.publication.copy).toContain('Producto uno');
    expect(item.publication.hashtags).toEqual([
      'LIHENCO',
      item.publication.channel === 'TIKTOK' ? 'Productouno' : 'Cuidado',
    ]);
    expect(item.publication.status).toBe('PREPARED');
    expect(item.schedule).toBeNull();
    expect(item.attempts).toEqual([]);
  }
});

for (const mode of ['error', 'unavailable', 'claim'])
  test(`${mode} preserves manual editing and rejects ungrounded suggestions`, async ({ page }) => {
    await open(page, mode);
    await page.getByLabel(/Copy \/ caption/).fill('Manual protegido');
    await generate(page);
    await expect(page.getByRole('status')).toContainText(
      mode === 'unavailable' ? 'No disponible' : 'Error al generar',
    );
    await expect(proposal(page, 'copy')).not.toContainText('Sugerencia lista');
    await expect(page.getByLabel(/Copy \/ caption/)).toHaveValue('Manual protegido');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-saved', /Manual protegido/);
  });

test('regeneration and discard remain explicit and do not apply content', async ({ page }) => {
  await open(page);
  await page.getByLabel('CTA', { exact: true }).fill('CTA manual');
  await page.getByRole('button', { name: 'Sugerir CTA', exact: true }).click();
  await expect(proposal(page, 'CTA')).toContainText('Sugerencia lista');
  await proposal(page, 'CTA').getByRole('button', { name: 'Regenerar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Sugerencia lista');
  await expect(page.getByLabel('CTA', { exact: true })).toHaveValue('CTA manual');
  await proposal(page, 'CTA').getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.getByLabel('CTA', { exact: true })).toHaveValue('CTA manual');
});

test('late responses from another product cannot contaminate suggestions or evidence', async ({
  page,
}) => {
  await open(page, 'late');
  await generate(page);
  await expect(page.locator('body')).toHaveAttribute('data-requests', /durable-product-1/);
  await page.getByRole('combobox', { name: 'Producto a promocionar' }).click();
  await page.getByRole('option', { name: /Producto dos/ }).click();
  await generate(page);
  await expect(proposal(page, 'copy')).toContainText('Sugerencia lista');
  await expect(page.locator('body')).toHaveAttribute('data-late-completed', 'true');
  await proposal(page, 'copy')
    .getByText(/Basado en .* fuentes · Ver fuentes/)
    .click();
  await expect(proposal(page, 'copy').locator('details')).toContainText('Marca B');
  await expect(proposal(page, 'copy').locator('details')).not.toContainText('Marca A');
  await expect(proposal(page, 'copy').locator('.editorial-suggestion-text')).toContainText(
    'Producto dos',
  );
  await page.getByRole('combobox', { name: 'Producto a promocionar' }).click();
  await page.getByRole('option', { name: /Producto uno/ }).click();
  await expect(page.locator('.editorial-sources')).toHaveCount(0);
  await expect(proposal(page, 'copy')).not.toContainText('Sugerencia lista');
});

for (const changed of ['SKU', 'marca'])
  test(`same productId with changed ${changed} invalidates evidence and recommendations`, async ({
    page,
  }) => {
    await open(page);
    await page.getByLabel(/Copy \/ caption/).fill('Manual protegido');
    await generate(page);
    await expect(proposal(page, 'copy')).toContainText('Sugerencia lista');
    await page.getByRole('button', { name: `Cambiar ${changed} fixture`, exact: true }).click();
    await expect(page.locator('.editorial-sources')).toHaveCount(0);
    await expect(proposal(page, 'copy')).not.toContainText('Sugerencia lista');
    await expect(page.getByLabel(/Copy \/ caption/)).toHaveValue('Manual protegido');
  });

test('late research stage for A cannot contaminate the next product B', async ({ page }) => {
  await open(page, 'late-search');
  await generate(page);
  await expect(page.locator('body')).toHaveAttribute('data-search-started', 'true');
  await page.getByRole('combobox', { name: 'Producto a promocionar' }).click();
  await page.getByRole('option', { name: /Producto dos/ }).click();
  await generate(page);
  await expect(proposal(page, 'copy')).toContainText('Sugerencia lista');
  await expect(page.locator('body')).toHaveAttribute('data-search-completed', 'true');
  // Wait for the obsolete model response too; it must still be discarded.
  await expect(page.locator('body')).toHaveAttribute(
    'data-last-model-completed',
    'durable-product-1',
  );
  await proposal(page, 'copy')
    .getByText(/Basado en .* fuentes · Ver fuentes/)
    .click();
  await expect(proposal(page, 'copy').locator('details')).toContainText('Marca B');
  await expect(proposal(page, 'copy').locator('details')).not.toContainText('Marca A');
  await expect(proposal(page, 'copy').locator('details')).toContainText(
    'Investigación web no configurada',
  );
  await expect(proposal(page, 'copy').locator('.editorial-suggestion-text')).toContainText(
    'Producto dos',
  );
  await expect(page.locator('body')).not.toHaveAttribute('data-saved');
});

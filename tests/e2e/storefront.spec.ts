import { expect, test, type Page, type Route } from '@playwright/test';

const image = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22600%22%3E%3Crect width=%22600%22 height=%22600%22 fill=%22%23f6eee8%22/%3E%3C/svg%3E';

interface MockProduct {
  product_id: string;
  sku: string;
  slug: string;
  product_name: string;
  business_line: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  description: string;
  sale_price: number;
  main_image_url: string;
  image_urls: string[];
  card_media: { url:string; width:number; height:number; profile:'WEB_CARD' };
  detail_media: { url:string; width:number; height:number; profile:'WEB_DETAIL' } | null;
  gallery_media: Array<{ url:string; width:number; height:number; profile:'WEB_DETAIL' }>;
  availability: 'AVAILABLE' | 'LOW_STOCK' | 'COMING_SOON' | 'OUT_OF_STOCK';
}

const beautyProducts: MockProduct[] = Array.from({ length: 40 }, (_, index) => ({
  product_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  sku: `BC-${String(900 + index)}`,
  slug: `producto-e2e-${index + 1}`,
  product_name: index === 0 ? 'Labial E2E LIHEN' : `Producto E2E ${index + 1}`,
  business_line: 'BEAUTY_CARE',
  brand: index < 12 ? 'Bloomshell' : index < 24 ? 'Atenea' : 'Kaba',
  category: index % 2 === 0 ? 'LABIALES, BRILLOS, DELINEADORES, HIDRATANTES Y TINTAS' : 'ACCESORIOS PARA MAQUILLAJE',
  subcategory: null,
  description: 'Producto controlado para la suite E2E del Storefront.',
  sale_price: 10000 + index * 1000,
  main_image_url: image,
  image_urls: [image, `${image}%23${index + 1}`],
  card_media: { url:image, width:600, height:600, profile:'WEB_CARD' },
  detail_media: { url:image, width:600, height:600, profile:'WEB_DETAIL' },
  gallery_media: [{ url:image, width:600, height:600, profile:'WEB_DETAIL' }],
  availability: index % 4 === 0 ? 'AVAILABLE' : index % 4 === 1 ? 'LOW_STOCK' : index % 4 === 2 ? 'COMING_SOON' : 'OUT_OF_STOCK',
}));

const styleProducts: MockProduct[] = Array.from({ length: 4 }, (_, index) => ({
  product_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  sku: `ST-${String(index + 1).padStart(3, '0')}`,
  slug: `style-e2e-${index + 1}`,
  product_name: `Style E2E ${index + 1}`,
  business_line: 'STYLE',
  brand: null,
  category: 'ROPA DEPORTIVA',
  subcategory: null,
  description: 'Producto Style controlado para navegación E2E.',
  sale_price: 45000 + index * 5000,
  main_image_url: image,
  image_urls: [image],
  card_media: { url:image, width:600, height:600, profile:'WEB_CARD' },
  detail_media: null,
  gallery_media: [],
  availability: 'AVAILABLE',
}));

const products: MockProduct[] = [...beautyProducts, ...styleProducts];

interface MockBrand {
  brand_id: string;
  brand_name: string;
  logo_url: string | null;
  visible_product_count: number;
}

function mockBrandsForLine(businessLine: string): MockBrand[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    if (product.business_line !== businessLine || !product.brand) continue;
    counts.set(product.brand, (counts.get(product.brand) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([brand, count], index) => ({
    brand_id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    brand_name: brand,
    logo_url: null,
    visible_product_count: count,
  })).sort((a, b) => b.visible_product_count - a.visible_product_count || a.brand_name.localeCompare(b.brand_name));
}

async function mockStorefrontRpc(page: Page): Promise<void> {
  await page.route('**/rest/v1/rpc/get_storefront_products_media_v2_controlled', async (route: Route) => {
    const request = route.request();
    const body = request.postDataJSON() as {
      p_limit?: number;
      p_offset?: number;
      p_query?: string | null;
      p_business_line?: string | null;
      p_brand?: string | null;
      p_category?: string | null;
    };
    let rows = [...products];
    if (body.p_business_line) rows = rows.filter((product) => product.business_line === body.p_business_line);
    if (body.p_query) {
      const query = body.p_query.toLowerCase();
      rows = rows.filter((product) => [product.product_name, product.brand ?? '', product.sku].some((value) => value.toLowerCase().includes(query)));
    }
    if (body.p_brand) rows = rows.filter((product) => product.brand === body.p_brand);
    if (body.p_category) rows = rows.filter((product) => product.category === body.p_category);
    const offset = Math.max(body.p_offset ?? 0, 0);
    const limit = Math.max(body.p_limit ?? 24, 1);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows.slice(offset, offset + limit)) });
  });

  await page.route('**/rest/v1/rpc/get_storefront_brands_controlled', async (route: Route) => {
    const body = route.request().postDataJSON() as { p_business_line?: string | null; p_limit?: number };
    const rows = mockBrandsForLine(body.p_business_line ?? 'BEAUTY_CARE');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows.slice(0, Math.max(body.p_limit ?? 60, 1))),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockStorefrontRpc(page);
  await page.addInitScript(() => {
    const marker = 'lihen.e2e.storage.initialized';
    if (sessionStorage.getItem(marker) !== '1') {
      localStorage.clear();
      sessionStorage.setItem(marker, '1');
    }
  });
});

test('home loads canonical product rails without legacy runtime data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /LIHEN.CO/i }).first()).toBeVisible();
  await expect(page.getByText('Descubre productos del catálogo.')).toBeVisible();
  await expect(page.locator('[data-product-card]')).toHaveCount(20);
  const firstImage = page.locator('[data-product-card] img').first();
  await expect(firstImage).toHaveAttribute('srcset', /600w/);
  await expect(firstImage).toHaveAttribute('sizes', /vw|px/);
  await expect(firstImage).toHaveAttribute('width', '600');
  await expect(firstImage).toHaveAttribute('height', '600');
});

test('Beauty Care and Style navigation open the canonical catalog with the selected business line', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Beauty Care' })).toHaveAttribute('href', '#catalogo?business_line=BEAUTY_CARE');
  await expect(footer.getByRole('link', { name: 'Style' })).toHaveAttribute('href', '#catalogo?business_line=STYLE');

  await page.getByRole('link', { name: 'Explorar Beauty Care' }).click();
  await expect(page).toHaveURL(/#catalogo\?business_line=BEAUTY_CARE/);
  await expect(page.getByRole('combobox', { name: 'Línea', exact: true })).toHaveValue('BEAUTY_CARE');
  await expect(page.locator('[data-product-card]')).toHaveCount(24);

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Algo especial para cada momento.' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver Style' }).click();
  await expect(page).toHaveURL(/#catalogo\?business_line=STYLE/);
  await expect(page.getByRole('combobox', { name: 'Línea', exact: true })).toHaveValue('STYLE');
  await expect(page.locator('[data-product-card]')).toHaveCount(4);
  await expect(page.getByText('Style E2E 1')).toBeVisible();
});

test('brand cards navigate to filtered references and browser history restores catalog state', async ({ page }) => {
  await page.goto('/#marcas');
  await page.getByRole('link', { name: /referencias de Bloomshell/ }).click();
  await expect(page).toHaveURL(/business_line=BEAUTY_CARE.*brand=Bloomshell/);
  await expect(page.locator('[data-product-card]')).toHaveCount(12);
  await expect(page.getByLabel('Marca')).toHaveValue('Bloomshell');

  await page.getByLabel('Marca').selectOption('Atenea');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(/brand=Atenea/);
  await expect(page.locator('[data-product-card]')).toHaveCount(12);

  await page.goBack();
  await expect(page).toHaveURL(/brand=Bloomshell/);
  await expect(page.getByLabel('Marca')).toHaveValue('Bloomshell');
  await expect(page.locator('[data-product-card]')).toHaveCount(12);

  await page.goForward();
  await expect(page).toHaveURL(/brand=Atenea/);
  await expect(page.getByLabel('Marca')).toHaveValue('Atenea');
});

test('brand explorer uses the canonical brand projection and circular accessible controls', async ({ page }) => {
  await page.goto('/#marcas');
  await expect(page.getByRole('link', { name: 'Ver 12 referencias de Bloomshell' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver 12 referencias de Atenea' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver 16 referencias de Kaba' })).toBeVisible();
  await expect(page.locator('.home-brand__logo').first()).toHaveCSS('border-radius', '50%');

  await page.getByRole('button', { name: 'Style', exact: true }).click();
  await expect(page.getByText(/Aún no hay marcas Style con productos publicados/)).toBeVisible();
  await expect(page.locator('.home-brand')).toHaveCount(0);

  await page.getByRole('button', { name: 'Beauty Care', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Ver 12 referencias de Bloomshell' })).toBeVisible();
});

test('catalog supports search, filters and pagination through the controlled RPC', async ({ page }) => {
  await page.goto('/#catalogo');
  await expect(page.getByRole('heading', { name: 'Encuentra tu próximo favorito.' })).toBeVisible();
  await expect(page.locator('[data-product-card]')).toHaveCount(24);
  await expect(page.getByText(/Página 1 · 24 productos/)).toBeVisible();

  await page.getByRole('searchbox', { name: 'Buscar' }).fill('Labial E2E');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.locator('[data-product-card]')).toHaveCount(1);
  await expect(page.getByText('Labial E2E LIHEN')).toBeVisible();
  await expect(page).toHaveURL(/q=Labial\+E2E/);

  await page.getByRole('button', { name: 'Limpiar' }).click();
  await expect(page.getByRole('combobox', { name: 'Línea', exact: true })).toHaveValue('BEAUTY_CARE');
  await expect(page.locator('[data-product-card]')).toHaveCount(24);
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/Página 2 · 16 productos/)).toBeVisible();
});

test('product detail, selection persistence and WhatsApp consultation work together', async ({ page }) => {
  await page.goto('/#catalogo');
  await page.getByRole('button', { name: 'Ver Labial E2E LIHEN' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Labial E2E LIHEN' })).toBeVisible();
  await expect(dialog.getByText('BC-900')).toBeVisible();
  await expect(dialog.locator('.product-dialog__hero img')).toHaveAttribute('srcset', /600w/);
  await expect(dialog.locator('.product-dialog__hero img')).not.toHaveAttribute('data-media-fallback', 'true');
  await dialog.getByRole('button', { name: 'Agregar a mi selección' }).click();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Mi selección', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Mi selección' }).getByText('Labial E2E LIHEN')).toBeVisible();
  const whatsapp = page.getByRole('link', { name: /Consultar 1 producto por WhatsApp/ });
  await expect(whatsapp).toHaveAttribute('href', /wa\.me/);
  await expect(whatsapp).toHaveAttribute('href', /Labial|producto/i);

  await page.reload();
  await page.getByRole('button', { name: 'Mi selección', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Mi selección' }).getByText('Labial E2E LIHEN')).toBeVisible();
});

test('mobile navigation opens accessibly without horizontal overflow', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only Storefront check.');
  await page.goto('/');
  const toggle = page.locator('.menu-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-label', 'Abrir menú');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveAttribute('aria-label', 'Cerrar menú');
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});

test('storefront provides canonical metadata and no obvious legacy markers', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/LIHEN\.CO/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /LIHEN/i);
  const html = await page.locator('html').innerHTML();
  expect(html).not.toContain('products.js');
  expect(html).not.toContain('catalog_public');
  expect(html).not.toContain('data/catalog-v1');
});


test('gifts, about and trust pages are real routes instead of empty anchors', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Ideas para regalar' }).first().click();
  await expect(page).toHaveURL(/#regalos$/);
  await expect(page.getByRole('heading', { name: 'Detalles para regalar con intención.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explorar productos publicados' })).toBeVisible();

  await page.getByRole('link', { name: 'Nosotros' }).last().click();
  await expect(page).toHaveURL(/#nosotros$/);
  await expect(page.getByRole('heading', { name: 'Belleza, cuidado y estilo desde Cali para Colombia.' })).toBeVisible();

  await page.getByRole('link', { name: 'Términos y condiciones' }).click();
  await expect(page).toHaveURL(/#terminos$/);
  await expect(page.getByRole('heading', { name: 'Términos y condiciones' })).toBeVisible();
  await expect(page.getByText('Contenido en revisión para publicación definitiva.')).toBeVisible();

  await page.getByRole('link', { name: 'Peticiones, quejas y reclamos' }).click();
  await expect(page).toHaveURL(/#pqrs$/);
  await expect(page.getByRole('heading', { name: 'Peticiones, quejas, reclamos y solicitudes.' })).toBeVisible();

  await page.getByRole('link', { name: 'Derechos del consumidor' }).click();
  await expect(page).toHaveURL(/#consumidor$/);
  await expect(page.getByRole('heading', { name: 'Conoce tus derechos como consumidor.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /sede electrónica de la SIC/i })).toHaveAttribute('href', 'https://sedeelectronica.sic.gov.co/');
});

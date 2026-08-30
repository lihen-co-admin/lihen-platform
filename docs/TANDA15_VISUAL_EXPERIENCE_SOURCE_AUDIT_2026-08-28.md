# TANDA 15 — Visual & Experience Source Audit
## CUT 1 — static baseline

This report is generated from the exact local working tree.
It does not change application source, `.env`, Supabase, migrations, or PROD.

## CONTROL_CENTER
- source root exists: **True**
- files scanned: **78**
- pages: **25**
- components: **6**
- style files: **4**

### Existing UX/visual signals
- `responsive_media_queries`: **31**
- `focus_visible`: **21**
- `aria_usage`: **43**
- `loading_states`: **97**
- `empty_states`: **62**
- `error_states`: **420**
- `status_badges`: **43**
- `shared_shell`: **4**
- `shared_page_hero`: **92**
- `data_table`: **0**
- `dynamic_imports`: **0**
- `lazy_loading`: **0**

### Largest source files
- `apps/control-center/src/styles/app.css` — 956 lines
- `apps/control-center/src/composition/operations.ts` — 841 lines
- `apps/control-center/src/styles/catalog-pdf-print.css` — 785 lines
- `apps/control-center/src/composition/catalogs.ts` — 550 lines
- `apps/control-center/src/pages/OperationsPage.tsx` — 531 lines
- `apps/control-center/src/pages/CatalogPdfRenderPage.tsx` — 475 lines
- `apps/control-center/src/pages/PublicHubPage.tsx` — 452 lines
- `apps/control-center/src/pages/SalesPage.tsx` — 446 lines
- `apps/control-center/src/pages/FinancePage.tsx` — 412 lines
- `apps/control-center/src/pages/OrdersPage.tsx` — 384 lines
- `apps/control-center/src/pages/ProductImagesPage.tsx` — 367 lines
- `apps/control-center/src/pages/CatalogInstitutionalContentPage.tsx` — 350 lines
- `apps/control-center/src/pages/PurchasesPage.tsx` — 304 lines
- `apps/control-center/src/pages/ProductDetailPage.tsx` — 288 lines
- `apps/control-center/src/pages/ProductsPage.tsx` — 277 lines

### Pages
- `apps/control-center/src/pages/BootstrapAdminPage.tsx`
- `apps/control-center/src/pages/BrandsPage.tsx`
- `apps/control-center/src/pages/CatalogInstitutionalContentPage.tsx`
- `apps/control-center/src/pages/CatalogPdfRenderPage.tsx`
- `apps/control-center/src/pages/CatalogsPage.tsx`
- `apps/control-center/src/pages/CategoriesPage.tsx`
- `apps/control-center/src/pages/ChangeProductSalePricePage.tsx`
- `apps/control-center/src/pages/CreateProductPage.tsx`
- `apps/control-center/src/pages/DashboardPage.tsx`
- `apps/control-center/src/pages/DevAuthProbePage.tsx`
- `apps/control-center/src/pages/FinancePage.tsx`
- `apps/control-center/src/pages/InventoryPage.tsx`
- `apps/control-center/src/pages/LoginPage.tsx`
- `apps/control-center/src/pages/operation-console-policy.ts`
- `apps/control-center/src/pages/OperationsPage.tsx`
- `apps/control-center/src/pages/OrdersPage.tsx`
- `apps/control-center/src/pages/ProductDetailPage.tsx`
- `apps/control-center/src/pages/ProductImagesPage.tsx`
- `apps/control-center/src/pages/ProductsPage.tsx`
- `apps/control-center/src/pages/PublicHubPage.tsx`
- `apps/control-center/src/pages/PurchaseDetailPage.tsx`
- `apps/control-center/src/pages/PurchasesPage.tsx`
- `apps/control-center/src/pages/SalesPage.tsx`
- `apps/control-center/src/pages/SuppliersPage.tsx`
- `apps/control-center/src/pages/UpdateProductPage.tsx`

## STOREFRONT
- source root exists: **True**
- files scanned: **45**
- pages: **0**
- components: **36**
- style files: **8**

### Existing UX/visual signals
- `responsive_media_queries`: **39**
- `focus_visible`: **36**
- `aria_usage`: **111**
- `loading_states`: **27**
- `empty_states`: **27**
- `error_states`: **30**
- `status_badges`: **0**
- `shared_shell`: **0**
- `shared_page_hero`: **0**
- `data_table`: **0**
- `dynamic_imports`: **7**
- `lazy_loading`: **0**

### Largest source files
- `apps/storefront/src/styles/products.css` — 1492 lines
- `apps/storefront/src/styles/navigation.css` — 414 lines
- `apps/storefront/src/components/product-page.ts` — 312 lines
- `apps/storefront/src/components/site-header.ts` — 240 lines
- `apps/storefront/src/components/product-detail.ts` — 231 lines
- `apps/storefront/src/components/catalog-page.ts` — 209 lines
- `apps/storefront/src/components/home-page.ts` — 196 lines
- `apps/storefront/src/components/static-content-page.ts` — 176 lines
- `apps/storefront/src/styles/global.css` — 170 lines
- `apps/storefront/src/components/storefront-api.ts` — 169 lines
- `apps/storefront/src/styles/home.css` — 163 lines
- `apps/storefront/src/components/gifts-page.ts` — 152 lines
- `apps/storefront/src/components/storefront-navigation.ts` — 146 lines
- `apps/storefront/src/components/selection-drawer.ts` — 128 lines
- `apps/storefront/src/components/selection-store.ts` — 128 lines

### Pages

## Safety conclusion
CUT 1 is evidence collection only. No visual change should be applied until this
baseline is reviewed against the functional and governance invariants closed in
TANDA 14.

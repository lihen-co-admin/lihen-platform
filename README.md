# LIHEN Platform

Monorepo modular para el nuevo ecosistema privado y público de LIHEN.CO.

## Estado

**FASE 1.0 — Bootstrap/Foundation.** No ejecuta migraciones de producción ni reemplaza todavía LIHEN_ADMIN_PRO o LIHEN_WEB_RENACER.

## Requisitos

- Node.js 24 LTS
- pnpm 10.x (la versión objetivo está fijada en `package.json`)

## Inicio

```bash
corepack enable
pnpm install
# El primer install genera pnpm-lock.yaml. Después de confirmarlo en Git, CI debe volver a --frozen-lockfile.
pnpm check
pnpm dev
```

## Aplicaciones

- `apps/control-center`: Control Center privado (React + Vite + TypeScript).
- `apps/storefront`: workspace para la migración incremental de LIHEN_WEB_RENACER; no reemplaza producción aún.
- `apps/workers`: procesos Node/TypeScript de servidor; en esta fase solo incluye un health check.

## Paquetes iniciales

- `@lihen/core`: contratos transversales mínimos.
- `@lihen/shared`: value objects/utilidades verdaderamente compartidas.
- `@lihen/products`: primer dominio preparado para el slice de lectura de productos.
- `@lihen/database`: cliente/configuración común de infraestructura de datos.

## Reglas de arquitectura

1. Las apps pueden consumir packages; los packages nunca dependen de apps.
2. Domain no depende de React, Vite o Supabase.
3. Los tipos de filas de Supabase se adaptan a entidades/DTOs; no son el dominio.
4. Storefront no importa módulos administrativos como Finance o Suppliers.
5. Las migraciones SQL físicas viven en `database/migrations` y requieren validación asociada.

## Calidad

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm check
```

## Seguridad

- No versionar `.env`, secretos, documentos de proveedor, facturas, inventarios ni datos de clientes.
- Browser: publishable key + RLS.
- `SUPABASE_SERVICE_ROLE_KEY`: solo en workers/servidor seguro cuando sea estrictamente necesario.


## FASE 1.1 — Product Read Slice

El primer slice vertical ya está implementado con `GetProductsQuery → GetProductsHandler → ProductRepository → InMemoryProductRepository → ProductsPage`. Usa únicamente fixtures de desarrollo; no consulta Supabase ni datos reales. Véase `docs/architecture/05-product-read-slice.md`.

## Current implementation status

- **FASE 1.0** — Bootstrap/Foundation: implemented.
- **FASE 1.1** — Product Core / Read Slice: implemented with an in-memory repository.
- **FASE 1.2** — Supabase DEV Product Read Adapter: implemented and selectable via `VITE_PRODUCT_READ_SOURCE`; live DEV verification requires DEV credentials and RLS/schema confirmation.

The product read source defaults to `memory`. To use Supabase DEV, configure `.env.local` as documented in `docs/architecture/06-supabase-product-read-adapter.md`.

## FASE 1.2.1 — DEV Schema + RLS Precheck

Read-only DEV precheck assets now live in `database/validation/`. The gate verifies the six physical product fields expected by the legacy adapter, real status values, product data quality, RLS enablement and deployed policies. It is intentionally marked **DEV EXECUTION PENDING** until executed against the real Supabase DEV project with evidence.

## FASE 1.3 — Product Details

`/products/:id` now executes `GetProductById` through the `ProductRepository` port. Both memory and Supabase read adapters support the operation; no write path has been introduced.


## Estado actual — FASE 1.4

El Product Core ya incluye lectura de lista, detalle y el primer Command Slice de creación. `CreateProduct` funciona únicamente con `InMemoryProductRepository`. `SupabaseProductRepository` permanece explícitamente **read-only** hasta aprobar `FASE 1.2.1 — DEV SCHEMA + RLS PRECHECK` contra el Supabase DEV real.

Flujo actual:

```text
ProductsPage / CreateProductPage
  -> GetProducts / GetProductById / CreateProduct
  -> ProductRepository
  -> InMemoryProductRepository (read + create)
     o SupabaseProductRepository (read only; create bloqueado)
```

## FASE 1.5 — Product Update / Command Slice

Implementado el primer flujo de actualización de producto exclusivamente contra `InMemoryProductRepository`:

`UpdateProductPage -> UpdateProductCommand -> UpdateProductHandler -> ProductRepository.update()`.

Permite editar nombre, SKU, código de catálogo, estado y precio actual; detecta duplicados pertenecientes a otros productos y permite limpiar campos opcionales. `SupabaseProductRepository.update()` permanece deliberadamente bloqueado con `PRODUCT_WRITE_BLOCKED` hasta aprobar FASE 1.2.1 contra el DEV real.

El cambio de precio de esta fase es provisional y solo en memoria. FASE 1.6 añadirá el caso especializado con historial/auditoría antes de cualquier escritura real.

## FASE 1.6 — Product Price Change

El precio de venta ya está separado de `UpdateProduct`. El flujo especializado `ChangeProductSalePrice` conserva historial append-only en memoria con precio anterior/nuevo, motivo, actor y timestamp. Supabase continúa estrictamente en solo lectura hasta aprobar el gate FASE 1.2.1 contra DEV real.


## FASE 1.7 — Product Images

Implemented an in-memory Product Image command slice:

- `ProductImage`
- `ProductImageRepository`
- `InMemoryProductImageRepository`
- `AddProductImage`
- `SetMainProductImage`
- `GetProductImages`
- single-main-image invariant
- `LegacyMainImageBackfillMapper` for the future `products.main_image_url` migration

Supabase `product_images` writes and Supabase Storage remain deliberately blocked until the DEV schema/RLS/Storage precheck is approved. See `docs/FASE_1_7_PRODUCT_IMAGES.md` and `database/validation/003_product_images_dev_precheck.sql`.


## FASE 1.8 — Brands + Categories

Se incorporaron `Brand` y `Category` como referencias canónicas del dominio de Products, repositories/adapters en memoria, lectura desde Control Center y preparación no destructiva del futuro backfill `brand_id/category_id`. Supabase continúa read-only y la taxonomía DEV permanece bloqueada hasta ejecutar el precheck real.

## FASE 1.8.1 — DEV Taxonomy Precheck + Backfill Spec

Se añadieron inventario/matching prechecks, plantillas de mapping, migraciones `pending` no destructivas y un acceptance gate para `brands → categories → products.brand_id/category_id`. El `SupabaseProductRepository` mantiene el contrato legacy y no existe cutover de taxonomía hasta obtener evidencia 100 % consistente del Supabase DEV real.

### Evidencia Supabase conectada para 1.8.1

El único proyecto Supabase conectado al momento del precheck fue `lihen-inauguracion`; no contiene `public.products` ni una branch DEV, por lo que fue descartado como target de Product Core. La inspección fue solo lectura y no se ejecutaron cambios. El gate 1.8.1 permanece pendiente hasta conectar el Supabase DEV correcto.

## Current implementation status

- FASE 1.2.2 DEV Product Core foundation: **DEV_APPLIED**.
- FASE 1.8.1 taxonomy structural expand: **DEV_APPLIED**; real-data backfill pending.
- Supabase writes from application adapters: **BLOCKED**.
- Canonical taxonomy read cutover: **NOT DONE**.


## FASE 1.2.3 — Auth DEV
Control Center ahora incluye login con Supabase Auth y rutas protegidas. La conexión DEV usa publishable key y `products` continúa en modo SELECT-only. El probe browser+JWT queda pendiente únicamente de disponer de una cuenta Auth DEV válida; no se crean usuarios mediante SQL directo.

### Estado FASE 1.2.3
- URL DEV configurada: `https://vnmkupzptujtywnnabkp.supabase.co`.
- Publishable key moderna configurada solo para frontend DEV.
- `VITE_AUTH_MODE=supabase` + `VITE_PRODUCT_READ_SOURCE=supabase` en desarrollo local.
- Login con email/password mediante Supabase Auth.
- Rutas privadas protegidas y logout disponible.
- `auth.users = 0`: el probe browser+JWT real queda PENDIENTE hasta crear una cuenta Auth DEV por flujo soportado.
- No se insertan usuarios directamente en `auth.users` y no se habilitan escrituras de productos.

## FASE 1.2.3 — Bootstrap de primera cuenta Auth DEV

El Control Center incorpora un flujo de bootstrap de una sola vez mediante Supabase Auth `signUp()`.

- `VITE_DEV_ALLOW_BOOTSTRAP_SIGNUP=false` por defecto.
- Para crear la primera cuenta DEV, activar temporalmente `true` y abrir `/bootstrap-admin`.
- Después de crear/confirmar la cuenta, volver inmediatamente a `false`.
- El login normal permanece en `/login` con `signInWithPassword()`.
- No se usa `service_role` en el navegador ni se escribe directamente en `auth.users`.
- `user_metadata` no se utiliza como fuente de autorización.
- Product Core continúa SELECT-only para `authenticated` hasta un gate posterior.

La evidencia final del probe JWT requiere que la primera cuenta sea creada/confirmada por su propietaria desde el navegador, porque la contraseña no debe compartirse con el asistente ni guardarse en el repositorio.


## FASE 1.2.3 — Final Auth/RLS probe

Se añadió `/dev-auth-probe`, una ruta protegida que valida una sesión Supabase real sin mostrar el JWT. Genera solo una huella SHA-256 truncada y ejecuta `GetProducts` contra `lihen-platform-dev`. El gate permanece pendiente mientras `auth.users = 0`. Ver `docs/FASE_1_2_3_FINAL_AUTH_PROBE.md`.


## FASE 1.2.3 — GitHub OAuth real

El Control Center incluye `Continuar con GitHub` en `/login`. El retorno OAuth apunta a `/dev-auth-probe`, donde se valida sesión/JWT + lectura de `products` a través del mismo `SupabaseProductRepository` y RLS. GitHub autentica al usuario, pero todavía no sustituye una política formal de autorización administrativa.

## FASE 1.9 — Admin Identity & Authorization Foundation

DEV now contains `admin_roles` and `profiles`. New Supabase Auth users are automatically provisioned as `VIEWER + PENDING`; authentication never auto-grants administrative authority. Client access to profiles is SELECT-own only. Product writes remain blocked until the real GitHub JWT probe and later write-specific gates pass.


## FASE 1.10 — Controlled Product Write Foundation

CreateProduct está preparado mediante RPC transaccional e idempotente, pero permanece apagado en frontend y sin EXECUTE para authenticated hasta cerrar Auth + autorización real.

## FASE 1.11 — Product Update Controlled Write Foundation

`UpdateProduct` está preparado contra Supabase mediante `public.update_product_controlled(...)`, con autorización `OWNER/ADMIN + ACTIVE`, preservación del precio, validación de referencias canónicas e idempotencia por `operation_key` + fingerprint + snapshot. La RPC permanece sin `EXECUTE` para `authenticated`, `public.products` continúa sin `UPDATE` directo y `VITE_PRODUCT_UPDATE_WRITE_MODE=blocked` es el valor por defecto. El cutover vive únicamente en `database/migrations/pending/006_enable_controlled_product_update.sql` y no debe aplicarse hasta cerrar JWT real, promoción del perfil, lectura segura de taxonomía y aprobación explícita DEV.


## FASE 1.12 — Controlled Product Price Change Foundation

Prepared in DEV: atomic `change_product_sale_price_controlled`, append-only `product_sale_price_history`, idempotency, role check (`OWNER/ADMIN + ACTIVE`) and independent browser gate `VITE_PRODUCT_PRICE_WRITE_MODE=blocked`. The RPC remains non-executable by `authenticated` until explicit cutover.

## FASE 1.13 — Product Price History Read Foundation

Price-history reads are prepared through `public.get_product_sale_price_history(uuid)`, backed by an authorization helper in `lihen_private`. Direct browser access to `product_sale_price_history` remains denied and all product/history writes remain unchanged and blocked. The Control Center gate `VITE_PRODUCT_PRICE_HISTORY_READ_MODE` defaults to `blocked` until the real Auth/JWT/profile probe is closed.

## FASE 1.14 — Product Images Persistence Foundation
Canonical `product_images` metadata and controlled read RPC are prepared in DEV. A partial unique index enforces at most one ACTIVE main image per product. Direct table access, Storage uploads, image writes, legacy backfill, and production writes remain blocked.

## FASE 1.15 — Product Image Legacy Backfill Foundation
Dry-run and conflict classification are prepared. DEV currently contains 0 products, so the dry-run has no real candidates yet. The real `products.main_image_url → product_images` backfill remains **NOT EXECUTED**. See `database/validation/012_product_image_legacy_backfill_dry_run.sql` and the pending migration `009_execute_product_image_legacy_backfill.sql`.


## FASE 1.16 — Product Image Controlled Write Foundation

Preparadas `AddProductImage` y `SetMainProductImage` mediante RPCs transaccionales
e idempotentes. El frontend permanece en
`VITE_PRODUCT_IMAGE_WRITE_MODE=blocked` y las RPCs no tienen `EXECUTE` para
`authenticated`. Supabase Storage sigue fuera de alcance.

## Current implementation checkpoint — FASE 1.17

Storage architecture foundation is prepared. Product-image originals and public web derivatives are separated by contract and immutable content-addressed paths. Supabase Storage uploads remain blocked; no Storage bucket or object has been created in DEV by this phase. Bucket creation must use the supported Storage API/CLI/Dashboard, not direct SQL metadata writes.

## FASE 1.17.1 — Storage Bucket Provisioning

Provisioning source is versioned in `supabase/config.toml`. The two product-image buckets are intentionally created empty and without upload/update/delete policies. Remote provisioning must use a supported Supabase Storage mechanism; direct application mutation of the Storage schema is not part of LIHEN architecture.

### FASE 1.17.1 DEV result

`lihen-product-originals` and `lihen-product-web` are now provisioned in DEV with their canonical limits/MIME restrictions. Both buckets are empty and no upload/update/delete policy is active. Storage upload and ProductImage write feature flags remain `blocked`.

## FASE 1.18 — Catalog Image Reconciliation & Orchestration Foundation
Catalog V1 image evidence is now represented by a deterministic reconciliation manifest and private DB structures. DEV Product Master is still empty, so all 1,003 evidence rows remain `UNRESOLVED_PRODUCT`. No PDF crop is treated as a canonical original; no Storage upload or product image write is enabled.


## FASE 1.19 — Canonical Product Master Reconciliation Foundation
Catalog V1 now has a deterministic Product Master reconciliation manifest. With DEV Product Master still empty, the dry-run classifies 816 rows as `NEW_PRODUCT`, 74 as `CONFLICT`, and 113 as `REVIEW_REQUIRED`. `NEW_PRODUCT` is only a recommendation; no product row is inserted. The 1,275 `lihen_intelligence` supplier references are auxiliary evidence only.

## FASE 1.20 — Brand & Category Reconciliation Foundation
Catalog V1 taxonomy is now represented by a deterministic reconciliation manifest and private DEV structures. The source contains 46 brand covers and 5 explicit category/section covers. With DEV taxonomy masters still empty, the dry-run yields 47 `NEW_ENTITY` candidates and 4 `REVIEW_REQUIRED` brand references. No brand/category/product row is inserted and no browser access is granted to reconciliation tables.


## FASE 1.20.1 — Taxonomy Review & Canonical Approval

Canonical taxonomy approval completed from the final commercial catalog. 46 brands and 5 explicit categories are approved in private reconciliation records; public `brands`, `categories`, and `products` remain empty until controlled import.

## FASE 1.20.2 — Controlled Taxonomy Import Foundation

Preparado el dry-run e import controlado/idempotente de la taxonomía aprobada (46 marcas + 5 categorías). El RPC `import_approved_taxonomy_controlled` permanece bloqueado para `authenticated`; `brands`, `categories` y `products` siguen sin filas. El cutover futuro está aislado en `database/migrations/pending/011_enable_controlled_taxonomy_import.sql`.

## FASE 1.20.3 — Controlled Taxonomy Import DEV Cutover

DEV canonical taxonomy imported successfully: 46 brands + 5 categories, 0 products. Idempotency was tested, a mutable-preview fingerprint defect was found and corrected, and RPC EXECUTE was revoked again after the cutover. See `docs/reconciliation/FASE_1_20_3_CONTROLLED_TAXONOMY_IMPORT_DEV_CUTOVER.md`.

## FASE 1.21 — Product Import Candidates & Review Foundation
- 1,003 catalog references converted into a local candidate snapshot anchored to the real DEV taxonomy.
- 877 resolve to canonical `brand_id`; 126 resolve to canonical `category_id`; 1,003/1,003 are taxonomy-anchored.
- Candidate statuses: 816 READY_CANDIDATE, 74 CONFLICT, 113 REVIEW_REQUIRED.
- Candidate auto-insert remains forbidden. `public.products` is not written in this phase.

## FASE 1.21.1 — Product Candidate Staging & Review Queue
DEV private staging now contains all 1,003 canonical catalog candidates: 816 READY_CANDIDATE, 74 CONFLICT, and 113 REVIEW_REQUIRED. The private review queue contains 187 rows (74 priority-1 conflicts + 113 priority-2 reviews). All 1,003 rows retain valid catalog image SHA-256 evidence. There are 0 review decisions, 0 auto-insert candidates, and `public.products` remains at 0. Temporary staging/backfill helpers were removed after verification.

## FASE 1.21.2 — Product Candidate Review Resolution Foundation
- Review mechanism for 74 CONFLICT + 113 REVIEW_REQUIRED candidates.
- 31 current multi-member identity groups (67 candidates) + 7 residual singleton conflicts.
- Controlled idempotent RPCs prepared for candidate decisions and identity-group resolutions.
- RPC EXECUTE remains revoked; no decisions recorded; public.products remains 0.

## FASE 1.21.2.1 — Business Line & Dual-Catalog Architecture Hardening

LIHEN now treats `BEAUTY_CARE` and `STYLE` as canonical business lines inside one Product Master. `business_line` is mandatory on products, categories, catalog/product source snapshots, candidate runs and candidates. The current final catalog, its 5 categories, 1,003 candidates and 187 review items are explicitly `BEAUTY_CARE`; `STYLE` is active and ready for its own future supplier/taxonomy/catalog pipeline. Create/Update Product controlled RPCs now require `p_business_line` and enforce category-line consistency, while remaining blocked for `authenticated` until a later cutover.

## FASE 1.21.4 — Human Review & Canonical Product Approval
Human visual review completed for the 187 BEAUTY_CARE review candidates. 37 identity groups were resolved; candidate decisions are 136 APPROVE_CREATE, 6 REJECT, 45 DEFER. `public.products` remains 0 and review RPCs are blocked after cutover.

## FASE 1.21.5 — Approved Product Import Candidates Foundation

The 136 human-approved Beauty Care candidates are staged privately with deterministic product IDs, reserved SKUs (`BC-10000..BC-10135`), canonical catalog codes (`BCV5-0001..BCV5-0136`) and unique slugs. DEV dry-run is `136 READY_CREATE / 0 conflicts`; `public.products` remains `0`. The controlled import RPC is installed but browser execution is revoked. This is only the human-approved subset; 816 clean `READY_CANDIDATE` rows remain outside the full Product Master cutover policy.

## FASE 1.21.5.1 — READY CANDIDATE CANONICAL APPROVAL POLICY

The 816 clean `BEAUTY_CARE` `READY_CANDIDATE` rows passed the canonical auto-approval policy with zero blocked cases. Together with 136 human approvals, the canonical approved projection is now 952 rows. No Product Master rows were created; policy approval RPC execution was re-locked after an idempotent DEV cutover.

## FASE 1.21.6 — Full Canonical Product Import Foundation
The authoritative BEAUTY_CARE pending-cutover import set is now 952 canonical approvals (136 human + 816 policy). The older 136-row import preparation remains preserved as `SUPERSEDED`. The full DEV run contains 952 unique deterministic product IDs, reserved SKUs `BC-20000..BC-20951`, catalog codes `BCV5-0001..BCV5-0952`, and unique deterministic slugs. Dry-run is 952 READY_CREATE / 0 conflicts. `public.products` remains empty and the full import RPC remains blocked.

## FASE 1.21.7 — Full Canonical Product Import DEV Cutover
DEV now contains the 952 approved BEAUTY_CARE Product Master rows (136 human-approved + 816 policy-approved). The full import RPC was fixed for stable idempotent replay before product writes, temporarily enabled, executed once, replayed with the same operation key, and re-locked. Products remain unpublished (`visible_on_website=false`), with no product images, Storage objects, STYLE products, or inventory movement.


## FASE 1.22
Canonical Product Image Linkage & Storage Pre-Cutover completed in DEV: 952 READY_LINKAGE, 51 exclusions, no image/storage/web writes.

## FASE 1.22.1 — Web image derivative dry-run
Generated 952 deterministic WebP derivatives locally (345×176, Q85, method 6, no upscale), prepared 952 `lihen-product-web` upload paths, and recorded a cryptographic manifest attestation in DEV. No upload, `product_images` insert or Web publication was executed.

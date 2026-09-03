# LIHEN WAVE 5 — GAP-017
## Brand Workspace — REUSE + EXTEND UI / READ-MODEL V1

**Recovery point de entrada:** `236d631d667f4a2382edc5ad50cb817811d92a5f`
**GAP:** GAP-017 — Brand Workspace
**Roadmap action:** EXTEND UI /brands
**Acción real después de auditoría:** REUSE + EXTEND UI / READ-MODEL
**DB migration V1:** 0
**RLS V1:** 0
**RPC V1:** 0
**PROD:** 0

## Auditoría real

`/brands` ya existe y no se reconstruye.

`BrandsPage.tsx` consume `productsComposition.getBrands.execute(createGetBrandsQuery())`.
La lectura canónica pasa por `GetBrandsHandler` y `BrandRepository`. En modo Supabase,
`SupabaseBrandRepository` selecciona únicamente `id,name,normalized_name,status`.

Esto preserva una frontera importante: React no consulta `public.brands` directamente.

GAP-015 formalizó `BrandAsset` / `BrandAssetSet`.
GAP-016 formalizó Brand Intelligence con Evidence → Candidate → Recommendation →
Human Review y protección de `MANUAL_VERIFIED`.
GAP-010 ya contiene Unified Human Review Queue como read/review model.
GAP-008 ya contiene el handoff hacia Existing Control Plane.

## Auditoría física DEV

La auditoría read-only confirma:

- `public.brands` continúa siendo Brand Master físico y contiene el campo legacy
  `logo_url`.
- `get_storefront_brands_controlled` devuelve `brand_id`, `brand_name`, `logo_url`
  y `visible_product_count` como proyección de storefront.
- no se encontró tabla/vista Brand Assets 1:N;
- no se encontró una operación Brand / Brand Asset en
  `lihen_private.control_center_operation_catalog`;
- la única función actual con nombre `brand` confirmada es
  `get_storefront_brands_controlled`;
- no se agrega persistencia ni command path inexistente desde la UI.

Por tanto, `brands.logo_url` se mantiene como compatibilidad histórica/storefront.
GAP-017 no lo convierte en Brand Asset canónico ni lo consume directamente desde React.

## Decisión

GAP-017 V1 extiende `/brands` como **workspace de observación y gobierno**.

La UI muestra:

1. Brand Master canónico;
2. estado de la foundation Brand Assets 1:N;
3. protección `MANUAL_VERIFIED`;
4. frontera Unified Human Review Queue;
5. frontera Existing Control Plane;
6. estado físico explícito: persistencia Brand Assets y operación Brand todavía
   no están disponibles en DEV.

No se crean botones falsos para aprobar, reemplazar o guardar identidad.

## Read model

`buildBrandWorkspaceReadModel()` es una proyección pura de `BrandDTO`.

No consulta Supabase.
No conoce RPC.
No conoce providers.
No crea Brand Assets.
No crea Recommendations.
No aprueba.
No ejecuta.
No persiste.

Cada marca queda marcada con:

- `FOUNDATION_READY_PERSISTENCE_PENDING`;
- `manualVerifiedProtected = true`;
- `requiresGovernedMutation = true`;
- `canMutateCanonicalIdentityFromPresentation = false`;
- Review boundary = Unified Human Review Queue;
- Mutation boundary = Existing Control Plane.

## Separación de responsabilidades

**Presentation**
- muestra estado;
- explica gobierno;
- no muta identidad.

**Brand Master / Brand Assets**
- conservan la verdad canónica.

**Brand Intelligence**
- prepara evidencia/candidatos/recomendaciones.

**Unified Human Review Queue**
- proyecta items para revisión;
- no es decision store.

**Existing Control Plane**
- sigue siendo la única frontera de ejecución gobernada cuando exista una operación
  Brand/Brand Asset formalizada.

## Alcance negativo

No SQL.
No migrations.
No RLS.
No RPC nuevos.
No Supabase write.
No Brand Asset persistence.
No Search/Vision provider.
No segunda Review Queue.
No segundo command engine.
No renderer.
No catalog integration.
No publishing.
No PROD.
No execution/canary/release gate release.

## DoD V1

- `/brands` sigue usando lectura canónica existente;
- Brand Workspace explícito en UI;
- Brand Assets foundation visible sin inventar persistencia;
- `MANUAL_VERIFIED` visible como protección;
- Review Queue y Existing Control Plane visibles como fronteras;
- React sin acceso directo a Supabase/brands/RPC;
- unit tests del read model;
- architecture tests;
- `pnpm test:architecture` PASS;
- `pnpm check` PASS;
- exact staging;
- commit/push verificados;
- continuidad actualizada;
- WAVE 5 cerrada sólo después del cierre remoto/documental de GAP-017.

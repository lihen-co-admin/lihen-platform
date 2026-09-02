# LIHEN WAVE 5 — GAP-015
## Brand Asset Domain — REUSE + BUILD FOUNDATION V1

**Recovery point de entrada:** `27ac57dc3ec084cca1f2f62957c95cdc97f1db56`
**GAP:** GAP-015 — Brand Asset Domain
**Roadmap action:** REUSE + BUILD FOUNDATION
**DB migration in V1:** 0
**RLS changes in V1:** 0
**RPC changes in V1:** 0
**UI changes in V1:** 0
**PROD changes:** 0

## Auditoría real

LIHEN ya posee Brand Master dentro de `@lihen/products` y una lectura canónica `/brands`.
En Supabase DEV, `public.brands` contiene `logo_url`, pero no existe una tabla/view
canónica de Brand Assets 1:N ni un Brand Asset Repository independiente.

Por tanto, `brands.logo_url` se conserva como compatibilidad histórica del Brand Master,
pero no se eleva a una nueva fuente de verdad paralela ni se interpreta como una
colección 1:N.

## Decisión

GAP-015 es REUSE + BUILD FOUNDATION.

Se reutiliza `Brand` como identidad canónica y se formaliza un dominio puro
`BrandAsset` / `BrandAssetSet` para representar identidad visual 1:N por marca.

No se crea todavía tabla, migration, RLS, RPC, Storage layout, UI o renderer integration.
La persistencia física sólo se decidirá después de que WAVE 5 cierre Brand Intelligence
y Brand Workspace sobre esta foundation y se contraste el diseño con la infraestructura real.

## Invariantes V1

- Todo Brand Asset pertenece exactamente a un `brandId`.
- El set acepta 0, 1 o N assets.
- IDs de assets no se duplican.
- Los kinds canónicos son `LOGO`, `WORDMARK`, `ISOTYPE` y `LOCKUP`.
- Status operativo: `ACTIVE` o `ARCHIVED`.
- Approval mode conserva `MANUAL_VERIFIED`, `AUTO_VERIFIED`, `CANDIDATE` y `REQUIRES_REVIEW`.
- `confidence`, cuando existe, debe estar entre 0 y 1.
- `sha256`, cuando existe, debe contener 64 caracteres hexadecimales.
- `sortOrder` debe ser entero no negativo.
- Como máximo puede existir un ACTIVE `isPrimary` por kind.
- Proyecciones activas/archivadas y orden son determinísticos por `sortOrder` + `id`.
- Un asset `MANUAL_VERIFIED` no es reemplazado ni mutado automáticamente por esta foundation.

## Separaciones obligatorias

GAP-015 define Brand Asset Domain. No implementa:

- búsqueda de logos;
- Vision/Search/Verification;
- scoring o selección automática;
- reemplazo automático de manual verified;
- Review Queue orchestration;
- Brand Workspace UI;
- renderer/catalog integration;
- persistencia Supabase;
- publicación.

Esas responsabilidades pertenecen a GAP-016 / GAP-017 o a gaps posteriores.

## Relación con `brands.logo_url`

`public.brands.logo_url` existe y permanece intacto. GAP-015 V1 no lo borra,
no lo migra y no lo convierte silenciosamente en BrandAsset persistido.

Una migración futura deberá definir de forma explícita cómo backfillear o reconciliar
ese valor con Brand Assets 1:N sin perder identidad, provenance ni aprobaciones humanas.

## DoD V1

- Brand Asset entity/collection pure domain;
- invariantes de ownership, kinds, status, approval, hash, confidence y ordering;
- separación explícita frente a Brand Intelligence / UI / renderer / persistence;
- tests de dominio;
- architecture tests;
- export público desde `@lihen/products`;
- `pnpm test:architecture` PASS;
- `pnpm check` PASS;
- staging exacto;
- commit/push verificados;
- continuidad actualizada.

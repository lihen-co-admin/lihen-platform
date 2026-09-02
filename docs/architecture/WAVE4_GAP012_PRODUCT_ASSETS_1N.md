# LIHEN WAVE 4 — GAP-012
## Product Assets 1:N — REUSE + CONSOLIDATE V1

**Recovery point exacto:** `30d9abd3bcb5755560822552ab0acb7c6bd7e81a`
**GAP:** GAP-012 — Product Assets 1:N
**Roadmap action:** REUSE + CONSOLIDATE
**DB migration in V1:** 0
**RLS changes in V1:** 0
**RPC changes in V1:** 0
**UI changes in V1:** 0
**PROD changes:** 0

## Decisión

LIHEN ya posee una foundation multiimagen real. ProductImage se reutiliza como
representación base y ProductAssetSet formaliza únicamente ownership, colección,
orden y compatibilidad con el generic main.

No se crea otra tabla, repository, storage, RPC ni fuente de verdad.

## Invariantes V1

- todos los assets pertenecen al mismo productId;
- un producto puede tener 0..N assets;
- IDs no duplicados;
- orden determinístico por sortOrder e id;
- ARCHIVED queda fuera de la proyección activa;
- máximo un ACTIVE isMain=true en compatibilidad generic-main.

## Fronteras

GAP-012 no decide provenance/source authority/verification (GAP-013) ni
PDF_SELECTED/WEB_SELECTED/channel policy (GAP-014).

is_main no equivale a selección de canal.

No se agrega variant_id a product_images ni bridge asset↔variant en este corte.

## Alcance negativo

0 SQL, 0 migrations, 0 RLS, 0 RPC, 0 UI, 0 PROD, 0 publishing y 0 liberación
de execution/canary/release gates.

## Definition of Done

El GAP sólo podrá cerrarse después de aplicación exacta, pnpm test:architecture,
pnpm check, scope de staging exacto, commit/push verificados, SHA remoto confirmado
y actualización del documento maestro de continuidad.

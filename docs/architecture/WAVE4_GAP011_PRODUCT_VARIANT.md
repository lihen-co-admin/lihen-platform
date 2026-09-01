# LIHEN WAVE 4 — GAP-011
## Product Variant / Commercial Presentation — Audit + Domain Foundation V1

**Recovery point exacto:** `7c43795cddc274f7d6cced3ca1c14a3e42b42c0c`  
**GAP:** GAP-011 — Product Variant  
**Roadmap action:** AUDIT → EXTEND/BUILD si procede  
**DB migration in V1:** 0  
**RLS changes in V1:** 0  
**RPC changes in V1:** 0  
**UI changes in V1:** 0  
**PROD changes:** 0

## 1. Auditoría física ejecutada

La inspección read-only del Supabase DEV no encontró una tabla física
`product_variants` ni otra tabla base con nombre equivalente a `variant` o
`presentation`.

Sí existen señales de variante como evidencia/contexto en infraestructura ya
existente:

- `lihen_private.product_image_storage_assets.variant`
- `lihen_private.visual_intelligence_candidates.candidate_variant`
- `lihen_private.visual_intelligence_candidates.variant_similarity`
- `lihen_private.visual_intelligence_decisions.decided_variant`
- `lihen_private.visual_intelligence_session_summary.decided_variant`

Conclusión: la plataforma ya reconoce el concepto de variante en Intelligence/media,
pero todavía no existe una entidad física canónica clara de Product Variant.

## 2. Auditoría del código

`packages/products` ya es el backbone empresarial del dominio Product y separa
domain/application/ports/infrastructure/strategies.

`Product` conserva la identidad Product Master y actualmente no incorpora una
colección o entidad Product Variant.

Decisión GAP-011 V1: BUILD del contrato empresarial dentro de `packages/products`,
sin introducir persistencia prematura hasta cerrar el diseño físico y su interacción
con GAP-012 Product Assets, GAP-013 Provenance y GAP-014 Channel Selection.

## 3. Responsabilidad de Product Variant

Product Variant representa una diferenciación comercial/visual bajo un único
`productId`.

Beauty Care puede usar atributos como:

- tone;
- size;
- presentation;
- quantity/unit;
- pack count.

STYLE puede usar:

- size / size range;
- color;
- material;
- piece count;
- style attributes.

Una variante NO es otro Product Master por defecto.

## 4. Fronteras

Product Variant V1 NO posee:

- sale price;
- supplier cost;
- inventory state;
- product images;
- supplier identity;
- catalog channel selection.

Esas responsabilidades continúan en sus dominios correspondientes.

## 5. Fingerprint

`productVariantFingerprint()` entrega una clave determinística para comparación,
reconciliation y review.

No es un primary key de DB, no autoriza una fusión y nunca sustituye `product_id`.

## 6. Persistencia

No se crea tabla/RPC/RLS en V1.

Esto no significa que la persistencia quede descartada. La auditoría confirmó que no
hay entidad física canónica clara, por lo que cualquier persistencia futura debe
definirse deliberadamente y considerar:

- relación Product 1:N Variant;
- supplier_product opcionalmente variant-aware;
- product_assets opcionalmente variant-aware;
- inventory/pricing/purchase/order/sale variant references donde proceda;
- RLS;
- controlled writes;
- backfill/migration strategy;
- datos STYLE/Beauty Care existentes.

La persistencia no se improvisa dentro de este primer corte del GAP.

## 7. Archivos V1

1. `packages/products/src/domain/product-variant.ts`
2. `packages/products/src/index.ts`
3. `packages/products/tests/product-variant.test.ts`
4. `tests/architecture/product-variant-foundation.test.ts`
5. `docs/architecture/WAVE4_GAP011_PRODUCT_VARIANT.md`

## 8. Seguridad / alcance negativo

- no SQL;
- no migration;
- no RLS;
- no RPC;
- no Product Master mutation;
- no UI;
- no renderer/catalog changes;
- no execution gate release;
- no PROD;
- no CUT6–CUT9 historical changes.

## 9. Definition of Done de este corte

- physical audit documented;
- canonical Product Variant domain contract;
- Beauty Care + STYLE attribute support;
- deterministic non-canonical fingerprint;
- parent Product identity preserved;
- no duplicated pricing/inventory/assets/supplier responsibility;
- unit tests;
- architecture tests;
- Typecheck/Lint/Build/Pnpm check PASS.

GAP-011 sólo podrá declararse completamente cerrado cuando el resultado de este
corte y la necesidad de persistencia física queden validados contra el gate completo.

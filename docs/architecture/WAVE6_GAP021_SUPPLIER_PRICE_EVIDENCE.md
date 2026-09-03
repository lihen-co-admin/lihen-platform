# WAVE 6 — GAP-021 Supplier Price Evidence

## Estado de diseño

Clasificación: **REUSE + EXTEND / CONSOLIDATE**.

Recovery point de entrada:

`f3a44ba57690dafece7a67c643661c6f2ad1049d`

GAP-021 no construye un segundo Pricing Domain. La auditoría confirma que LIHEN ya separa precio comercial, costo operacional confirmado, relación proveedor-producto y observaciones extraídas de documentos de proveedor.

## Auditoría

### Supplier source evidence

`lihen_private.supplier_source_records` ya conserva `unit_cost`, `suggested_sale_price`, `document_id`, `supplier_reference`, confidence y evidence. En la auditoría DEV existían 23 source records y los 23 contenían tanto unit cost como suggested sale price.

GAP-018 formalizó estos records como Supplier Source evidence. GAP-019 prepara esos records mediante Document Intelligence. GAP-020 resuelve Product Reconciliation sin autoasignar `product_id`.

### Supplier Product relation

`public.supplier_products` y `@lihen/suppliers` ya modelan `supplier_id`, `product_id`, `supplier_reference`, `last_cost`, `last_confirmed_at` y estado de la relación. En DEV existían 23 relaciones y `last_cost` todavía no estaba poblado.

Supplier Price Evidence no debe actualizar `last_cost` automáticamente: una observación documental no equivale a costo confirmado operacionalmente.

### Cost history

`public.product_cost_history` ya existe y conserva product, purchase/purchase item, supplier, unit cost, currency, source y effective date. En DEV contenía 53 registros.

La foundation actual confirma que `receive_purchase_controlled` registra `product_cost_history` con source `PURCHASE_RECEIPT` al recibir físicamente una compra. Los source kinds físicos son `PURCHASE_RECEIPT`, `LEGACY_RECONCILIATION` y `MANUAL_REVIEW`.

Por tanto, una observación de costo desde Supplier PDF no debe insertarse silenciosamente en `product_cost_history`: eso mezclaría evidencia documental con costo operacional confirmado.

### Sale price authority

`public.products.sale_price` permanece como precio comercial actual. `public.product_sale_price_history` conserva el histórico append-only y bloquea UPDATE/DELETE mediante trigger.

`public.change_product_sale_price_controlled` ya es la vía gobernada para cambios comerciales. Exige actor autenticado OWNER/ADMIN, operation key, history id, product id, precio no negativo, currency y reason; conserva historial y operación idempotente.

El Existing Control Plane ya cataloga `PRODUCT_PRICE_CHANGE → change_product_sale_price_controlled` con risk `CRITICAL`, `requires_confirmation=true`, `execution_enabled=false` y `owner_admin_only=true`.

GAP-021 no crea otro command, RPC ni price-change engine.

## Implementación GAP-021 V1

Se incorpora una policy/read-model pura en:

`packages/intelligence-core/src/capabilities/supplier-price-evidence.ts`

Responsabilidades:

1. convertir `unit_cost` y `suggested_sale_price` observados en Supplier Source Records en `IntelligenceEvidence` con Source Authority `SUPPLIER`;
2. reutilizar la clasificación de GAP-020 para separar Product Master exacto de possible/fuzzy/ambiguous matches;
3. comparar unit cost con la mejor referencia disponible, en este orden:
   - previous supplier document observation;
   - supplier relation `last_cost`;
   - product current cost;
4. comparar supplier suggested sale price contra el sale price actual sólo como diferencia informativa;
5. producir `PRICE_REVIEW` candidate;
6. producir Recommendation `REVIEW_SUPPLIER_PRICE_EVIDENCE` únicamente cuando la identidad no sea exacta o exista una diferencia que requiera revisión;
7. reutilizar Unified Human Review Queue por la ruta estándar Recommendation;
8. mantener toda futura mutación comercial separada detrás de Human Decision + Existing Control Plane.

## Invariantes

- Supplier cost/pricing observation es evidencia; no autoridad comercial.
- `suggested_sale_price` del proveedor nunca es un nuevo `sale_price` de LIHEN por sí mismo.
- Sólo `EXACT_MATCH` puede exponer `canonicalProductId` dentro de esta proyección, y aun así no autoriza mutación.
- `POSSIBLE_MATCH` conserva únicamente `candidateProductId`.
- `CONFLICT`, `REVIEW_REQUIRED` y `NEW_PRODUCT` no reciben Product Master canónico.
- `canAutoUpdateSalePrice = false` siempre.
- `canAutoWriteCostHistory = false` siempre.
- `canAutoUpdateSupplierLastCost = false` siempre.
- Una recomendación GAP-021 es R2 de revisión; una futura mutación real de sale price es una operación gobernada separada.

## Fronteras preservadas

GAP-021 NO:

- crea tabla/view de supplier price evidence;
- crea migration;
- cambia RLS;
- crea/modifica RPC;
- escribe Supabase;
- inserta en `product_cost_history`;
- inserta en `product_sale_price_history`;
- actualiza `products.sale_price`;
- actualiza `products.current_cost`;
- actualiza `supplier_products.last_cost`;
- crea un segundo Pricing Domain;
- crea otro Review Queue;
- crea otro command engine;
- modifica Purchase/Inventory/Finance;
- cambia UI;
- cambia renderer/catalog;
- publica;
- toca PROD;
- libera execution/canary/release gates.

## Cierre de WAVE 6

GAP-021 es el último GAP de WAVE 6. WAVE 6 sólo puede declararse CLOSED / PASS después de unit tests, architecture gate, `pnpm check`, staging exacto, commit/push con SHA remoto verificado y actualización/readback de continuidad.

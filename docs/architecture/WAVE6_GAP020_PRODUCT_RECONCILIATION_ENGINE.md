# WAVE 6 — GAP-020 Product Reconciliation Engine

## Estado de diseño

Clasificación: **REUSE + EXTEND / CONSOLIDATE**.

Recovery point de entrada:

`4d85cfa9adceaf67a2ec7d3a02b48df4dae32dc9`

GAP-020 no reconstruye reconciliación desde cero. La auditoría confirmó una foundation física existente de Product Master Reconciliation y Supplier Candidate Bridge, además de Unified Human Review Queue y Existing Control Plane.

## Auditoría

### Foundation física confirmada en DEV

Existen:

- `lihen_private.product_master_reconciliation_runs`
- `lihen_private.product_master_reconciliation_results`
- `lihen_private.product_master_reconciliation_decisions`
- `lihen_private.supplier_candidate_bridge_operations`
- `lihen_private.supplier_candidate_bridge_results`
- `lihen_private.supplier_source_records`

La estructura actual de resultados ya admite:

- `product_id` nullable;
- action/status/match_method;
- confidence;
- reason;
- source payload;
- candidate snapshot;
- `requires_human_review`;
- review reason;
- fingerprints/traces.

Las decisiones existentes conservan `result_id`, decision, reason, actor/date y `approved_product_id`.

Durante la auditoría se observaron 16 reconciliation runs, 3197 reconciliation results y 3197 reconciliation decisions. El Supplier Candidate Bridge contiene disposiciones como `ALREADY_LINKED` y `READY_TO_REVIEW`, incluyendo casos con y sin `matched_product_id`.

La existencia de `matched_product_id` o `product_id` en evidencia/resultados **no equivale a autorización canónica**.

### Application/domain code

`@lihen/products` conserva Product Master y sus handlers/repositories, pero no contiene un segundo reconciliation engine en Application.

`@lihen/suppliers` conserva Supplier Source Intake como evidence/source observations, pero no contiene un segundo reconciliation engine.

Por tanto no se agrega otro repository, tabla, RPC ni persistence model.

### Unified Human Review Queue

`packages/intelligence-core/src/review-queue.ts` ya incluye `PRODUCT_RECONCILIATION` y `ReconciliationReviewCandidateInput`.

La cola es read/review model y no un segundo decision store. Toda decisión debe regresar a la ruta source-specific existente.

### Existing Control Plane

Toda futura mutación gobernada continúa bajo Existing Control Plane. Intelligence prepara Candidate/Recommendation/Review; no asigna Product Master ni ejecuta mutaciones.

## Implementación GAP-020 V1

Se incorpora una policy/read-model pura en:

`packages/intelligence-core/src/capabilities/product-reconciliation.ts`

Responsabilidades:

1. interpretar señales de matching producidas por foundations existentes;
2. clasificar como:
   - `EXACT_MATCH`
   - `POSSIBLE_MATCH`
   - `CONFLICT`
   - `NEW_PRODUCT`
   - `REVIEW_REQUIRED`;
3. producir `IntelligenceCandidate`;
4. producir `IntelligenceRecommendation`;
5. producir `ReconciliationReviewCandidateInput` para Unified Human Review Queue;
6. proyectar resultados persistidos como `IntelligenceEvidence`;
7. conservar `correlationId` y evidence IDs;
8. declarar siempre:
   - `canAutoAssignProductId: false`
   - `canAutoCreateProductMaster: false`.

## Invariantes

### Exact match

Un único match exacto puede exponer `proposedProductId`, pero sigue siendo evidencia/propuesta. Product Master es master data gobernada y la asignación requiere la ruta de decisión/mutación existente.

### Fuzzy / possible match

Un fuzzy match se clasifica `POSSIBLE_MATCH`.

Regla congelada:

**Fuzzy reconciliation never autoassigns `product_id`.**

### Ambiguous / multiple candidates

Múltiples candidatos o una señal explícitamente ambigua producen `REVIEW_REQUIRED` sin `proposedProductId`.

### Conflict

Una señal conflictiva o múltiples candidatos exactos producen `CONFLICT`, revisión humana obligatoria y ningún `proposedProductId`.

### No match

Cero candidatos produce `NEW_PRODUCT` como candidate. No crea Product Master automáticamente.

## Fronteras preservadas

GAP-020 NO:

- crea tabla o view;
- crea migration;
- cambia RLS;
- crea/modifica RPC;
- escribe Supabase;
- crea un segundo reconciliation persistence model;
- crea un segundo decision store;
- crea otro Review Queue;
- crea otro command engine;
- autoasigna `product_id`;
- autocrea Product Master;
- cambia Product Variant;
- modifica Pricing;
- modifica Purchase/Inventory/Finance;
- cambia UI;
- cambia renderer/catalog;
- publica;
- toca PROD;
- libera execution/canary/release gates.

## Separación con GAP-021

Supplier Price Evidence permanece fuera de GAP-020. Costos/precios provenientes del proveedor son evidencia y no pueden modificar automáticamente `sale_price`.

## Definition of Done

GAP-020 puede declararse DONE únicamente cuando:

- tests unitarios PASS;
- architecture gate PASS;
- `pnpm check` PASS;
- staging exacto contiene sólo archivos GAP-020;
- `git diff --cached --check` PASS;
- commit/push verificados con SHA completo;
- continuity document actualizado y readback verificado.

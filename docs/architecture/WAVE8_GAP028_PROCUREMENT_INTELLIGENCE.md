# WAVE 8 / GAP-028 — Procurement Intelligence

## Estado de diseño

**Clasificación:** REUSE + EXTEND / DELTA-FIRST.

GAP-028 no crea un segundo Purchase Domain, un segundo inventory ledger, un segundo Supplier Document Intake ni un segundo motor de Intelligence. Extiende `@lihen/intelligence-core` con una capability `ANALYTICS` pura que consume read models gobernados de compras y proveedor.

## Foundation reutilizada

La plataforma ya dispone de:

- `@lihen/procurement` con `Purchase`, `PurchaseItem`, estados, repository, handlers de draft/confirm/receive y `evaluatePurchaseSupplyReadiness`.
- Existing controlled purchase flow para crear draft, confirmar y recibir.
- `PurchaseDetailPage` con lectura de readiness y conciliación Purchase ↔ Inventory.
- Inventory ledger y recepción controlada como autoridad de movimientos.
- Supplier Source Intake, Document Intelligence, Product Reconciliation y Supplier Price Evidence ya formalizados en WAVE 6.
- Existing Control Plane como frontera de ejecución gobernada.
- `@lihen/intelligence-core` y GAP-027 Inventory Intelligence como patrón de analytics read-only.

## Delta implementado

`procurement-intelligence.ts` agrega una lectura analítica explícita sobre:

- estado de recepción de la compra;
- atraso respecto a fecha esperada y grace policy;
- recepción parcial;
- anomalías internas de estado/cantidades;
- comparación observada quoted vs final cost únicamente cuando ambos valores existen en líneas recibidas;
- patrón histórico de atraso del proveedor únicamente cuando se entrega una observación histórica explícita.

La capability produce `IntelligenceEvidence` y `IntelligenceRecommendation`, conserva `correlationId`, usa `PURCHASE` como context y `ANALYTICS` como capability.

## Reglas congeladas

Procurement Intelligence:

- no confirma compras;
- no registra recepciones;
- no crea/corrige Inventory Movements;
- no actualiza costos de proveedor;
- no escribe Product Master ni Pricing;
- no postea Finance;
- no llama Supabase/RPC;
- no persiste;
- no reemplaza `evaluatePurchaseSupplyReadiness`;
- no reemplaza Purchase ↔ Inventory reconciliation;
- no infiere supplier performance desde una sola compra;
- no inventa cost variance sin quoted/final cost comparable.

Cualquier recomendación con posible impacto operacional o comercial permanece advisory y requiere Human Review / Existing Control Plane cuando corresponda.

## Archivos

- `packages/intelligence-core/src/capabilities/procurement-intelligence.ts`
- `packages/intelligence-core/src/index.ts`
- `packages/intelligence-core/tests/procurement-intelligence.test.ts`
- `tests/architecture/procurement-intelligence-foundation.test.ts`
- `docs/architecture/WAVE8_GAP028_PROCUREMENT_INTELLIGENCE.md`

## Fuera de alcance

- SQL/migrations: 0
- RLS: 0
- RPC/API: 0
- Supabase writes: 0
- UI: 0
- Product Master / Pricing mutation: 0
- Inventory mutation: 0
- Finance posting: 0
- Publishing / PROD: 0

## Definition of Done

GAP-028 sólo puede pasar a DONE cuando:

1. target tests PASS;
2. architecture suite PASS;
3. `pnpm check` PASS;
4. staged scope contiene únicamente los 5 archivos de GAP-028;
5. `git diff --cached --check` PASS;
6. commit + push a `next-phase` verificados;
7. SHA remoto completo registrado como Recovery Point;
8. documento oficial de continuidad actualizado y leído de vuelta.

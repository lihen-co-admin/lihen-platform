# LIHEN WAVE 6 — GAP-019
## Document Intelligence Pipeline — REUSE + EXTEND / BUILD CAPABILITY V1

**Recovery point de entrada:** `41de6e6645c824d9171e87d013d37da3b90ad309`
**GAP:** GAP-019 — Document Intelligence Pipeline
**Roadmap action:** BUILD
**Acción real después de auditoría:** REUSE + EXTEND / BUILD CAPABILITY
**DB migration V1:** 0
**RLS V1:** 0
**RPC V1:** 0
**UI V1:** 0
**PROD:** 0

## Auditoría

GAP-019 no parte de cero.

La plataforma ya contiene:

- `@lihen/intelligence-core` con `DOCUMENT_INTELLIGENCE`;
- `DocumentExtractionPort`;
- `VisionPort` y `SearchPort`;
- Orchestrator con permisos mínimos para `DOCUMENT_INTELLIGENCE`;
- Evidence / Candidate / Recommendation / Result / Correlation;
- Unified Human Review Queue;
- Supplier Source Intake canónico de GAP-018;
- `lihen_private.supplier_source_documents`;
- `lihen_private.supplier_source_records`;
- `lihen_private.supplier_candidate_bridge_results`;
- RPC controlados existentes:
  - `public.register_supplier_source_document_controlled`;
  - `public.ingest_supplier_source_records_controlled`.

En `packages/intelligence-core/src/capabilities` sólo existe actualmente
`brand-intelligence.ts`; no existe una capability ejecutable de Document Intelligence.

## Decisión

GAP-019 queda clasificado como **REUSE + EXTEND / BUILD CAPABILITY**.

REUSE:

1. Intelligence Core contracts;
2. Permission Model;
3. Orchestrator;
4. `DocumentExtractionPort`;
5. `VisionPort` y `SearchPort` como enrichment ports disponibles;
6. Evidence / Recommendation / Correlation;
7. Unified Human Review Queue;
8. GAP-018 Supplier Source Intake;
9. RPC/persistencia existentes para documentos y source records.

BUILD CAPABILITY:

1. contrato provider-neutral de Document Intelligence;
2. esquema estructurado esperado para supplier records;
3. normalización defensiva del resultado de extracción;
4. Evidence por documento y por record;
5. preparación de records compatibles semánticamente con GAP-018;
6. recommendation de revisión cuando la extracción sea insuficiente o ambigua;
7. handler compatible con el Orchestrator.

## Frontera de responsabilidad

Document Intelligence:

`Document → Extract → Normalize → Evidence → Prepared Source Records → Review if needed`

GAP-019 NO realiza:

- persistencia;
- SQL;
- RPC;
- Product Master matching;
- fuzzy match;
- asignación de `product_id`;
- creación de NEW_PRODUCT;
- pricing authority;
- mutation de sale price;
- Purchase/Inventory/Finance posting;
- publishing.

Product Reconciliation permanece en GAP-020.
Supplier Price Evidence permanece en GAP-021.

## Pipeline V1

La capability recibe un documento bajo contexto `DOCUMENT` o `SUPPLIER`.

Usa `DocumentExtractionPort` como dependencia obligatoria.

`VisionPort` y `SearchPort` permanecen disponibles como dependencias opcionales
para futuros enrichments del mismo pipeline; V1 no los invoca automáticamente
porque no existe todavía una policy que determine cuándo son necesarios.
Verification continúa como capability separada del Orchestrator y debe agregarse
al plan mediante `requiresVerification=true`.

La extracción espera un payload estructurado con:

```text
records[]
  sourceRowKey
  sourcePage?
  sourceSlot?
  rawText?
  supplierReference?
  productName?
  brandText?
  categoryText?
  subcategoryText?
  businessLine?
  unitCost?
  suggestedSalePrice?
  quantityHint?
  imageReference?
  extractionConfidence?
```

Cada record se transforma en:

- evidence trazable con `DOCUMENT_INTELLIGENCE`;
- prepared supplier source record;
- status:
  - `EXTRACTED` cuando existe `productName` y confidence suficiente;
  - `REVIEW_REQUIRED` cuando falta identidad suficiente;
  - `REJECTED` sólo cuando el record estructurado es inválido.

## Invariantes

- correlationId común a toda la ejecución;
- documentRef obligatorio;
- documentId obligatorio;
- sourceRowKey obligatorio y único por extracción;
- sourcePage entero cuando exista;
- confidence 0..1;
- cantidades/costos/precios no negativos;
- `EXTRACTED` requiere productName;
- business line sólo `BEAUTY_CARE` o `STYLE`;
- evidence fingerprint determinístico;
- warnings del provider no se descartan;
- confidence es calidad de evidencia, no autorización;
- ningún output de GAP-019 contiene autoridad de ejecución.

## Review

La capability genera una Recommendation de revisión R2 cuando:

- el provider retorna `PARTIAL`;
- existen warnings;
- existen records `REVIEW_REQUIRED` o `REJECTED`;
- no existen records estructurados.

La recommendation sólo prepara revisión humana.
No autoriza ingestión ni mutación.

## Persistencia

GAP-019 V1 no persiste.

La futura aplicación podrá tomar `preparedRecords` y enviarlos por el
existing controlled path de Supplier Intake después de los gates de aplicación
correspondientes.

Document Intelligence no importa Supabase, `@lihen/database`, React ni
implementaciones concretas de providers.

## Alcance negativo

- SQL / migration: 0
- RLS: 0
- RPC: 0
- Storage: 0
- UI: 0
- Product Reconciliation: 0
- Product Master mutation: 0
- Pricing mutation: 0
- Purchase / Inventory / Finance mutation: 0
- Publishing: 0
- PROD: 0
- execution/canary/release gate changes: 0

## Done Criteria V1

GAP-019 V1 queda listo para cierre cuando:

1. capability provider-neutral compilada;
2. unit tests PASS;
3. architecture tests PASS;
4. full `pnpm check` PASS;
5. staging exacto;
6. `git diff --cached --check` PASS;
7. commit/push verificados;
8. SHA remoto confirmado;
9. continuidad actualizada.

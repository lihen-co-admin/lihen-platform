# LIHEN WAVE 6 — GAP-018
## Supplier Document Canonical Intake — REUSE + EXTEND / CONSOLIDATE V1

**Recovery point de entrada:** `e57e3fe9005c19b412739b2694f3cce4beb9e78c`
**GAP:** GAP-018 — Supplier Document Canonical Intake
**Roadmap action:** EXTEND
**Acción real después de auditoría:** REUSE + EXTEND / CONSOLIDATE
**DB migration V1:** 0
**RLS V1:** 0
**RPC V1:** 0
**UI V1:** 0
**PROD:** 0

## Auditoría real

La foundation física de Supplier Document Intake ya existe en Supabase DEV y no debe
reconstruirse.

Objetos confirmados:

- `lihen_private.supplier_source_documents`
- `lihen_private.supplier_source_intake_operations`
- `lihen_private.supplier_source_records`
- `lihen_private.supplier_candidate_bridge_operations`
- `lihen_private.supplier_candidate_bridge_results`

Durante la auditoría read-only existían datos reales:

- 1 supplier source document;
- 23 supplier source records;
- 1 candidate bridge operation;
- 23 candidate bridge results.

Por tanto, el sistema ya posee historia/evidencia que debe preservarse.

## RPC controlados existentes

DEV expone actualmente:

- `public.register_supplier_source_document_controlled`
- `public.ingest_supplier_source_records_controlled`

`register_supplier_source_document_controlled` ya implementa:

- autenticación;
- autorización OWNER / ADMIN;
- operation key;
- idempotencia mediante request fingerprint;
- SHA-256 exacto;
- deduplicación por SHA-256;
- validación de supplier;
- source type;
- business line;
- tamaño;
- estado inicial `RECEIVED`;
- registro de evidence;
- replay seguro.

`ingest_supplier_source_records_controlled` ya implementa:

- autenticación;
- autorización OWNER / ADMIN;
- operation key + request fingerprint;
- strategy version;
- source row key obligatorio;
- confidence 0..1;
- estados `EXTRACTED`, `REVIEW_REQUIRED`, `REJECTED`;
- no reextracción silenciosa;
- actualización de estado a `READY_FOR_CANDIDATES` o `REVIEW_REQUIRED`;
- snapshot de resultado para replay idempotente.

GAP-018 no crea RPCs alternativos.

## Constraints físicos reutilizados

La foundation actual ya protege:

- SHA-256 único por documento;
- source types `PDF`, `XLSX`, `CSV`, `IMAGE`, `OTHER`;
- business lines `BEAUTY_CARE`, `STYLE`;
- estados de documento:
  `RECEIVED`, `EXTRACTING`, `EXTRACTED`, `REVIEW_REQUIRED`,
  `READY_FOR_CANDIDATES`, `REJECTED`, `FAILED`;
- FK opcional hacia Supplier Master;
- source records vinculados al documento;
- `UNIQUE(document_id, source_row_key)`;
- confidence 0..1;
- costos/precios observados no negativos;
- quantity hint no negativo.

## Auditoría de código

`@lihen/suppliers` ya es el package canónico del Supplier Master con Domain,
Application, Ports e Infrastructure.

Sin embargo, antes de GAP-018 no existe dentro del package un contrato canónico
para representar `supplier_source_documents` y `supplier_source_records`.

`SuppliersPage` y `composition/suppliers.ts` administran Supplier Master.
No deben convertirse en un intake improvisado ni hacer RPC de documentos
directamente desde React.

## Decisión

GAP-018 es **REUSE + EXTEND / CONSOLIDATE**.

REUSE:

1. Supplier Master existente;
2. tablas privadas existentes;
3. RPC controlados existentes;
4. idempotency/request fingerprint existente;
5. source SHA-256 y deduplicación existente;
6. candidate bridge existente como foundation posterior;
7. Existing Control Plane como frontera general de mutaciones gobernadas.

EXTEND:

1. formalizar en `@lihen/suppliers` el contrato de Supplier Source Document;
2. formalizar Supplier Source Record como evidencia subordinada a un documento;
3. congelar invariantes compatibles con DEV;
4. exponer un snapshot puro Document → Records para consumo posterior.

CONSOLIDATE:

La terminología de aplicación queda alineada con la foundation física actual.
No se crea `SupplierDocument` paralelo con otra identidad, otro lifecycle o
otro repository.

## Contrato V1

`SupplierSourceDocument` conserva:

- id;
- supplierId nullable;
- sourceName;
- sourceType;
- sourceSha256;
- sourceSizeBytes;
- sourceReference;
- sourceDate;
- businessLine nullable;
- status;
- extractionStrategyVersion.

`SupplierSourceRecord` conserva observaciones provenientes de la fuente:

- documentId;
- sourceRowKey;
- page / slot;
- raw text;
- supplier reference;
- product name observado;
- brand/category/subcategory text;
- business line;
- unit cost observado;
- suggested sale price observado;
- quantity hint;
- image reference;
- extraction confidence;
- extraction status;
- evidence.

Estos datos son **evidence/source observations**. No son Product Master,
Brand Master, Pricing authority ni Purchase posting.

## Invariantes V1

- document id requerido;
- source name requerido;
- SHA-256 exacto de 64 hex, normalizado a lowercase;
- source size entero seguro y no negativo cuando exista;
- source date válida `YYYY-MM-DD` cuando exista;
- record id requerido;
- documentId requerido;
- sourceRowKey requerido;
- confidence entre 0 y 1;
- unit cost / suggested sale price / quantity hint no negativos;
- quantity hint entero;
- un record `EXTRACTED` requiere productName;
- todos los records de un intake snapshot pertenecen al mismo documentId;
- no hay record IDs duplicados;
- no hay sourceRowKey duplicados;
- ordering determinístico por page → row key → id.

## Separación GAP-018 / GAP-019 / GAP-020 / GAP-021

### GAP-018 — Canonical Intake

Responsable de identidad del documento, lifecycle base, fingerprint/source
metadata y envelope canónico de source records.

### GAP-019 — Document Intelligence Pipeline

Responsable de usar DocumentExtraction/Vision/Search/Verification para producir
extracción estructurada y evidence. GAP-018 no implementa providers ni pipeline.

### GAP-020 — Product Reconciliation Engine

Responsable de comparar source records/candidates con Product Master. GAP-018
no asigna `product_id`, no hace fuzzy match y no crea productos.

### GAP-021 — Supplier Price Evidence

Responsable de formalizar la semántica comercial de costo/precio observado,
histórico, comparación y recommendation. GAP-018 sólo transporta valores
observados ya existentes; nunca modifica sale price.

## Alcance negativo

GAP-018 V1 no agrega:

- SQL;
- migraciones;
- tablas;
- RLS;
- RPC;
- Storage;
- UI de upload;
- Document Intelligence;
- Vision/Search providers;
- Product reconciliation;
- Product Master mutation;
- Brand mutation;
- sale price mutation;
- Purchase posting;
- Inventory posting;
- Finance posting;
- Publishing;
- PROD;
- execution/canary/release gates.

## Resultado esperado

Después de GAP-018, WAVE 6 tendrá una frontera canónica en código para que
GAP-019 pueda producir Supplier Source Records sobre la foundation física ya
existente, sin acoplar Intelligence a Supabase y sin crear un segundo sistema
de Supplier Document Intake.

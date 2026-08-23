# Supplier Document Intake — Capability transversal

## Razón

El intake de documentos de proveedor ya existe técnicamente, pero sus migraciones históricas se llamaron `phase5_*` antes de formalizar el roadmap oficial. No se renombran migraciones aplicadas.

## Objetos existentes

- `lihen_private.supplier_source_documents`
- `lihen_private.supplier_source_records`
- extracción estructurada
- bridge a `product_import_candidate_runs`
- `product_import_candidates`
- revisión/decisión
- approved import infrastructure

## Invariantes

- SHA-256 para idempotencia documental.
- `source_row_key` para idempotencia por registro.
- proveedor puede ser desconocido al recibir el documento.
- no inferir costo/precio faltante.
- no modificar Product Master automáticamente.
- no modificar inventario automáticamente.
- aprobación humana/política antes del comando de escritura.

## Estado

Foundation construida. La siguiente evolución debe implementar adapters reales por formato (PDF/XLSX/CSV/imagen) desde Infrastructure, entregando registros normalizados al contrato existente. No introducir OCR como primera opción cuando el documento tenga texto/estructura extraíble.

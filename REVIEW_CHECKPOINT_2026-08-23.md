# LIHEN Platform — Checkpoint acumulado para revisión

Fecha del paquete: 2026-08-23
Base del paquete: `lihen-platform-phase3-synced-clean.zip`
Supabase DEV autoritativo: `lihen-platform-dev` (`vnmkupzptujtywnnabkp`)

## Estado operativo que NO debe alterarse al abrir este ZIP

- FASE 3.10: `APPROVED`
- Batch FASE 3.10: `PREPARED`
- `ARMED`: NO
- `APPLIED`: NO
- FASE 3.11: verificador construido, pendiente de que 3.10 quede APPLIED
- FASE 4: foundation + entry gate + diagnósticos construidos
- FASE 5: supplier document intake + extraction adapter + candidate bridge construidos

El run de cutover aprobado en DEV es:

`201d9f46-383f-4ac0-8f78-76e35c65aafd`

El ARM/EXECUTE de 3.10 debe realizarse únicamente con una sesión OWNER real. No modificar tablas privadas para saltarse esa protección.

## Resolución de TikTok

El registro legacy `TikTok` no representa un producto físico. Era un placeholder contable usado para registrar gastos/promociones de TikTok pagados con fondos de LIHEN. Quedó resuelto como `SKIPPED + HUMAN_APPROVED` para PRODUCT e INVENTORY. No debe crearse como producto ni generar inventario canónico. Su evidencia financiera histórica debe preservarse.

## Diagnóstico FASE 4

Actualmente hay 7 checks PASS y 1 WARN estructural.

PASS:
- precios activos no negativos
- inventario no negativo
- integridad referencial inventario-producto
- SKU únicos
- catalog_code únicos
- slug únicos
- productos visibles con imagen principal

WARN:
- `PRODUCT_COST_COMPLETENESS`: 952 productos activos preexistentes tienen `current_cost = NULL`.

No inventar costos para cerrar esa advertencia. Debe resolverse como decisión de calidad de datos en FASE 4.

## Foundation FASE 5

Flujo preparado:

Documento de proveedor (PDF/XLSX/CSV/imagen)
→ registro con SHA-256
→ extracción estructurada
→ `supplier_source_records`
→ comparación contra Product Master
→ `EXISTING_MATCH` / `READY_CANDIDATE` / `REVIEW_REQUIRED` / `REJECTED`
→ revisión/decisión
→ importación controlada futura

No existe auto-insert hacia Product Master ni inventario.

## Migraciones añadidas desde el último checkpoint local

1. `20260823031829_phase3_finance_opening_balance_controlled.sql`
2. `20260823031907_phase3_product_initial_cost_controlled.sql`
3. `20260823031938_phase3_cutover_private_finance_cost_helpers.sql`
4. `20260823032049_phase3_controlled_cutover_executor_foundation.sql`
5. `20260823032116_phase3_post_cutover_verification_controlled.sql`
6. `20260823034542_phase4_entry_gate_foundation.sql`
7. `20260823045752_phase4_operational_readiness_diagnostics.sql`
8. `20260823142223_phase5_supplier_document_intake_foundation.sql`
9. `20260823142900_phase5_supplier_document_extraction_adapter.sql`
10. `20260823143218_phase5_supplier_records_candidate_bridge_foundation.sql`

Las 10 fueron verificadas contra `supabase_migrations.schema_migrations` en DEV: contenido exacto (MD5 idéntico sin contar el salto de línea final de archivo).

## Secuencia recomendada al volver al PC

1. Trabajar sobre el repositorio Git real, no convertir este ZIP limpio en reemplazo ciego de `.git`.
2. Ejecutar `git status --short` y confirmar el estado local.
3. Comparar/sincronizar estas 10 migraciones con `database/migrations/`.
4. Ejecutar `pnpm check`.
5. Revisar cambios y hacer commit del bloque FASE 3/4/5.
6. Iniciar sesión OWNER real en el entorno correspondiente.
7. ARM FASE 3.10.
8. Ejecutar FASE 3.10.
9. Ejecutar FASE 3.11 y exigir todos los post-checks PASS.
10. Confirmar `phase4_entry_readiness = READY`.
11. Revisar FASE 4, especialmente estrategia de costos faltantes.
12. Confirmar gate de FASE 5 y continuar con decisiones de candidatos/proveedores.

## Principio arquitectónico permanente

UI → APPLICATION → DOMAIN → INFRASTRUCTURE → DATABASE

Primero dominio y problema real; luego el patrón que ayude. Nunca el patrón primero.

Este paquete está pensado para REVISIÓN y sincronización segura. No contiene `.git` ni `node_modules`.

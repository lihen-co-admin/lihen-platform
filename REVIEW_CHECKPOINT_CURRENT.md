# LIHEN Platform — Checkpoint actual

Fecha: 2026-08-23
Base física de trabajo: `lihen-platform.zip`
Supabase DEV autoritativo: `vnmkupzptujtywnnabkp`

## Estado operativo confirmado en DEV

### FASE 3.10

- run: `201d9f46-383f-4ac0-8f78-76e35c65aafd`
- batch: `d57979b9-9c07-4f3c-86b7-a2e909893e96`
- run status: `APPLIED`
- batch status: `APPLIED`
- plan count: 1019
- receipts: 1019
- APPLIED receipts: 130
- SKIPPED receipts: 889
- FAILED receipts: 0

Conteos post-cutover:

- products: 1005
- suppliers: 8
- customers: 7
- orders: 3
- purchases: 1
- financial accounts: 2
- financial movements: 2
- stock_on_hand: 83
- stock_reserved: 5
- stock_pending: 7

NO volver a ARM/RETRY/EXECUTE FASE 3.10.

### FASE 3.11

- verificación ejecutada con sesión OWNER real.
- 9/9 post-checks: PASS.
- warnings: 0.
- failed checks: 0.
- FASE 3 cerrada formalmente.

- `verification_status = PASS`
- requiere `verify_phase3_cutover_controlled(run_id)` con sesión real OWNER/ADMIN.
- la UI DEV fue actualizada para retirar ARM/RETRY/EXECUTE y exponer únicamente `VERIFICAR FASE 3.11` cuando corresponde.

### FASE 4

- `phase4_entry_readiness = READY`
- reason: `PHASE3_EXIT_GATE_PASSED`
- diagnostics: 7 PASS + 1 WARN
- WARN: `PRODUCT_COST_COMPLETENESS`, 952 productos activos sin costo.
- no inferir costos.

Se añadió foundation de dominio para política compartida PDF/Web sin activar publicación.

### FASE 5

Storefront sigue siendo foundation y no reemplaza legacy. El placeholder fue actualizado para reflejar el roadmap oficial.

### Supplier Document Intake

Se mantiene como capability transversal. Sus migraciones históricas `phase5_supplier_*` no se renombran.

## Matriz ZIP ↔ DEV

| Área | ZIP actual | DEV | Estado | Requiere OWNER | Se puede hacer sin PC |
| --- | --- | --- | --- | --- | --- |
| Migraciones activas por versión | 112 | 112 | ALINEADAS por version set | No | Sí |
| Migraciones recientes 3–5 | presentes | aplicadas | Sincronizadas | No | Sí |
| FASE 3.10 | código local actualizado | APPLIED | Cerrada | No | Sí |
| FASE 3.11 | verificación post-cutover ejecutada | PASS | Cerrada: 9/9 checks PASS, 0 fallos | No | Sí |
| FASE 4 gate | foundation presente | READY | PHASE3_EXIT_GATE_PASSED | No | Sí |
| FASE 4 policy | preparada en dominio | sin nuevas DDL | Preparación segura | No | Sí |
| FASE 5 Storefront | placeholder/foundation | sin cutover público | Preparación segura | No | Sí |
| Supplier Intake | foundation presente | foundation aplicada | Preservada | No | Sí |

## Integridad de migraciones

El set de versiones local fue reconciliado a las 112 versiones registradas en DEV. En `database/migrations/pending/` permanecen además 11 SQL históricos/pendientes que no forman parte del version set aplicado de Supabase y no se contabilizan como migraciones activas. Se recuperaron migraciones faltantes y se corrigieron timestamps locales que no correspondían al historial de Supabase.

Sin embargo, una comparación MD5 completa muestra que varias migraciones históricas antiguas aún difieren en contenido respecto al SQL almacenado en `supabase_migrations.schema_migrations`. DEV continúa siendo la autoridad. Esta deuda debe cerrarse antes de exigir rebuild limpio/Go-live (FASE 7). No se reescribieron decenas de migraciones a ciegas.

El bloque reciente y las migraciones recuperadas durante esta revisión sí fueron contrastados por MD5 cuando se reconstruyeron.

## Validación local en este entorno

- `packages/catalog` typecheck aislado: PASS.
- `apps/storefront` typecheck aislado: PASS.
- `pnpm check`: NO ejecutable aquí porque el entorno tiene Node 22, el proyecto requiere Node >=24 y Corepack no puede descargar pnpm por falta de red.
- Vitest: NO ejecutable con el `node_modules` del ZIP porque faltan dependencias del árbol (`@vitest/utils`).
- El intento de typecheck global con el node_modules empaquetado produce errores de dependencias/tipos externos y no se considera una validación fiable del cambio.

## Siguiente gate real

FASE 3 cerrada formalmente. Siguiente gate: iniciar FASE 4 — Catálogo PDF canónico desde `phase4_entry_readiness = READY`, sin volver a ejecutar ARM/RETRY/EXECUTE ni FASE 3.11.

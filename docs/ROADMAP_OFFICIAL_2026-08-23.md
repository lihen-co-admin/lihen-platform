# LIHEN Platform — Roadmap oficial

Fecha de corte: 2026-08-23
Supabase DEV autoritativo: `vnmkupzptujtywnnabkp`

## Fases oficiales

| Fase | Alcance oficial | Estado actual |
| --- | --- | --- |
| FASE 1 | Fundaciones y seguridad | CERRADA |
| FASE 2 | Control Center y operación real | Base operativa construida; revisar gaps reales, no regresar artificialmente |
| FASE 3 | Migración legacy → universo canónico | 3.10 APPLIED; 3.11 pendiente de verificación OWNER/ADMIN |
| FASE 4 | Catálogo PDF canónico y versionado | Gate bloqueado hasta PASS de 3.11; foundation existente |
| FASE 5 | Storefront público canónico | Foundation/placeholder; no sustituye legacy todavía |
| FASE 6 | LIHEN Intelligence | Solo criterios/foundation; no iniciar automatismos irreversibles |
| FASE 7 | Go-live y retiro progresivo del legacy | No iniciar cutover final antes de E2E, seguridad, backup, monitoreo y rollback |

## Capability transversal: Supplier Document Intake

Las migraciones históricas llamadas `phase5_supplier_*` se conservan sin alterar su nombre porque ya fueron aplicadas. En el roadmap oficial se clasifican como una capability transversal de Procurement/Product Intake, no como la FASE 5 principal.

Flujo:

Documento proveedor → Intake → Source Evidence → Source Records → Product Candidates → Matching/Reconciliation → decisión humana/política → importación aprobada → comandos controlados → Product Master.

Nunca debe existir el salto directo `documento → Product Master/inventario`.

## Gate inmediato

1. `FASE 3.10 = APPLIED`.
2. Ejecutar `verify_phase3_cutover_controlled` con sesión real OWNER/ADMIN.
3. Exigir `FASE 3.11 = PASS`.
4. Confirmar `phase4_entry_readiness = READY`.
5. Solo entonces activar implementación/persistencia nueva de FASE 4.

## Regla de arquitectura

UI → APPLICATION → DOMAIN → INFRASTRUCTURE → DATABASE

Primero dominio y problema real; luego el patrón que ayude. Nunca el patrón primero.

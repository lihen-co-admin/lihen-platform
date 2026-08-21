# LIVE MIGRATION RECONCILIATION — 2026-08-21

## Propósito

El snapshot 1.22.1 fue generado antes de crear el repositorio Git oficial. Por eso `database/migrations/` conserva algunos nombres/timestamps históricos del artefacto local que no coinciden 1:1 con `supabase_migrations.schema_migrations` en DEV.

No se renombra ni se borra historia antigua a ciegas. DEV es la autoridad sobre qué migraciones fueron realmente aplicadas; el snapshot conserva la evidencia local de cómo se construyó la fase.

## Drift histórico conocido

| Capacidad | DEV live | Snapshot local |
|---|---|---|
| create_brands_expand | `20260821033154` | `20260821033400` |
| create_categories_expand | `20260821033202` | `20260821033500` |
| add_product_taxonomy_refs_expand | `20260821033211` | `20260821033600` |
| validate_product_taxonomy_fks_empty_baseline | `20260821033254` | `20260821033700` |
| brand_category_reconciliation_foundation | `20260821162531` | `20260821170000` |

## Helpers aplicados live sin archivo individual en el snapshot

Estos helpers fueron temporales y quedaron retirados por migraciones posteriores. Su ausencia como archivo individual en el ZIP no significa que estén pendientes de ejecución:

- `20260821165607 temporary_product_candidate_staging_ingest_bridge`
- `20260821170959 private_product_candidate_staging_batch_helper`
- `20260821171555 remove_temporary_product_candidate_staging_bridges`
- `20260821171620 private_candidate_hash_backfill_helper`

## Regla desde el repositorio oficial

A partir de las migraciones posteriores al snapshot, el repositorio debe conservar exactamente el timestamp y nombre registrados en DEV.

Se incorporan con identidad live exacta:

- `20260821204612_image_source_quality_provenance_human_fallback_contract.sql`
- `20260821204652_public_default_privileges_security_hardening.sql`
- `20260821204746_database_performance_index_hardening_v2.sql`
- `20260821204934_public_default_privileges_complete_default_deny.sql`
- `20260821212533_web_image_storage_cutover_foundation.sql`

## Regla futura

Una vez exista el primer commit oficial:

1. migración se crea/versiona localmente;
2. se valida local/DEV;
3. se aplica mediante workflow de migraciones;
4. `database/migrations/` y `supabase_migrations.schema_migrations` deben coincidir para toda migración nueva;
5. no se hacen cambios de esquema ad-hoc fuera de migraciones.

El drift histórico anterior queda documentado y no se usa como plantilla para fases futuras.

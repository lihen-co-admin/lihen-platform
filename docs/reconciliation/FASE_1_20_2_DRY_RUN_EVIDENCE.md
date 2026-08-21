# FASE 1.20.2 — DEV Dry-run Evidence

Run aprobado: `320706a7-e345-5936-892a-d01727ad0afb`

Resultado DEV antes de cutover:

- preview rows: 51
- READY_CREATE: 51
- ALREADY_EXISTS: 0
- CONFLICT: 0
- brands: 0
- categories: 0
- products: 0
- taxonomy_import_operations: 0
- `anon EXECUTE import_approved_taxonomy_controlled`: false
- `authenticated EXECUTE import_approved_taxonomy_controlled`: false

La función está instalada como `SECURITY DEFINER`, pero físicamente bloqueada para navegador.
No se ejecutó el import real.

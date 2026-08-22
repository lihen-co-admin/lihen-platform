# FASE 1.28 — Legacy LIHEN Admin read-only export

## Purpose
Recover authoritative operational evidence from the historical LIHEN Admin Supabase project `admhxolrhhipwcxbythl` without changing any historical record.

## Source evidence from LIHEN_ADMIN_PRO
The legacy application references the project URL directly in `js/config.js`. Its repositories read the following operational tables: products, inventory, inventory_movements, quick sales/items, orders/items, financial accounts/movements, suppliers and related supplier tables, and product cost history.

Historical documentation also reports an 85-product inventory snapshot (79 physical, 8 reserved, 71 available) on 2026-08-07 and a later 466-row Excel on 2026-08-17. Those reports are evidence, not a substitute for a fresh database export.

## Safety contract
- GET/read requests only.
- No POST/PATCH/DELETE against PostgREST tables.
- Authentication is done locally with the legacy admin account.
- Password is held only in the PowerShell process environment and removed in `finally`.
- Export contains no access token or password.
- Export directory must never be committed to Git.

## Run from Git Bash
```bash
powershell -NoProfile -ExecutionPolicy Bypass -File "./tooling/run-legacy-lihen-export.ps1"
```

After completion, ZIP the generated `legacy-export-*` folder and attach it to the Phase 1.28 conversation.

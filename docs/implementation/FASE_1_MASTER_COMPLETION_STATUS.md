# FASE 1 MASTER COMPLETION — CURRENT STATUS

Fecha de corte: 2026-08-21

## PASS

- Reconstrucción histórica 1.1 → 1.22.1
- 1.22.1 Web derivative dry-run
- 1.22.1A Image source / quality / provenance / human fallback contract
- 1.24 Public default privileges security hardening
- 1.26 Database performance hardening (con INFO privados documentados)

## En ejecución

### 1.22.2 — Web Image Storage DEV Cutover & Metadata

Foundation server-side aplicada. Tooling local validado en dry-run: 952/952, 2,784,930 bytes.

Estado live previo al upload:
- Storage web objects = 0
- product_images = 0
- storage asset metadata = 0
- cutover operations = 0
- visible products = 0
- legacy main_image_url non-null = 0

Falta ejecutar Storage API desde entorno autorizado con `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` server-side.

## PENDING

### 1.23 — Repository reproducibility

- Repo oficial privado creado: `lihen-co-admin/lihen-platform`.
- Falta `pnpm-lock.yaml` generado con Node 24 + pnpm 10.15.0.
- El runtime de auditoría actual no puede descargar Node/pnpm por restricción de red; no se rebaja el contrato a Node 22.

### 1.25 — Auth password security

Security Advisor mantiene: `Leaked Password Protection Disabled`.
Debe habilitarse en Supabase Auth y volver a correr Security Advisor.

### 1.27 — Authoritative runtime/test verification

Depende de Node 24 + pnpm 10.15.0 + lockfile y de completar los cutovers pendientes.

### 1.28 — Legacy inventory & cash reconciliation

La fuente autoritativa antigua aún no fue localizada en los Supabase conectados ni en la biblioteca disponible. No se migrará stock/caja desde archivos demostrativos o fuentes ambiguas.

### 1.29 — End-to-end acceptance / Phase 1 exit gate

Bloqueada hasta que todos los bloques obligatorios anteriores estén PASS.

## Fase 2

`NOT AUTHORIZED`.

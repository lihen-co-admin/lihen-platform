# FASE 6.3 — Storefront Release Candidate Manifest & Provenance

Estado: IMPLEMENTED — pendiente de ejecución y evidencia real.

## Objetivo

Crear un Release Candidate identificable, auditable y reproducible antes de FASE 7, sin desplegar ni modificar producción.

FASE 6.3 no introduce un patrón de dominio nuevo. Es tooling de release y trazabilidad.

## Precondiciones

- FASE 5 cerrada en `PHASE5_STOREFRONT_E2E_EXIT_GATE_V1 · PASS`.
- FASE 6.1 validada.
- FASE 6.2 validada.
- Worktree Git limpio.
- Variables explícitas de release disponibles en la sesión.
- El manifiesto debe escribirse fuera del repositorio.

## Comando canónico

```bash
export LIHEN_RELEASE_CANDIDATE="LIHEN-STOREFRONT-RC-2026-08-24-01"
export LIHEN_RELEASE_ENVIRONMENT="DEV"
export LIHEN_PHASE5_E2E_EVIDENCE_COMMIT="ad71bf8"
export LIHEN_RELEASE_MANIFEST_PATH="../lihen-release-artifacts/LIHEN-STOREFRONT-RC-2026-08-24-01.json"

pnpm prepare:storefront:release-candidate
```

`VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` también deben estar presentes según el contrato de FASE 6.1.

## Qué ejecuta

1. Verifica que Git esté limpio.
2. Ejecuta `pnpm check`.
3. Ejecuta `pnpm test:e2e:storefront`.
4. Ejecuta `pnpm build:storefront:release`.
5. Rechaza cambios inesperados generados por la validación; solo tolera `*.tsbuildinfo`.
6. Calcula inventario, tamaño y SHA-256 por archivo de `apps/storefront/dist`.
7. Calcula un SHA-256 agregado estable del artefacto.
8. Registra commit Git, rama, Node, package manager y referencia del proyecto Supabase.
9. Escribe el manifiesto fuera del repositorio.

## Información que NO se persiste

- service-role key
- publishable key
- JWT
- contraseñas
- tokens de sesión
- secretos de despliegue

El manifiesto solo registra que una publishable key estuvo presente y la referencia pública del proyecto derivada de la URL.

## Gate de cierre de FASE 6.3

FASE 6.3 puede cerrarse únicamente cuando una ejecución real termine con:

```text
Storefront Release Candidate manifest: PASS
```

y se conserven como evidencia:

- Release Candidate ID.
- Commit SHA.
- SHA-256 agregado del `dist`.
- cantidad de archivos y tamaño total.
- ruta del manifiesto.
- `pnpm check` PASS.
- Storefront E2E PASS.
- Release environment contract PASS.
- Dist integrity PASS.

Después de capturar la evidencia, los cambios `*.tsbuildinfo` generados por TypeScript se restauran con Git.

## Límite de seguridad

Este comando no despliega, no ejecuta migraciones, no cambia datos y no hace merge hacia producción.

FASE 7 queda reservada para rehearsal/go-live y requiere una decisión explícita posterior.

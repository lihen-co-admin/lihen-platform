# TANDA 7 — Publishing · CUT 1

Estado del corte: IMPLEMENTADO / PENDIENTE QA LOCAL.

## Objetivo

Introducir un readiness determinístico y read-only para la cadena canónica de publicación:

`Product Master -> Eligibility -> Snapshot -> Catalog Version -> Artifact -> Storefront`

El Product Master nunca se trata como fuente publicable directa.

## Implementado

- `evaluatePublishingReadiness()` con estados `READY | REVIEW | BLOCKED`.
- Etapas explícitas: snapshot DRAFT, render ready, artifact published, storefront prepared, executed y verified.
- Detección de snapshot vacío, versión no ACTIVE, artifact publicado incompleto y discrepancias de conteos del cutover.
- `CatalogsPage` muestra Publishing readiness y la etapa actual.
- El readiness gobierna qué botón corresponde al siguiente paso, sin ejecutar acciones automáticamente.
- El cutover preparado solo queda habilitado para ejecución cuando source/eligible/blocked están reconciliados.
- La verificación continúa siendo un paso separado de la ejecución.

## Invariantes preservados

- Snapshot antes de publicar.
- Versiones publicadas inmutables.
- Artifact congelado mediante metadata + SHA-256 existente.
- No auto-publicación.
- No mutación automática desde Intelligence.
- Sin migraciones nuevas.
- Sin cambios en PROD.
- No se habilita ningún canary/release final de Governance.

## QA esperada

Después de aplicar este paquete incremental:

```bash
git diff --check
pnpm check
git status
```

Se esperan 6 tests nuevos en `publishing-readiness.test.ts` además del baseline anterior.

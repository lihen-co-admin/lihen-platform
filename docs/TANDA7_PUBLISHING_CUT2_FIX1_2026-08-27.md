# TANDA 7 — Publishing · CUT 2 FIX 1

## Motivo
El checkpoint local del CUT 2 detectó un error TypeScript en `CatalogsPage.tsx`: el insight de integridad bloqueada usaba `severity: 'ERROR'`, pero `IntelligenceInsight` solo admite `INFO | SUCCESS | WARNING | CRITICAL`.

## Corrección
- Se reemplaza únicamente `ERROR` por `CRITICAL` en el insight `catalog-artifact-integrity-blocked`.
- No cambia la lógica de `evaluatePublishingArtifactIntegrity()`.
- No cambia ningún gate, RPC, migración, write o flujo de publicación.
- No habilita ejecución ni publicación automática.

## Checkpoint requerido
```bash
git diff --check
pnpm check
git status
```

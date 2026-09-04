# WAVE 13 — GAP-044 Production Readiness

## Estado

`CUT 1 — IMPLEMENTED / VALIDATED / GAP-044 REAL EVIDENCE PENDING`

## Objetivo

Extender la autoridad única de calidad de LIHEN Platform con un modo explícito, fail-closed y auditable de Production Readiness.

Este GAP no crea un segundo Quality Gate, no crea otro Control Plane y no autoriza deployment.

## Autoridad reutilizada

Quality authority:

`tools/lihen-quality-gate.mjs`

Release controls reutilizados:

- Storefront Release Candidate;
- independent Release Candidate verification;
- release artifact integrity;
- pre-rehearsal;
- FASE 7/8 release governance;
- observability existente de GAP-042.

## Comando normal

El contrato existente permanece sin cambios:

`pnpm check`

## Production Readiness explícito

`LIHEN_PRODUCTION_READINESS_EVIDENCE_PATH=<external-json> pnpm check:production-readiness`

El archivo de evidencia debe estar fuera del repositorio.

## Evidence schema

Schema requerido:

`LIHEN_PRODUCTION_READINESS_EVIDENCE_V1`

Campos críticos:

- `targetEnvironment = PRODUCTION`;
- `releaseCandidate`;
- `gitCommitSha`;
- `qualityGate.status = PASS`;
- `releaseCandidateVerification`;
- `backup`;
- `rollback`;
- `monitoring`;
- `migrationReproducibility`;
- `safety`.

Cada evidencia crítica debe contener `status = PASS`, `evidenceRef` y `verifiedAt`.

## Fail-closed

Production Readiness devuelve `BLOCKED` si falta cualquier evidencia crítica, si una evidencia no está en PASS, si el commit no coincide con HEAD, si el manifest está dentro del repositorio, si aparece material sensible o si la evidencia indica que producción fue tocada, hubo deployment, mutación de DB o almacenamiento de secretos.

## Material sensible prohibido

El gate rechaza evidencia con patrones compatibles con service role, `sb_secret_` o `SUPABASE_SERVICE_ROLE`.

El manifest no debe almacenar secretos reales.

## Reporting

Production Readiness genera fuera del repositorio:

- `LIHEN_PRODUCTION_READINESS_LATEST.json`
- `LIHEN_PRODUCTION_READINESS_LATEST.md`

## Safety contract

El Production Readiness Gate:

- no despliega;
- no ejecuta migraciones;
- no modifica datos;
- no llama Supabase;
- no habilita dispatch;
- no habilita canary;
- no ejecuta final release;
- no toca PROD.

Un PASS significa solamente que existe evidencia suficiente de readiness para una decisión humana posterior.

PASS nunca significa deployment autorizado o ejecutado.

## Validación implementada

Self-test:

`node tools/lihen-quality-gate.mjs --self-test-production-readiness`

Cobertura fail-closed:

1. evidencia completa → PASS;
2. backup ausente → BLOCKED;
3. rollback FAIL → BLOCKED;
4. monitoring ausente → BLOCKED;
5. migration reproducibility FAIL → BLOCKED;
6. RC verification FAIL → BLOCKED;
7. HEAD mismatch → BLOCKED;
8. production touched → BLOCKED;
9. sensitive material → BLOCKED.

Test arquitectónico:

`tests/architecture/production-readiness-gate-hardening.test.ts`

## Evidencia sintética vs readiness real

Los manifests usados durante VALIDATION 1B fueron evidencia sintética de prueba.

Demuestran que el mecanismo PASS/BLOCKED funciona, pero no demuestran por sí mismos Production Readiness real.

Para cierre real todavía se requiere evidencia verificable de backup, rollback, monitoring, migration reproducibility y Release Candidate verification.

## Limitación de evidenceRef

En CUT 1, `evidenceRef` es una referencia declarativa obligatoria y no vacía.

El gate todavía no dereferencia ni autentica automáticamente el contenido externo señalado por esa referencia.

Por lo tanto:

- un manifest sintético puede probar el comportamiento PASS/BLOCKED del gate;
- un `evidenceRef` no convierte por sí solo una afirmación en evidencia operacional real;
- GAP-044 no puede cerrarse hasta auditar y conservar evidencia real de cada control requerido;
- cualquier cierre futuro debe distinguir claramente validación del mecanismo de validación de la evidencia real.


## Scope exclusions

Este GAP no modifica CI, database schema, migrations, RPC, Storefront, Control Center, Supabase configuration ni production infrastructure.

PROD permanece `HOLD / DO NOT TOUCH`.

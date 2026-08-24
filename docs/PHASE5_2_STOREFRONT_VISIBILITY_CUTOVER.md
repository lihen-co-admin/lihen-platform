# FASE 5.2 — Storefront visibility cutover

Fuente canónica inicial: catálogo PDF V2 PUBLISHED.

Flujo controlado:

1. PREPARED: congela el conjunto fuente y revalida ACTIVE + precio + imagen.
2. EXECUTED: actualiza `visible_on_website=true` únicamente para candidatos elegibles.
3. VERIFIED: comprueba visibilidad esperada, ausencia de cambios fuera del conjunto fuente y proyección Storefront consistente.

Gate: `PHASE5_2_STOREFRONT_VISIBILITY_CUTOVER_GATE_V1`.

Baseline validado antes de ejecución:
- source: 952
- eligible: 952
- blocked: 0
- already visible: 0
- outside visible baseline: 0

La ejecución se realiza exclusivamente desde una sesión autenticada OWNER/ADMIN mediante RPC SECURITY DEFINER con comprobación explícita de `auth.uid()`.

# FASE 5.12 — Storefront E2E + Exit Gate

Estado: IMPLEMENTED — el gate permanece BLOCKED hasta registrar evidencia E2E PASS desde una sesión OWNER/ADMIN real.

## Cobertura E2E

La suite `tests/e2e/storefront.spec.ts` usa Playwright y mockea exclusivamente el borde HTTP del RPC para validar UI de punta a punta sin depender de disponibilidad externa durante el test:

- Home + product rails.
- Catálogo, búsqueda, filtros y paginación.
- Detalle y galería.
- Selección persistente en localStorage.
- Consulta WhatsApp.
- Navegación móvil y ausencia de overflow horizontal.
- Metadata y ausencia de marcadores legacy.

El dato real DEV se verifica de forma independiente por el gate SQL; no se sustituye por el mock E2E.

## Exit gate

`PHASE5_STOREFRONT_E2E_EXIT_GATE_V1` exige simultáneamente:

1. FASE 4 PASS.
2. FASE 5.2 PASS.
3. Conteo visible igual al esperado del cutover.
4. Proyección Storefront igual al esperado.
5. Cero productos visibles fuera de fuente.
6. Evidencia E2E registrada con resultado PASS.

No se finge `auth.uid()`. El registro de evidencia requiere sesión real OWNER/ADMIN.

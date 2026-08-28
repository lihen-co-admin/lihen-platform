# TANDA 1 — LIHEN Admin Foundation — Cierre

Fecha de cierre: 2026-08-27

## Estado

**CLOSED / PASS**

La TANDA 1 queda cerrada como fundación transversal del LIHEN Control Center. El cierre se apoya en el checkpoint local ejecutado sobre Windows/Git Bash con `git diff --check`, `pnpm check` y `git status`.

## Evidencia QA local

- `git diff --check`: sin errores de whitespace; únicamente avisos LF -> CRLF no bloqueantes.
- `typecheck`: PASS en los workspaces aplicables, incluido `apps/control-center`.
- `lint`: PASS.
- `tests`: 62 archivos PASS / 199 tests PASS.
- `tests/architecture/boundaries.test.ts`: 16 tests PASS.
- `build`: PASS para Storefront, Control Center y paquetes aplicables.
- El warning de chunks > 500 kB de Vite se registra como deuda de performance/polish; no invalida el cierre funcional ni arquitectónico.

## Alcance cerrado

### Foundation transversal
- Shell administrativo LIHEN y navegación agrupada por dominios.
- Tokens visuales y estilo administrativo compartido.
- `AdminPageHero`.
- `SummaryStrip`.
- `OperationalNotice`.
- `IntelligencePanel` read-only.
- Estados de foco visibles y soporte a `prefers-reduced-motion`.

### Pantallas llevadas a Foundation
- Dashboard.
- Productos.
- Marcas.
- Categorías.
- Proveedores.
- Inventario.
- Compras.
- Pedidos.
- Ventas / POS.
- Caja y finanzas.
- Integridad y auditoría.
- Catálogos.
- Hub público.
- DEV Auth Probe.

### Truth / architecture fixes incluidos
- Alias corto para guard de autorización del Control Center.
- Alias corto para readiness de Fase 8.7.
- `.env.example` alineado con flags usados por Control Center.
- Architecture boundaries ampliados a orders, sales y finance.
- Guardrail para evitar nuevos nombres RPC que excedan el límite seguro de PostgreSQL.

## Invariantes preservados

- Production fuera de alcance.
- Execution / dispatch / canary real siguen bloqueados.
- Intelligence permanece read-only en esta etapa.
- UI no realiza writes directos a tablas de negocio.
- Product Master, historiales, snapshots, ledger, RLS, idempotencia y trazabilidad permanecen como invariantes.
- PDF publicado continúa derivándose de snapshots inmutables, no de Product Master live.

## Definition of Done usada

Cada slice se evalúa bajo el estándar rector:

1. **Generation / fundamentos** — claridad de lógica, funciones, tipos, APIs, SQL y capas.
2. **Refactoring / mantenibilidad** — responsabilidades, desacoplamiento, reutilización y ausencia de duplicación innecesaria.
3. **LIHEN Domain** — reglas canónicas e invariantes propios.
4. **Security & Governance** — RLS, auditabilidad, append-only, idempotencia y gates.
5. **LIHEN UX** — consistencia visual, estados de UI, accesibilidad básica y lenguaje operativo.
6. **QA** — typecheck, lint, tests, architecture tests y build.

## Deuda explícitamente diferida

No bloquea el cierre de Foundation:

- optimización de bundle / code splitting del Control Center;
- polish fino de performance y accesibilidad avanzada;
- expansión de LIHEN Intelligence más allá de reglas/readiness read-only;
- cierre funcional detallado de Product Master lifecycle;
- administración completa de marcas/categorías si requiere nuevos comandos de dominio;
- mejoras finas de PDF Beauty Care, PDF Style y storefront.

## Próximo bloque

**TANDA 2 — Product Master Completion**

Orden de trabajo recomendado:

1. Product Detail como ficha administrativa canónica.
2. Create / Update wiring y UX controlada.
3. Price History / cambio de precio separado del Update general.
4. Images / main image / media readiness.
5. Brand + Category + business line dependencies.
6. Lifecycle lógico: active / inactive / discontinued / archived, sin DELETE físico habitual.
7. Publication readiness e Intelligence contextual.
8. QA de cierre bajo el mismo Definition of Done.

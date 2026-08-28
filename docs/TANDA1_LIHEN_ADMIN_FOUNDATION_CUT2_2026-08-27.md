# TANDA 1 — LIHEN Admin Foundation · CUT 2

Fecha: 2026-08-27

## Objetivo

Extender la base administrativa LIHEN después del cierre de Truth & Architecture Baseline, priorizando componentes reutilizables, copy operativo humano y separación entre UI, dominio y reglas controladas.

## Estándar rector

Cada cambio se evalúa contra:

1. Fundamentos Generation / Guías Visuales: claridad, tipos, funciones, contratos, APIs, SQL y capas.
2. Refactoring.Guru: responsabilidades acotadas, reutilización, menor duplicación y patrones solo cuando resuelven un problema real.
3. Invariantes LIHEN: Product Master, trazabilidad, RLS, append-only, idempotencia y separación de dominios.
4. Security & Governance: ninguna UI evade comandos, gates o autorización.
5. UX LIHEN: identidad coherente, estados comprensibles y copy orientado a operación, no a números de fase.

## Componentes nuevos

- `AdminPageHero`: encabezado reusable con identidad LIHEN, estado y acciones.
- `OperationalNotice`: avisos operativos con tono semántico, sin duplicar bloques ad hoc.
- `SummaryStrip`: métricas compactas reutilizables para slices administrativas.

## Slices migradas en este corte

### Marcas

- Hero LIHEN.
- Resumen de marcas activas/inactivas.
- Copy orientado a taxonomía canónica en lugar de FASE 2.2.
- Estados visuales consistentes.

### Categorías

- Hero LIHEN.
- Métricas de taxonomía, raíces y business lines.
- Explicación de jerarquía compartida Product Master → Publishing.
- Badges y estados consistentes.

### Proveedores

- Hero y estado de escritura controlada.
- Métricas operativas.
- `IntelligencePanel` read-only para completitud de contacto/plazos.
- Formulario y tabla alineados con Foundation.
- Conserva comandos de dominio existentes; no modifica compras/inventario/caja indirectamente.

### Inventario

- Hero y estado del gate de ajuste.
- Resumen ON_HAND / disponible / reservado / pendiente.
- `IntelligencePanel` read-only para dependencias con Compras y Pedidos.
- Refuerzo visual de ledger como fuente de verdad.
- Ajuste físico continúa limitado a ON_HAND mediante operación controlada.

## Lo que NO cambia

- No se habilita ejecución final.
- No se toca producción.
- No se convierten recomendaciones de Intelligence en writes automáticos.
- No se sobrescriben saldos de inventario.
- No se introduce CRUD directo a tablas.

## Criterio de cierre del CUT 2

Requiere en PC local:

- `git diff --check`
- `pnpm check`
- `git status`

Los `tsbuildinfo` generados deben restaurarse antes de staging.

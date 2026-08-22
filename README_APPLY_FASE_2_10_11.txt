LIHEN PLATFORM — FASE 2.10 / 2.11

Este paquete continúa sobre el acumulado de Fase 2 ya aplicado.

Incluye:
- Dashboard operativo real.
- Pantalla /operations: integridad + auditoría.
- Bitácora append-only de operaciones controladas.
- Actualización del aviso de Ventas/POS.
- Migración espejo del cambio ya aplicado en Supabase DEV.

IMPORTANTE:
- No aplicar migraciones manualmente contra DEV: ya están aplicadas allí.
- No crear datos de prueba reales.
- Ejecutar pnpm check antes de commit.
- Revisar Dashboard, Pedidos e Integridad y auditoría.
- Fase 2.12 no se cierra hasta pnpm check + revisión visual + git status limpio.

Gate propuesto al volver al PC:
1. Reemplazar/extraer este ZIP sobre la raíz del repo.
2. pnpm install --no-frozen-lockfile
3. pnpm check
4. pnpm dev
5. Revisar /, /orders y /operations (y confirmar que módulos previamente revisados siguen cargando).
6. git status
7. No hacer commit hasta confirmar el gate.

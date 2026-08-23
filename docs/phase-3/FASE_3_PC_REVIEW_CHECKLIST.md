# Checklist PC — Fase 3 pre-cutover

1. Aplicar el contenido de `database/migrations/` y `docs/phase-3/` al repositorio local.
2. Ejecutar `git status`.
3. Ejecutar `pnpm check`.
4. Levantar `pnpm dev` y verificar que Fase 2 sigue estable.
5. No crear datos ficticios para forzar Fase 3.
6. En LIHEN_ADMIN_PRO aplicar el exportador de `tools/legacy-snapshot-exporter/`.
7. Iniciar sesión normalmente en LIHEN_ADMIN_PRO.
8. Generar el snapshot fresco de solo lectura.
9. Entregar el ZIP del snapshot sin modificar.
10. Recién después ejecutar reconciliación real + dry-run.
11. Revisar juntos ambiguos, diferencias, inventario, proveedores, pedidos, ventas y caja.
12. 3.10 requiere aprobación explícita; no se ejecuta automáticamente.

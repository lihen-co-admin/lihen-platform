# FASE 2.12 — Gate final (PENDIENTE)

Fase 2 no se considera cerrada hasta completar todos los gates siguientes sobre el mismo commit candidato.

- [ ] `pnpm check` PASS (typecheck + lint + tests + build).
- [ ] Dashboard operativo carga desde Supabase DEV.
- [ ] Pedidos carga con modo `controlled` y sin error de consola.
- [ ] Integridad y auditoría muestra todos los checks y bitácora sin error.
- [ ] Inventario, Proveedores, Compras, Ventas/POS y Caja/Finanzas continúan cargando.
- [ ] `operational_integrity_checks`: 0 incidencias.
- [ ] Security Advisor: sin ERROR nuevos; WARN SECURITY DEFINER documentados/intencionales.
- [ ] No hay datos dry-run persistidos.
- [ ] `git status` revisado; `.tsbuildinfo`, `dist`, `node_modules` y secretos no entran al commit.
- [ ] Commit + push + working tree clean.

## No forma parte del cierre de Fase 2
- Cutover de saldos/inventario/pedidos/proveedores reales desde `LIHEN_ADMIN_PRO` (Fase 3).
- Publicación web/PDF definitiva.
- LIHEN Intelligence.

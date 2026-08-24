# FASE 2 — Control Center y operación real — Exit Gate

Estado DEV: **PASS** mediante `PHASE2_CAPABILITY_INTEGRITY_EXIT_GATE_V1`.

Criterios observados al cierre:

- 11/11 checks de `operational_integrity_checks` en PASS.
- 19 operaciones controladas críticas presentes para productos, inventario, proveedores, compras, pedidos, ventas/POS y finanzas.
- 0 tablas públicas críticas sin RLS.
- OWNER activo disponible.
- auditoría operativa y eventos de dominio con evidencia persistida.

Los conteos de ventas y cierres de caja pueden ser cero en DEV sin invalidar la capacidad. El ensayo completo de navegador con todos los caminos productivos se mantiene como deuda **NON_BLOCKING** para el gate de FASE 7, donde corresponde el rehearsal final de go-live.

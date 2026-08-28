# TANDA 1 — LIHEN Admin Foundation · CUT 1

## Alcance implementado

- Fundación visual transversal del Control Center con tokens LIHEN ampliados.
- Sidebar reorganizada por dominios: Inicio, Catálogo, Operación, Administración, Control y Desarrollo.
- DEV Auth Probe queda agrupado como herramienta de desarrollo.
- Topbar refinada con señal explícita de entorno DEV.
- Nuevo componente reutilizable `IntelligencePanel`, read-only y sin auto-mutación.
- Dashboard convertido en piloto visual premium con métricas, acciones e inteligencia determinística.
- Productos convertido en segundo piloto con hero, resumen de estados, inteligencia de Product Master y acciones de fila.
- Se conserva create/update bajo flags existentes; no se inventa DELETE físico.
- Corrección contractual del release authorization guard mediante RPC corta `get_cc_release_auth_guard_controlled`.
- Frontend actualizado para consumir la RPC corta y evitar el límite de 63 bytes de identificadores PostgreSQL.

## Invariantes conservadas

- No se habilita final execution.
- No se modifica producción.
- Intelligence es informativa/read-only en este corte.
- Pricing sigue separado del update general de Product Master.
- Históricos, ledger y auditoría permanecen trazables.

## Próximo corte sugerido

Extender la foundation a Product Detail/Create/Update/Price/Images y cerrar Product Master junto con Brands + Categories antes de Supply & Inventory.

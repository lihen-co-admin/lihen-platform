# CORE 15 — Plan de migración de los 3 proyectos

## Objetivo

Consolidar `LIHEN_ADMIN_PRO`, `LIHEN_WEB_RENACER` y `lihen_intelligence` dentro de `lihen-platform` sin pérdida de trazabilidad, sin escrituras dobles y sin inventar identidades.

Arquitectura objetivo:

`UI → APPLICATION → DOMAIN → INFRASTRUCTURE → DATABASE`

Método obligatorio por dominio:

`AUDIT → CONTRACT → DRY-RUN → VALIDATE → CUTOVER → VERIFY → RELOCK`

---

## Sistemas origen y destino

| Origen | Rol histórico | Destino principal |
|---|---|---|
| `LIHEN_ADMIN_PRO` | Administración, inventario, proveedores, compras, ventas, finanzas | `apps/control-center` + packages de dominio + Supabase DEV/PROD |
| `LIHEN_WEB_RENACER` | Tienda/catálogo público y assets | `apps/storefront` + `@lihen/catalog` + Product Master + Storage |
| `lihen_intelligence` | Extracción, scoring, research, exportación | workers/adapters/intelligence service, con recomendaciones no mutantes |

---

## Secuencia de migración

### M0 — Congelación y evidencia

Estado: **PASS / ejecutado para el Core actual**.

- Export legacy read-only preservado.
- Hashes/manifiestos de evidencia.
- No borrar proyectos origen.
- No ejecutar DDL legacy sobre el nuevo proyecto.

### M1 — Identidad y Product Master

Estado: **PASS**.

- `product_id` canónico estable.
- Product Master reconciliado.
- Taxonomía, marcas e imágenes con provenance.
- Ambigüedades quedan en REVIEW/legacy-only.

### M2 — Administración y seguridad

Estado: **EN CURSO por slices / foundation PASS**.

- Auth + Profile + RLS gate: PASS.
- Control Center: nuevo runtime administrativo.
- Escrituras se habilitan RPC por RPC, nunca GRANT genérico.
- `LIHEN_ADMIN_PRO` permanece read-only como contingencia hasta paridad de cada módulo.

### M3 — Suppliers / Procurement / Inventory

Estado foundation: **PASS**.

- Supplier Core canónico creado.
- Purchases / supplier invoices creados.
- Inventory domain/ledger cerrado.
- Próximo trabajo de datos: reconciliar proveedores y documentos legacy sin insertar matches ambiguos.

Criterio de cutover:
- supplier identity reconciliation aprobada;
- balances y movimientos verificados;
- compras nuevas creadas únicamente en nuevo Core;
- legacy queda consulta-only.

### M4 — Catálogo / Storefront

Estado foundation: **PASS**.

- Catálogo versionado creado.
- Product images canónicas en storage.
- Storefront nuevo debe consumir solo versión publicada.
- `LIHEN_WEB_RENACER` se mantiene como fallback hasta paridad visual/funcional.

Criterio de cutover:
- catálogo publicado reproducible;
- búsqueda/filtros y detalle validados;
- enlaces/SEO/legal verificados;
- rollback hacia versión previa disponible.

### M5 — Domain Events / Strategies

Estado foundation: **PASS**.

- Event store inmutable.
- Outbox privado.
- DomainEventBus/EventStore contracts.
- Strategies conservadoras.
- No backfill ficticio de eventos históricos.

Criterio de cutover:
- cada nueva operación crítica emite evento de manera transaccional o mediante patrón outbox validado;
- handlers idempotentes;
- replay no cambia estado de forma no determinista.

### M6 — Intelligence

Estado: **PLANIFICADO / no cutover todavía**.

- Extraer PDF/factura → candidato/evidencia.
- Scoring/research → recomendación.
- Aprobación humana/política → operación controlada.
- Intelligence nunca hace UPDATE silencioso del Product Master, precio, inventario o compra.

Criterio de cutover:
- adapters reproducibles;
- provenance obligatorio;
- separación entre recommendation y mutation;
- fallos no bloquean operación transaccional principal.

### M7 — Ventas / pedidos / caja / finanzas

Estado: **PENDIENTE para fases posteriores**.

Esta funcionalidad existe en `LIHEN_ADMIN_PRO` legacy y no se considera migrada por el simple hecho de tener evidencia financiera preservada.

Debe migrarse por bounded context propio, con reconciliación y pruebas de invariantes antes de retirar el runtime legacy.

### M8 — Retiro final de proyectos legacy

Estado: **NO AUTORIZADO todavía**.

Un proyecto solo puede retirarse cuando:

1. Su autoridad de escritura es cero.
2. Todos los datos requeridos tienen reconciliación/verificación.
3. Existe backup verificable.
4. Existe plan de rollback probado.
5. Observabilidad no muestra errores bloqueantes durante ventana acordada.
6. El usuario/negocio aprueba el retiro.

Retirar no significa borrar inmediatamente. Primero se archiva y se conserva según política de retención.

---

## Regla de autoridad por transición

| Dominio | Autoridad actual/objetivo |
|---|---|
| Product Master | `lihen-platform` |
| Auth/Profile | `lihen-platform` / Supabase nuevo |
| Imágenes web canónicas | `lihen-platform` Storage |
| Supplier model | `lihen-platform`; legacy aún solo evidencia |
| Procurement model | `lihen-platform`; datos legacy aún pendientes de reconciliación |
| Inventory ledger canónico | `lihen-platform` |
| Catalog versioning | `lihen-platform`; publicación final aún por slice |
| Storefront | transición; legacy puede seguir sirviendo hasta cutover |
| Intelligence | legacy/reference hasta adaptación |
| Sales/orders/cash | legacy hasta futura migración explícita |

---

## Prohibiciones

- No dual-write.
- No sincronización bidireccional.
- No usar SKU/nombre como sustituto automático de identidad.
- No backfill de eventos que pretendan haber ocurrido si no hay evidencia.
- No publicar catálogo por efecto lateral de una importación.
- No aplicar recomendaciones de intelligence sin operación explícita.
- No retirar repositorios legacy antes del gate de retiro.

## Resultado CORE 15

**PASS como plan formal de migración.**

Este PASS significa que el plan requerido existe, tiene secuencia, autoridad, cutover, rollback y criterios de retiro. No significa que todos los dominios operativos futuros (por ejemplo ventas/pedidos/caja) ya hayan sido migrados.

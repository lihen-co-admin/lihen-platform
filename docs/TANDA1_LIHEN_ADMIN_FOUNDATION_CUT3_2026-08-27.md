# LIHEN Admin Foundation — CUT 3

Fecha: 2026-08-27

## Alcance

Aplicación del LIHEN Admin Design System y de LIHEN Intelligence read-only a los flujos de Compras y Pedidos.

## Compras

- Sustitución del copy técnico de fase por lenguaje operativo.
- `AdminPageHero`, `SummaryStrip`, `OperationalNotice` e `IntelligencePanel`.
- Resumen de borradores, compras por recibir y recibidas.
- Señales read-only para recepciones pendientes, borradores y ausencia de proveedores activos.
- Formulario de compra preserva el flujo DRAFT y sus invariantes: crear no afecta inventario ni caja.
- Tabla usa estados de workflow humanos sin alterar valores canónicos.

## Pedidos

- Sustitución del copy técnico de fase por lenguaje operativo.
- Resumen de borradores, pedidos en curso y completados.
- Intelligence read-only para borradores, pedidos confirmados/reservados y READY.
- Se conserva la separación entre reserva de inventario y venta completada.
- Acciones existentes de confirmar/cancelar mantienen commands y operation keys actuales.
- Canales y estados se presentan con etiquetas humanas sin cambiar contratos de dominio.

## Refactoring aplicado

- Se dejó de concentrar toda la página en una única expresión JSX minificada.
- Se extrajeron helpers locales para líneas de formularios y etiquetas de estado/canal.
- Se usaron los patrones UI compartidos creados en CUT 2 en lugar de duplicar cards/avisos/intelligence.
- No se introdujeron writes directos a Supabase ni lógica SQL en React.

## Invariantes

- DEV only durante continuidad.
- No production writes.
- No execution final.
- No inventario editable manualmente desde Compras/Pedidos.
- No auto-mutación desde Intelligence.
- Trazabilidad mediante commands/RPC y operation keys existentes.

## Próximo bloque recomendado

Admin Foundation CUT 4: Ventas/POS + Caja y Finanzas, manteniendo separación entre venta, inventario y ledger financiero.

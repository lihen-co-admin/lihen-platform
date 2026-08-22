LIHEN CORE CLOSURE — WAVE 3
CORE 14 + CORE 15

Este parche cierra los dos entregables documentales pendientes de la auditoría 02→15:
- 14 — Matriz reutilizar / adaptar / eliminar.
- 15 — Plan de migración de los 3 proyectos origen hacia lihen-platform.

No contiene migraciones SQL ni cambios de runtime.
No modifica datos de Supabase.
No importa datos legacy.

Aplicación:
1. Extraer encima de la raíz de lihen-platform.
2. Ejecutar git status.
3. Ejecutar pnpm check.
4. No hacer commit hasta validar el check.

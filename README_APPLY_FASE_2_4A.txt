LIHEN PLATFORM — FASE 2.4A INVENTARIO OPERATIVO

1. Copiar el contenido del ZIP sobre la raíz de lihen-platform.
2. En apps/control-center/.env.development.local agregar:
   VITE_INVENTORY_WRITE_MODE=controlled
3. Ejecutar:
   pnpm install --no-frozen-lockfile
   pnpm check
4. NO hacer commit si pnpm check falla.
5. Gate de navegador: abrir /inventory, confirmar lectura y realizar solo un ajuste real necesario (no inventar stock para probar).
6. Después del gate, git status antes del commit.

La migración SQL ya se aplica/valida primero en Supabase DEV durante la preparación de esta wave.

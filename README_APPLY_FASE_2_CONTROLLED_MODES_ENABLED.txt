LIHEN PLATFORM — FASE 2 DEV CONTROLLED MODES

This package is based on the user's current lihen-platform ZIP.
Only the six Fase 2 operational write-mode flags were enabled in:
apps/control-center/.env.development.local

Enabled:
- VITE_INVENTORY_WRITE_MODE=controlled
- VITE_SUPPLIER_WRITE_MODE=controlled
- VITE_PURCHASE_WRITE_MODE=controlled
- VITE_ORDER_WRITE_MODE=controlled
- VITE_SALE_WRITE_MODE=controlled
- VITE_FINANCE_WRITE_MODE=controlled

Intentionally unchanged:
- Product image metadata writes remain blocked.
- Product image storage uploads remain blocked.
- Existing Supabase DEV connection values were preserved exactly.

After replacing the local project with this package:
1. Stop any running Vite process.
2. Run: pnpm check
3. Run: pnpm dev
4. Verify /inventory, /suppliers, /purchases, /orders, /sales and /finance.
5. Do not perform real stock or financial mutations until the UI gate is reviewed.

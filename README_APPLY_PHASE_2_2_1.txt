LIHEN PLATFORM — FASE 2.2.1 UI/UX + PERFORMANCE FOUNDATION

Base: ZIP entregado por la usuaria en el estado actual de Fase 2.2.

Cambios principales:
- navegación lateral legible y espaciada;
- layout responsive;
- búsqueda + paginación de Product Master;
- lazy loading por rutas;
- corrección N+1 de taxonomía en GetProductsHandler;
- estados de carga;
- documentación de la subfase.

Validación requerida:
1. pnpm check
2. pnpm --filter @lihen/control-center dev
3. revisar Dashboard, Productos, Marcas, Categorías y Nuevo producto.

No crear productos inventados durante el browser gate.

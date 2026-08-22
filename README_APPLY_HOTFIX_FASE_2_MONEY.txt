LIHEN PLATFORM - HOTFIX FASE 2 MONEY

Problema detectado por pnpm typecheck:
OrdersPage.tsx y SalesPage.tsx esperaban salePrice:number, pero Product.salePrice es Money.

Correccion:
Usar x.salePrice.amount en la proyeccion de productos para UI.

Aplicacion:
Copiar el contenido de este ZIP sobre la raiz de lihen-platform y reemplazar los dos archivos.
Luego ejecutar:
  pnpm check

No hacer commit hasta que el gate completo pase.

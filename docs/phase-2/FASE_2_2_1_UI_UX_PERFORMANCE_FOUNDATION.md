# FASE 2.2.1 — UI/UX + Performance Foundation

## Objetivo

Mejorar la legibilidad, jerarquía visual y velocidad percibida del LIHEN Control Center sin alterar los contratos de dominio ni abrir nuevas escrituras en Supabase DEV.

## Cambios aplicados

- Sidebar con navegación separada, estado activo, iconografía ligera y espaciado consistente.
- Header de sesión más compacto y legible.
- Layout responsive para escritorio y pantallas reducidas.
- Estados de carga explícitos y accesibles.
- Búsqueda y paginación visual de Product Master (25 filas por página).
- Carga diferida de rutas con `React.lazy` + `Suspense` para dividir el bundle inicial.
- Eliminación del patrón N+1 en `GetProductsHandler`: productos, marcas y categorías se leen en bloque y se resuelven mediante mapas en memoria.
- Se conserva la arquitectura UI → APPLICATION → DOMAIN → INFRASTRUCTURE → DATABASE.
- No se modifica el gate de autorización ni se habilitan nuevas operaciones de escritura.

## Decisión de rendimiento

La optimización principal de datos no consiste solamente en renderizar menos filas. El handler anterior podía resolver marca/categoría producto por producto. Con Supabase esto generaba muchas solicitudes pequeñas. Ahora se realizan lecturas en bloque y la taxonomía se resuelve localmente en tiempo lineal.

La paginación de esta subfase limita el DOM a 25 productos por vista. Una futura paginación remota puede incorporarse como contrato de aplicación independiente si el Product Master crece lo suficiente como para justificarla.

## Referencias de diseño y refactorización

Las decisiones se mantienen compatibles con los principios discutidos a partir de Refactoring.Guru y Guías Visuales: responsabilidades separadas, cambios pequeños verificables, jerarquía visual clara, estados comprensibles y evitar complejidad accidental.

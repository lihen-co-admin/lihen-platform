# FASE 5.4 — Header, navegación y mega menú canónico

## Objetivo

Reimplementar la navegación principal de `LIHEN_WEB_RENACER` sobre el Storefront nuevo sin recuperar `products.js`, CSV runtime ni lógica de catálogo legacy.

## Implementación

- Header sticky y announcement bar conservados como lenguaje visual LIHEN.
- Navegación desktop con mega menús para Novedades, Belleza, Moda y Accesorios.
- Mega menú reusable y dirigido por configuración tipada.
- Navegación móvil con menú desplegable y paneles de categoría accesibles.
- Tecla Escape, foco, `aria-expanded`, `aria-controls` y cierre al navegar.
- Iconos de búsqueda y selección permanecen reservados para FASE 5.7 y FASE 5.9.
- No se agregó ninguna fuente de datos legacy ni acceso directo a tablas públicas.

## Taxonomía

Los nombres de categorías Beauty Care usados en navegación provienen de la taxonomía visible comprobada en DEV después del cutover FASE 5.2. No se fabricaron categorías canónicas de Style: la línea se conserva en la experiencia, pero se conectará solo a referencias publicadas cuando estén disponibles en el modelo canónico.

## Límite de fase

FASE 5.4 no implementa búsqueda, filtros, tarjetas, carruseles, detalle de producto ni selección/WhatsApp. Esos comportamientos pertenecen a FASE 5.5–5.9.

# TANDA 11 — Public Experience · CUT 2
Fecha: 2026-08-28

## Objetivo
Fortalecer la navegación pública y su comportamiento móvil sin cambiar rutas, taxonomía, catálogo ni reglas de negocio.

## Cambios

### Estado de navegación
Se agrega `public-navigation-state.ts` para resolver de forma determinística:
- menú abierto/cerrado;
- bloqueo de scroll del body en móvil;
- etiqueta accesible del botón;
- cierre de navegación cuando cambia una ruta hash del Storefront.

### Header
- al pasar a escritorio el menú móvil queda cerrado;
- `hashchange` cierra menú y mega paneles;
- enlaces del Storefront cierran navegación de forma consistente;
- navegación externa no se trata como cambio interno del Storefront.

### Mobile / accesibilidad
- touch targets mínimos de 44px y 48px en navegación móvil;
- foco visible consistente;
- mejor límite vertical del menú con `100dvh`;
- wrapping seguro en enlaces largos;
- reduced motion;
- fallback forced-colors.

## Invariantes
- No se modifican rutas.
- No se modifica taxonomía.
- No se modifican precios.
- No se modifica publication eligibility.
- Sin writes.
- Sin RPC nuevos.
- Sin migraciones.
- Sin PROD.

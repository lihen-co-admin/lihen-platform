# TANDA 11 — Public Experience · CUT 3
Fecha: 2026-08-28

## Objetivo
Pulir descubrimiento y detalle de producto para que catálogo, ficha modal y página de producto compartan una experiencia coherente, accesible y móvil.

## Cambios

### Galerías
Se agrega `product-gallery-state.ts` para centralizar:
- clamp seguro del índice;
- contador;
- estado disabled de anterior/siguiente;
- teclas de navegación horizontal.

La página de producto y el diálogo usan la misma regla.

### Diálogo de producto
- `aria-modal=true`;
- `aria-labelledby` apuntando al título real;
- foco inicial en cerrar;
- restauración de foco al elemento que abrió la ficha;
- ArrowLeft/ArrowRight solo se capturan cuando corresponden.

### Producto / mobile
- touch targets mínimos;
- foco visible consistente;
- títulos y metadatos con wrapping seguro;
- diálogo limitado por `100dvh`;
- scroll interno contenido;
- acciones accesibles en móvil;
- estado `aria-current` de miniaturas visible;
- reduced motion y forced colors.

## Invariantes
- Sin cambios de precios.
- Sin cambios de availability.
- Sin cambios de publication eligibility.
- Sin writes.
- Sin RPC nuevos.
- Sin migraciones.
- Sin PROD.
- No se inventan atributos de producto.

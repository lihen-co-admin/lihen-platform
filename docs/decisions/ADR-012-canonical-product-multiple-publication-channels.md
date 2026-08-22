# ADR-012 — Un Product Master, múltiples canales de publicación

## Estado

Aceptado como regla arquitectónica para la evolución de LIHEN Platform.

## Contexto

LIHEN mantiene dos experiencias comerciales distintas que deben compartir la misma identidad de producto:

1. catálogo PDF, de presentación compacta;
2. storefront/página web, con información y galería más completas.

Además, la existencia física pertenece a Inventory y no debe confundirse con la publicación en ninguno de esos canales.

## Decisión

Se conserva un único `product_id` canónico en Product Master. PDF y Web serán **proyecciones/canales** del mismo producto, no catálogos maestros independientes.

```text
Product Master
  ├─ PDF Catalog Projection
  ├─ Web Storefront Projection
  ├─ Product Media
  └─ Inventory
```

### Datos compartidos

Identidad, nombre, SKU/código, marca, categoría, línea de negocio y precio vigente se originan en contratos canónicos.

### Diferencias por canal

El PDF puede usar una selección compacta de campos e imagen principal. El storefront puede presentar descripción ampliada, múltiples imágenes, variantes, navegación, filtros y disponibilidad.

### Regla de inventario

`publicado` no equivale a `en stock`. Un producto puede seguir existiendo/publicado con stock cero y mostrarse como agotado según la política de canal.

### Intelligence

Intelligence puede observar identidad, publicación, contenido, inventario, ventas y mercado para generar recomendaciones, pero no debe modificar silenciosamente el Product Master ni los canales.

## Consecuencias

- se elimina la necesidad de mantener dos verdades de producto;
- se evitan divergencias de precio/nombre entre PDF y web;
- la galería enriquecida de web no obliga a sobrecargar el PDF;
- inventario, media y publicación evolucionan con contratos separados;
- los adapters del storefront legacy deberán migrar a la proyección canónica y no a datos hardcodeados/paralelos.

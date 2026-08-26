LIHEN QA-C2 — Product Detail Page Architecture
Fecha: 2026-08-25

Referencia UX:
Se toma como inspiración estructural la página de producto compartida por la usuaria:
galería + buybox + información desplegable + confianza + relacionados + FAQ.
No se copia su estética ni su contenido.

Implementado:
- Ruta real del storefront: #producto/<product_id>.
- Cards navegan a esa ficha.
- El producto se resuelve contra la proyección canónica paginando de forma segura.
- Beauty Care y Style comparten la misma arquitectura.
- Galería: Beauty Care máximo 5 / Style máximo 10.
- Mi selección y WhatsApp se conservan.
- Disponibilidad sigue gobernando si puede agregarse.
- Acordeones de información.
- Bloque de confianza LIHEN.
- Bloque preparado para relacionados reales.
- FAQ base.
- Responsive desktop/tablet/móvil.

No inventa:
- beneficios;
- materiales;
- tallas;
- variantes;
- instrucciones de uso.

Pendiente de próximas subfases:
- recomendaciones canónicas reales;
- enriquecimiento con fuentes verificadas;
- variantes/tallas/tonos;
- FAQ dinámica;
- eventual History API/SEO si se decide sustituir hash routing.

No toca Supabase, inventario, precios, visibilidad, publicación ni producción.

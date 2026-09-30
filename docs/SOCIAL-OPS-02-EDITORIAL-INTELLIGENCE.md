# SOCIAL-OPS-02 — Editorial Intelligence con evidencia

## Estado actual y frontera de investigación

PRODUCTO → IDENTIDAD → FUENTES → EVIDENCIA → RECOMENDACIÓN.

El código del runtime tiene un ModelPort Groq y transformación de imágenes, pero no un
adaptador SearchPort/retrieval conectado al Assistant. `provider-ports.ts` declara SearchPort;
Brand Intelligence define procedencia de marca, pero un contrato no constituye un buscador
instalado. No se consultaron fuentes oficiales/retailers ni se simularon búsquedas.

Fuentes internas usadas antes de generar, mediante los puertos existentes de lectura:

- GetProductById: ID, SKU, nombre, marca/categoría resueltas por IDs, código de catálogo,
  línea de negocio, estado y precio registrado.
- GetInventory: saldo del producto exacto; contexto operacional, nunca claim de urgencia.
- GetProductImages y readEditorialVideoAssets: referencias autorizadas del producto exacto;
  no se interpreta visualmente su contenido ni se infieren propiedades desde imágenes.

El ProductDetailDTO actual no expone descripción, subcategoría, atributos, ingredientes,
beneficios, uso, certificaciones, origen, composición ni presentación. No se presupone que
esos datos no existan en otra tabla: esta frontera no puede obtenerlos mediante el contrato
auditado. Se registran como INSUFFICIENT_EVIDENCE. No se crean columnas ni RPCs.

La identidad de la lectura se contrasta con el producto seleccionado (ID, SKU, nombre,
brandId/marca y categoría), y después con el producto resuelto independientemente por el
Assistant en servidor. Cualquier discrepancia rechaza la respuesta.

### Grounding y bloqueo de claims

La respuesta local separa `productIdentity`, `evidence` y los campos editoriales existentes
(`campaignName`, `variants`). `evidence` contiene internalFacts, officialBrandFacts,
secondaryFacts, unsupportedClaims, sources, usedFactIds y GENERAL_EDITORIAL_CONTEXT.
Sources incluye puerto de origen y fecha de consulta; no utiliza URLs ni evidencia generadas
por el modelo. VERIFIED_INTERNAL significa dato registrado en LIHEN, no validación clínica.

La salida libre anterior se reemplazó por un plan de fragmentos validado estrictamente:
referencias a hechos admitidos y referencias a un vocabulario editorial neutral. Los hechos
se insertan literalmente desde la lectura, nunca desde el texto del LLM. Los hashtags solo
pueden referenciar nombre/marca/categoría internos o intención editorial neutral admitida.
Ingredientes/beneficios ausentes, texto libre como «reduce manchas», referencias inventadas,
fuentes inventadas, stock/precio/media como propiedades y hashtags como #AntiAcne se rechazan.

Esta restricción reduce libertad creativa: el modelo selecciona y organiza fragmentos, no
produce prosa comercial libre. No hay recomendaciones prefabricadas usadas como fallback:
sin respuesta válida del proveedor se conserva la edición manual. Las frases neutrales son
estilo, nunca evidencia ni una simulación de investigación.

`acceptResearchEvidence` es exclusivamente una política pura para el futuro adaptador,
probada con fixtures; no se llama en producción. Requiere identidad exacta (incluida marca y
SKU), procedencia HTTPS verificada por el adaptador y fuentes separadas. Los hechos internos
prevalecen en conflictos; los oficiales compatibles pueden respaldar hechos literales;
los secundarios se conservan como secundarios y no habilitan claims. Una fuente sobre
Agua de rosas / Marca B no es admisible para Agua de rosas / Marca A.

Cada sugerencia conserva su propia evidencia. «Ver fuentes» muestra identidad, datos leídos,
procedencia, uso de hechos y carencias; nunca muestra prompts ni chain-of-thought. Cambiar de
producto elimina evidencias/propuestas anteriores y descarta respuestas tardías.

### Frontera pendiente

READY_FOR_EDITORIAL_RESEARCH_PROVIDER: implementar y autorizar un adaptador server-side
del SearchPort existente dentro de intelligence-runtime. Debe resolver identidad exacta con
marca/SKU/atributos conocidos, verificar dominio oficial y correspondencia del producto,
recuperar documentos/extractos con procedencia y fecha, rechazar homónimos/otras marcas,
distinguir fuentes oficiales/secundarias y entregar registros verificados a la política de
evidencia. Una URL o snippet propuesto por el LLM no satisface esa verificación. Falta elegir
proveedor y configurar su acceso únicamente en servidor DEV; cualquier despliegue requiere
autorización. No se añadió proveedor, secreto, scraping ni configuración remota.

## Auditoría acotada

Se reutiliza `apps/control-center/src/composition/assistant-runtime.ts`: invoca únicamente
`intelligence-runtime` con `{ action: 'ASSISTANT', productId, prompt }`.
La rama existente de `supabase/functions/intelligence-runtime/index.ts` autentica la sesión,
exige perfil ACTIVE OWNER/ADMIN y resuelve el producto mediante
`assistant-product-context-reader.ts`. `runLihenAssistantTurn` usa contexto gobernado y un
ModelPort server-side; no conecta un puerto de ejecución de operaciones.
El adaptador Groq ya existe en servidor. No se modificaron runtime, proveedor, secretos ni
configuración. Marketing Intelligence ofrece revisión estratégica, y Creative Intelligence
genera imágenes: no se usan como sustitutos de recomendaciones editoriales de texto.

## Contrato reutilizado

El nuevo adaptador local `editorial-intelligence.ts` añade instrucciones editoriales y contexto
al prompt del Assistant existente. No introduce otro productor IA ni un nuevo endpoint.

Entrada: producto seleccionado con ID durable, nombre y SKU/categoría/marca cuando existen;
concepto actual, canales/tipos de publicación, copy, CTA, hashtags y IDs de media por variante.
La autoridad de hechos sigue siendo el producto resuelto en servidor. El contexto escrito por
la operadora es información editorial, no instrucciones de sistema ni evidencia de producto.
No se completan descripciones, ingredientes o beneficios ausentes. No se envía inventario para
generar urgencia comercial; no se usan precios.

Respuesta solicitada dentro de `assistant.answer` (plan, no hechos nuevos):

```json
{
  "productId": "ID solicitado",
  "campaignName": [{ "fact": "internal:name" }],
  "variants": [
    {
      "channel": "INSTAGRAM_FEED",
      "copy": [{ "fact": "internal:name" }, { "editorial": "feed.invite" }],
      "callToAction": [{ "editorial": "cta.explore" }],
      "hashtags": ["editorial:lihen"]
    }
  ]
}
```

La interfaz valida estructura, tamaños, identidad del producto y correspondencia exacta de
canales. Rechaza respuestas inválidas y campos extra; elimina hashtags duplicados y limita su
cantidad por canal. La validación exige referencias existentes y admisibles: el modelo no
puede autocertificar evidencia. La operadora sigue revisando cada propuesta antes de usarla.
No se inserta texto alternativo prefabricado ante fallos.

## Interacción y gobernanza

- Acción integral para campaña y variantes seleccionadas; acciones secundarias por campo.
- Las propuestas viven separadas del borrador y se revisan en las pestañas existentes.
- Usar/reemplazar exige una acción explícita por campo. Regenerar no aplica contenido.
- Descartar conserva el borrador. Aplicar permite editar después de forma manual.
- Al añadir canales, copy/CTA/hashtags comienzan independientes; se conserva la política de media.
- Cambiar de producto invalida propuestas y respuestas pendientes; quitar canales descarta sus
  propuestas e invalida la generación pendiente. Cambiar de pestaña conserva las propuestas.
- Estados: Generando, Sugerencia lista, Usada/editada por operadora, No disponible y Error al generar.
- La generación no llama guardar, aprobar, programar, crear intentos ni publicar.
- Guardar mantiene el contrato existente y los IDs de producto/media. Stock cero sigue permitido.

## Validación local

- 72 tests focalizados: editorial-grounding, editorial-intelligence, assistant-runtime, editorial-workspace,
  editorial-video-assets, editorial-variant-comparison y el Assistant de intelligence-core.
- 12 Playwright: editorial-intelligence, editorial-product-selector y editorial-composer-open.
- Typecheck de Control Center, Prettier en archivos afectados y `git diff --check`.
- Los dobles de Intelligence solo existen en tests; Playwright rechaza tráfico fuera de localhost.
- No se invocó el proveedor real ni se consultaron secretos. El smoke depende de la configuración
  existente del Assistant en DEV; si el servidor informa proveedor ausente, la UX muestra
  No disponible y permite continuar manualmente. No se configura ni despliega nada en este cambio.

Smoke local: `http://127.0.0.1:5182/content/social`.

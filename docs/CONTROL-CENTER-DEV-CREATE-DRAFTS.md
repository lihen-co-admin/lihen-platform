# Control Center DEV: borradores de Crear productos, etapa 2

Base exacta: `102da0118eea84b46f3211dc4282d0829d21d9f5`.

## Causa y alcance

Crear productos usaba campos `useState` que se perdían al desmontar la página o recargar. Cada envío generaba otro `commandId`. La etapa 1 ya resuelve conservación, aislamiento y restauración; esta etapa incorpora exclusivamente `/products/new` a esa misma infraestructura. No modifica Editar productos, WebP, dependencias, workflow, SQL, RLS ni PROD.

Se reutilizan `FormDraftProvider`, `LocalFormDraft`, `FormDraftNotice` y el hook existente. El proveedor añade enumeración de identidades existentes del mismo usuario/módulo/formulario, consultando las claves del almacenamiento compartido. No hay índice persistente, caché, tabla ni mecanismo paralelo. El hook admite un ámbito nulo mientras se prepara la identidad; el aviso admite textos para formulario nuevo y operación incierta, conservando sus textos por defecto para Editar productos.

## Campos y precio

Permitidos: `sku`, `catalogCode`, `name`, `businessLine`, `brandId`, `categoryId`, `status`. Codec explícito: enum validado, strings de hasta 500 caracteres y rechazo de propiedades adicionales. Prohibidos: precio, credenciales, tokens, datos de clientes, notas y archivos.

El precio de venta es información comercial y no formaba parte de la lista aprobada en etapa 1. Sin política explícita de protección/retención para ese dato se excluye tanto del borrador como del registro local de operación; no se guarda su hash. Permanece en memoria y debe reintroducirse después de navegar, recargar o desmontar por autorización. La UI lo comunica. En una operación incierta solo se usa para comparar una lectura; no habilita otro envío.

## Identidad y recuperación

`?draft=<UUID-v4>` en la ruta hash conserva la identidad provisional. El ámbito es usuario + `products` + `new:<UUID>` + `create-identity`. Ese mismo UUID será el ID del producto en el primer envío. Al entrar sin parámetro, si existen borradores del usuario se selecciona una identidad pendiente (orden estable), pero el contenido solo se aplica al pulsar **Restaurar borrador local**. Las otras identidades aparecen como enlaces de recuperación. Una creación nueva exige una acción explícita; esa acción queda bloqueada para la operación incierta actual.

Al navegar y regresar, la instancia compartida conserva el registro; al recargar se reconstruye desde el mismo almacenamiento. Cerrar sesión invalida memoria y callbacks, conservando disco no sensible para el mismo usuario. No se muestran valores de otro usuario. El precio se pierde por diseño y se avisa. Los errores de lectura, cuota, registro corrupto y cambios detectados en otra pestaña usan la protección de la etapa 1; no se sobrescriben ni se limpian versiones ajenas.

Las marcas y categorías restauradas se comprueban contra la taxonomía canónica leída. Se exigen referencias activas y categoría de la línea correcta. Se vuelven a leer inmediatamente antes de enviar; si cambiaron, no se escribe. Las referencias vacías mantienen el contrato existente. Sigue existiendo la carrera entre lectura y RPC; no se pretende añadir validación atómica de lifecycle sin cambiar el backend.

## Auditoría del contrato real

Se inspeccionaron `create-product.command.ts`, `create-product.handler.ts`, `supabase-product-repository.ts` y la definición activa DEV de `public.create_product_controlled`, obtenida con una consulta de solo lectura a `pg_proc`/`pg_get_functiondef` en `vnmkupzptujtywnnabkp`. No se ejecutó el RPC de escritura ni se leyó información de productos reales.

Firma activa: `create_product_controlled(text,uuid,text,text,text,text,text,uuid,uuid,text,numeric)`.

- El comando transmite `commandId`, `operationKey`, actor y fecha.
- El handler primero comprueba SKU/código y taxonomía; luego genera un ID con `IdGenerator`. Reejecutar el handler puede generar otro ID o fallar en la comprobación de duplicado antes del RPC.
- El repositorio envía `p_operation_key`, `p_id`, identidad canónica y `p_sale_price` al RPC.
- El RPC busca `product_write_operations` por clave, tipo `CREATE_PRODUCT` y actor. Si encuentra el producto, devuelve ese registro. Si no, inserta producto y operación en la misma función/transacción.
- La definición activa no compara una huella del payload en la recuperación de una clave existente. Por ello no se asume idempotencia completa de la cadena handler/RPC ni seguridad para un contenido cambiado.

El adaptador de esta etapa usa el mismo `CreateProductHandler` y los mismos repositorios de la composición, con un `IdGenerator` que devuelve el UUID provisional. No modifica el handler, sus validaciones ni el RPC. Antes de enviar se valida el comando, se refresca taxonomía y se comprueba que el ID todavía no exista. La identidad de operación se conserva con `LocalFormDraft.beginSave` antes del envío:

- `commandId = operation.key`;
- `operationKey = product-master:create:<operation.key>`;
- fecha = `operation.requestedAt`;
- ID de producto = UUID provisional.

Una referencia síncrona y el estado compartido bloquean envíos simultáneos. Cualquier fallo después de entrar en el handler se conserva como incierto, incluso si el fallo podría ser un rechazo definitivo. No se envían reintentos automáticos ni manuales de esa creación. Una validación local anterior al envío puede corregirse sin eliminar el borrador.

## Confirmación y límite deliberado

Tras un resultado exitoso, la limpieza requiere lectura fresca por el ID provisional, mismo ID, todos los campos permitidos coincidentes y precio esperado en COP coincidente. El retorno del handler o el contenido local por sí solos no limpian el registro.

Tras una respuesta perdida, **Verificar creación pendiente** realiza exclusivamente esa lectura. Después de una recarga se reintroduce el precio esperado. Precio, ID o contenido no coincidentes, ausencia de producto, fallo de lectura y fallo de limpieza mantienen el borrador. Una respuesta exitosa sin evidencia legible también se trata como incierta.

Si el producto no aparece, no existe una reconciliación autorizada que pruebe que la operación jamás se ejecutará: podría seguir en vuelo. El reenvío permanece bloqueado y requiere revisión operativa DEV. No se genera otra clave ni otro ID como reintento. El botón de otra creación se bloquea para esa operación; manipular manualmente la URL para abrir otra identidad sería una creación independiente, no reconciliación de la anterior.

No se ha probado una creación real en DEV. La definición activa del backend sí se auditó; las pruebas de escritura usan exclusivamente repositorios/RPC simulados. Quedan pendientes la comprobación operativa real autorizada, carreras de concurrencia del backend, posible pérdida del almacenamiento del navegador y operaciones de otros módulos. La lista de borradores es específica del origen y navegador y no constituye cifrado ni sincronización.

## Validación

- Focalizadas: `pnpm exec vitest run apps/control-center/tests/product-create-draft.test.ts apps/control-center/tests/local-form-draft.test.ts apps/control-center/tests/product-webp-save.test.ts`.
- Chromium: `pnpm exec playwright test -c playwright.drafts.config.ts --workers=2` (Crear y regresión de Editar).
- Gate completo: `pnpm check` con pnpm 10.15.0, incluyendo typecheck, lint, pruebas y build.

Casos: navegación y ruta de creación sin parámetro, recarga/restauración, autorización, logout/usuarios, identidades provisionales, campo precio excluido, propiedades prohibidas, taxonomía inválida y cambio anterior al envío, cuota, corrupción, respuesta perdida/no confirmada, clave conservada, bloqueo del reenvío, verificación por lectura sin nuevo envío, limpieza confirmada y doble submit. Las pruebas de etapa 1 cubren además el control compartido frente a cambios de otra pestaña. La suite WebP existente permanece intacta.

El informe externo registra los resultados exactos y el árbol Git después de validar. Esta etapa prepara únicamente un candidato, sin commit ni publicación.

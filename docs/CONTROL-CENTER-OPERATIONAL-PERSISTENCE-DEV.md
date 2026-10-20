# Estabilidad y persistencia operativa DEV — candidato 2026-10-20

Base exacta: `42b8e61272bb24b42128db52b35bc51c51565b07`, rama remota `github-pages-dev`.
Proyecto permitido: `vnmkupzptujtywnnabkp`. Candidato local; sin push ni despliegue.
Se reutilizó [la matriz existente de 18 rutas](CONTROL-CENTER-STABILITY-MATRIX-DEV.csv); no se repitió el diagnóstico global.
La copia aislada preserva los cambios previos del workspace original.

## Protección incorporada

`UnsavedChangesProvider` agrega advertencias sin almacenar valores. En el DEV ya habilitado para borradores se utiliza `createHashRouter` para que `useBlocker` pueda detener navegación por enlaces, navegación programática y Atrás antes del desmontaje. El diálogo permite seguir trabajando o descartar explícitamente. La recarga usa `beforeunload`. El cierre de sesión solicitado desde AppShell pide confirmación si hay trabajo pendiente.

La activación reutiliza el contrato existente: `VITE_LOCAL_FORM_DRAFTS_MODE=controlled`, autenticación Supabase y URL exacta del proyecto DEV. No se cambian flags ni workflows. Fuera de ese contrato se mantiene HashRouter y no se activan estas advertencias. AuthProvider y los controles de autorización no se modifican.

El proveedor vive dentro del ámbito por usuario de FormDraftProvider. Renovar la misma identidad conserva los formularios; cambiar de identidad o cerrar sesión elimina su memoria. Las advertencias no impiden revocaciones ni mantienen datos privados visibles a otro usuario.

| Formulario | Mecanismo y alcance |
| --- | --- |
| Crear/editar identidad de producto | Borrador recuperable existente por usuario/entidad; restauración explícita; limpieza tras readback coincidente; operación incierta conserva identidad. No se amplía el codec. |
| Compositor editorial | Advertencia sobre cambios del draft, incluidos copy, medios y variantes; confirmación al cerrar el compositor. No se guarda automáticamente ni se publica. |
| Fecha de programación editorial | Advertencia mientras exista fecha/confirmación pendiente y no haya programación confirmada. Se protege también el cambio de variante mediante `open`. |
| Public Hub | Comparación con el formulario cargado; advertencia al salir, cancelar o cargar otro bloque. Baseline actualizado después del guardado existente. |
| Contenido institucional de catálogo | Baseline después de carga/guardado; advertencia de salida. No se almacenan localmente datos legales o de pagos. |
| Catálogos | Advertencia para formulario, selección de productos y PDF pendiente; confirmación al cambiar versión. Archivo no serializado. |
| Proveedores | Comparación con formulario vacío o proveedor cargado; advertencia al salir/cancelar/cambiar proveedor. Baseline actualizado cuando termina el guardado existente. Contactos/notas permanecen en memoria. |
| Compras | Advertencia para cabecera, fechas, notas y líneas, incluido costo `0` sin otros cambios. Sin borrador financiero local. |
| Pedidos | Advertencia para referencia, cliente/contacto, notas, líneas y canal. Sin persistencia local de datos personales. |
| Ventas/POS | Advertencia para referencia, cliente, carrito, canal y referencia de venta de pedido. Las cuentas seleccionadas automáticamente no activan falsas advertencias. |
| Finanzas | Advertencia para código/nombre/tipo de cuenta, importes, descripciones y notas de cierre. Sin serialización financiera. Las selecciones automáticas de cuentas no se tratan como trabajo escrito. |
| Ajuste de inventario | Comparación de producto, cantidad, motivo y notas; baseline después del comando existente. Flag de escritura intacto. |
| Cambio de precio | Comparación con precio leído y motivo; baseline tras guardar antes de navegar. Flag de escritura intacto. |
| Imágenes WebP | Advertencia con cola de archivos o conversión/guardado en curso. No se serializan File, Blob o URLs temporales ni se modifica el pipeline. |
| Respuesta/seguimiento de conversación | Comparación con preparación leída/guardada, fecha pendiente y advertencia antes de recargar preparación o cambiar conversación. SEND sigue bloqueado. |
| Assistant | Advertencia para prompt/producto/respuesta temporales. No se crea historial local ni se invoca un proveedor durante las pruebas. |

Los filtros y parámetros de selección de listas siguen siendo temporales. Las advertencias no agregan llamadas de escritura. Los formularios sin borrador recuperable conservan el trabajo al cancelar la salida; confirmar el descarte permite perderlo deliberadamente.

## Contrato de costo de compras

El tipo original `DraftLine` declara `cost: string`, el input modifica `cost` y el submit lo convierte a `quotedUnitCost: number | null` de `CreatePurchaseDraftItemInput`. El repositorio Supabase transmite ese valor como `quoted_unit_cost` al RPC existente.

La referencia añadida inicialmente a `line.unitCost` causaba TS2339 porque no existe en el formulario. El tipo se trasladó sin cambiar sus campos a `PurchaseFormLine`; `purchaseLinesHaveChanges` usa ese mismo tipo. No se modificaron el mapeo del submit, el comando, el RPC ni la base de datos.

La prueba focalizada cubre formulario vacío, identidad regenerada de línea, costo editado aislado, costo cero, cantidad, producto y línea adicional. Chromium ejercita además el input real de costo y la cancelación de navegación.

## Pendientes y límites

| Pendiente | Motivo y estado |
| --- | --- |
| Borrador editorial local recuperable tras recarga aceptada | No se incorporó un codec ni journal editorial. El guardado multicanal genera identidades de registros/operaciones y exige readback; una respuesta incierta requiere reconciliar antes de otro intento. Se aplican advertencias, sin presentar una copia local como persistencia remota. |
| Clientes/Bonos: parámetros de operaciones y editor de preview | No incorporados al guard compartido en este candidato. La vida del preview y el reset tras operaciones gobernadas requieren un adaptador específico. DEMO no equivale a bono durable. |
| Operaciones: payload, clave y preparación de intents | No incorporados al guard compartido. Debe distinguirse preparación temporal de intents ya registrados y resultados inciertos; no se ejecutó ningún intent para definir ese ciclo. |
| Advertencias financieras/POS y subidas bajo operaciones reales | Integración compilada; comandos comerciales siguen sujetos a flags. No se activaron flags ni se crearon ventas, compras, movimientos o subidas remotas de ensayo. |
| Cambios internos que no pasan por navegación | Se cubren los cambios de entidad indicados arriba. No se certifica que cada botón de reemplazo/reset de cada módulo esté incorporado. |
| Persistencia real OWNER | **NOT TESTED**. La herramienta de UI no expuso navegadores ni sesiones accesibles. No se extrajeron credenciales ni se fabricó una sesión OWNER. |

La falta de OWNER no bloqueó las correcciones. La revisión local confirmó que `saveEditorialItemInDev` exige DEV, ejecuta el runtime existente y compara lectura posterior de publicación/programación; eso es evidencia del contrato, no de una escritura real realizada en esta fase. Los contratos de creación/edición de producto conservan su readback y reconciliación existentes.

`beforeunload` depende del navegador y de interacción previa. No protege frente a cierre forzado del proceso, fallos del sistema o pérdida del almacenamiento. Una revocación o cambio externo de usuario puede eliminar formularios privados; no se debilita la autorización para retenerlos. No existe garantía global de idempotencia de todos los módulos: la prueba de ausencia de duplicados cubre los contratos de producto existentes y que las nuevas advertencias no envían escrituras.

## Validación

- Focalizadas finales: **63/63 PASS**, 8 archivos; compras, borradores, auth, programación editorial, WebP, intake manual y contratos de proveedores/status.
- Chromium de formularios: suite `playwright.drafts.config.ts`, **28/28 PASS**; navegación, Atrás, recarga cancelada, fecha editorial pendiente, aislamiento de usuarios, guardado/readback de productos y reintentos sin duplicados en las fixtures existentes.
- Chromium de autenticación real con transporte simulado: `node tooling/test-auth-stability.mjs after /content/social`, **PASS**. Solo se repitió esa ruta de la matriz. Conserva valor durante TOKEN_REFRESHED/SIGNED_IN; sin recarga; una suscripción; cambio de identidad, timeout, error de lectura, revocación y logout cierran acceso correctamente.
- Quality Gate: `pnpm check`, pnpm **10.15.0**, **2006/2006 PASS**, 294/294 archivos, arquitectura 486/486; TypeScript, lint y build **PASS**. Se fijó su lanzador únicamente en el entorno temporal porque PATH resolvía pnpm 11.22.0. Sin cambios a package.json ni lockfile.
- Prettier ejecutado sobre archivos modificados. Se retiraron cambios cosméticos ajenos a las protecciones para conservar el diff mínimo y las comprobaciones existentes de fragmentos literales. No se relajaron esas aserciones.
- El test de handlers de imágenes añadió mocks de useContext/useId a su harness existente; sus aserciones HTTPS, conversión manual y galería permanecen intactas.
- Pruebas de navegador restringidas a localhost con transporte externo bloqueado. No hay validación OWNER ni publicaciones reales implícitas en sus resultados.

## Comprobación humana mínima y operaciones remotas

Para la comprobación final, la propietaria debe iniciar sesión OWNER en DEV mediante un navegador conectado y dejarlo disponible sin compartir contraseña, tokens o cookies. Después se necesita una pieza nueva identificada como prueba, sin publicar, para guardar, volver a consultar por su ID, navegar/recargar y comparar datos; ante respuesta incierta se consulta antes de repetir. No modificar registros comerciales existentes. La validación OWNER de Contenido/calendario sigue pendiente para la siguiente fase.

Push, despliegue y cualquier cambio de flags/migración permanecen fuera de este candidato y requieren autorización. No se ejecutaron migraciones, escrituras en PROD, cambios de autorización, publicaciones Meta ni mensajes. TikTok y WhatsApp permanecen en HOLD.

## Archivos del candidato

Fuente: `main.tsx`; `drafts/UnsavedChanges.tsx`, `drafts/purchase-form.ts`; componentes AppShell, ConversationPreparation, EditorialComposer y EditorialScheduling; páginas Assistant, CatalogInstitutionalContent, Catalogs, ChangeProductSalePrice, Conversations, Finance, Inventory, Orders, ProductImages, PublicHub, Purchases, Sales, SocialContent y Suppliers, bajo `apps/control-center/src`.

Pruebas: fixture `auth-browser/fixture.tsx`, fixture `drafts-browser/protection.html`/`protection.tsx`, `purchase-form-protection.test.ts`, adaptación de `product-images-https-import.test.ts`, bajo `apps/control-center/tests`; `tests/drafts-e2e/unsaved-protection.spec.ts`; `tooling/test-auth-stability.mjs`. Documentación: este informe.

Los lanzadores temporales, logs y tsbuildinfo generados no forman parte del commit.

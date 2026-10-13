# Control Center DEV: conservación de borradores, etapa 1

Base del candidato: `4ad976e2797ba41c5fb6a7b70d59f550e5169fd5`.

## Diagnóstico comprobable

- `main.tsx` usa `HashRouter`. `app/App.tsx` cambia los elementos de `Routes` según el módulo. Al desmontar una página, React elimina su estado local. Una recarga crea otra raíz de React.
- La versión base de `UpdateProductPage.tsx` inicializa nombre, SKU, código, marca, categoría y lifecycle con `useState`. Su efecto de carga sustituye esos valores con la lectura del producto cada vez que la página se monta. No conserva los cambios anteriores fuera de esa instancia.
- `AuthProvider.tsx` llama `loadAuthorization` en cada evento de autenticación. Esa función activa `authorizationLoading`; `ProtectedRoute.tsx` devuelve una pantalla de validación en lugar del `Outlet`. Esto puede desmontar un formulario aunque continúe la misma identidad de usuario. No se modifica la autenticación en este candidato.
- `UpdateProductPage.tsx` generaba `crypto.randomUUID()` en cada envío. El repositorio ya transmite `operationKey` al RPC controlado. Una respuesta perdida seguida de otro envío podía generar una operación diferente.
- La prueba de navegador con conservación desactivada reproduce: editar nombre → otro módulo → Atrás → reaparece el nombre original. Con conservación activada, el borrador se restaura explícitamente tras navegación, Atrás y recarga.

Referencias: [estado y desmontaje en React](https://react.dev/learn/preserving-and-resetting-state), [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [eventos de autenticación Supabase](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

## Contrato compartido

`LocalFormDraft<T>` implementa el ciclo de vida; `FormDraftProvider` mantiene el registro por usuario y `useLocalFormDraft` lo conecta con React. `FormDraftNotice` comunica el estado. Los módulos proporcionan un codec de campos permitidos y un adaptador para lectura/escritura; no deben crear otro mecanismo de almacenamiento.

Clave: `lihen:dev:form-draft:v1:<usuario>:<módulo>:<entidad>:<formulario>`, con partes codificadas. Tamaño máximo: 32 KiB. Esquema versionado. Cada cambio permitido se escribe sin debounce antes de que termine el evento de edición. El proveedor conserva la instancia durante cambios de módulo. Un desmontaje marca la vista como pendiente de restauración; una recarga reconstruye el registro desde el navegador.

| Estado                    | Evidencia y comportamiento                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Datos leídos del servidor | Valores de referencia; no equivalen a un borrador ni confirman una escritura nueva.                                                      |
| Borrador local            | Campos permitidos y referencia inicial; aviso explícito de cambios sin guardar en Supabase. No se envía automáticamente.                 |
| Operación en curso        | Clave y fecha guardadas antes de enviar; bloqueo de dobles envíos y edición del contenido.                                               |
| Respuesta incierta        | La identidad se conserva, incluso tras recargar. Verificación mediante lectura o reintento explícito con la misma clave, fecha y campos. |
| Persistencia confirmada   | Lectura posterior de la misma entidad coincide con el contenido enviado. Solo entonces se elimina el borrador y se navega al detalle.    |

La restauración requiere pulsar **Restaurar borrador local**. Si el servidor difiere de la referencia inicial, se muestran ambos conjuntos de valores y se exige revisar antes de guardar. Un resultado incierto no permite cambiar contenido: se verifica o reintenta la operación existente. Los rechazos definitivos anteriores a una escritura desbloquean correcciones sin borrar los campos.

El cierre de sesión elimina las instancias en memoria e invalida sus callbacks; mantiene el borrador no sensible en disco para restauración por el mismo usuario. Otra identidad obtiene un registro diferente y remonta los formularios. No se presenta una confirmación local como una escritura Supabase.

El aviso `beforeunload` se activa mientras exista un borrador pendiente. Navegar entre módulos conserva el borrador; no dispara escrituras. En cuota agotada, almacenamiento bloqueado, registro corrupto o cambio detectado de otra pestaña, se muestra un fallo y no se envía una operación cuya identidad no pudo conservarse. Un registro cambiado por otra pestaña no se sobrescribe ni se elimina al confirmar una versión anterior.

## Alcance incorporado

Piloto: `/products/:id/edit`, identidad/taxonomía/lifecycle. Campos permitidos: `sku`, `catalogCode`, `name`, `slug`, `businessLine`, `brandId`, `categoryId`, `status`. `slug` y línea permanecen como parte de la identidad del envío, sin nuevos controles editables. No se conserva pricing, notas, teléfonos, correo, credenciales, tokens, sesiones, archivos ni URLs firmadas. El codec rechaza campos adicionales.

Activación: `VITE_LOCAL_FORM_DRAFTS_MODE=controlled`, `VITE_AUTH_MODE=supabase` y URL exacta `https://vnmkupzptujtywnnabkp.supabase.co`. Solo el workflow DEV recibe la nueva variable. Con la activación deshabilitada, el formulario mantiene su flujo existente. No hay modificación de PROD, SQL, RLS, dependencias ni flujo WebP.

## Incorporación progresiva

| Prioridad | Formularios observados                                    | Trabajo pendiente antes de incorporarlos                                                                                                                                                                    |
| --------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Creación de productos, marcas, categorías                 | Codec de campos no sensibles; identidad de entidad nueva; confirmación/idempotencia de cada creación.                                                                                                       |
| 2         | Public Hub, contenido institucional, compositor editorial | Separar borrador de registros durables y cachés existentes; validar esquema, entidad, medios y readback por operación.                                                                                      |
| 3         | Pedidos, compras, proveedores                             | Clasificar datos personales, condiciones comerciales y notas; estrategia explícita de privacidad antes de guardar localmente; comprobar idempotencia real.                                                  |
| 4         | Pricing, inventario, finanzas, ventas                     | Riesgo operativo e historial: comprobar el contrato real de cada comando, permisos y reconciliación. No incorporar mediante almacenamiento automático indiscriminado.                                       |
| Separada  | WebP y otras subidas                                      | El flujo desplegado permanece intacto. Archivos `File`/Blob y URLs temporales no se serializan como JSON. Una subida con respuesta incierta exige reconciliar objeto remoto e identidad antes de repetirla. |

La existencia de un formulario con `useState` señala exposición al desmontaje; no prueba por sí sola pérdida de una escritura durable. No se declara cerrado ningún módulo sin comprobar sus operaciones reales.

## Validación reproducible

- Unitarias: `pnpm exec vitest run apps/control-center/tests/local-form-draft.test.ts apps/control-center/tests/product-webp-save.test.ts`.
- Navegador: `pnpm exec playwright test -c playwright.drafts.config.ts --workers=2`.
- Gate: `pnpm check`, con pnpm 10.15.0. En este equipo se fija esa versión también para procesos hijos.

La fixture usa el formulario y proveedor reales, `StrictMode`, navegación hash y Chromium, con una sesión y backend de prueba. Los cambios de autorización se simulan desmontando las rutas; no se autentica en Supabase. Se bloquean las llamadas al dominio Supabase. Las pruebas cubren pérdida sin conservación, navegación, Atrás, recarga con aviso, restauración, guardado con lectura coincidente, lectura no coincidente, resultado perdido, mismo operationKey tras recarga, verificación sin nuevo envío, cierre de sesión, usuarios y entidades aislados, fallo de almacenamiento, campos prohibidos, registros corruptos y cambios de otra pestaña.

Los resultados exactos y el árbol del candidato se entregan en el informe de revisión externo junto al diff, después de completar el gate.

## Límites explícitos

- No se han ejecutado escrituras reales en DEV ni ensayado operaciones de los demás módulos. El readback/idempotencia del piloto usa el contrato existente, probado con backend simulado. Queda una prueba real controlada de edición y reconciliación en DEV antes de declarar cierre operativo.
- El navegador puede borrar su almacenamiento; modo privado, limpieza manual, cambio de navegador/dispositivo y fallos de disco no ofrecen durabilidad garantizada. El aviso del navegador depende de interacción previa y puede omitirse en móviles.
- El ámbito por usuario proporciona aislamiento de la aplicación, no cifrado ni confidencialidad frente a otros scripts del mismo origen. Solo se admite contenido no sensible. No hay sincronización remota de borradores, cifrado ni política automática de retención en esta etapa; logout no los borra.
- La comprobación de otra pestaña impide sobrescrituras detectadas; localStorage no ofrece transacciones entre pestañas. No se garantiza edición colaborativa ni exclusión mutua absoluta.
- La comparación con la referencia detecta cambios observados, pero no implementa control de concurrencia en el servidor. Otro operador puede cambiar una entidad entre la revisión y el RPC. Esto requiere un contrato de versión del backend, fuera del alcance autorizado.
- No se cambian políticas de autenticación ni se corrigen sus posibles carreras de autorización. La solución conserva los borradores ante el desmontaje observado y evita reutilizarlos con otra identidad.

Este es un candidato de etapa 1, sin commit ni publicación automática.

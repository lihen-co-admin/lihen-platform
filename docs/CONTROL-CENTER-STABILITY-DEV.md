# Estabilidad global y persistencia de Control Center DEV

Base examinada: `3f6fa400931ea36f544c6bc17e10d7f0a625dcaf`. Proyecto unico: `vnmkupzptujtywnnabkp`. Sin escrituras remotas, migraciones, cambios de flags, despliegue ni push. PROD excluido.

## Causas comprobadas y limites de la conclusion

1. **Remontaje global, no recarga del documento.** AuthProvider vuelve a consultar perfil/roles en los eventos de sesion; ProtectedRoute sustituia Outlet por una pantalla de validacion. Chromium reprodujo la desaparicion del input y la perdida de su valor al renovar la sesion, con performance.timeOrigin constante. El alcance compartido incluye las 18 rutas protegidas. No demuestra que todos los incidentes de la propietaria tengan esta unica causa.
2. **Consultas de autorizacion duplicadas y ejecutadas dentro del callback.** getSession e INITIAL_SESSION iniciaban lecturas simultaneas. Evidencia aislada anterior: cuatro lecturas iniciales, dos iniciadas dentro del callback. Despues: dos lecturas iniciales, cero dentro del callback, una suscripcion activa y coalescencia de rafagas. [Supabase documenta el riesgo de bloqueo de llamadas en ese callback](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0). El bloqueo real de red del navegador de la propietaria no fue observado.
3. **Respuestas tardias y esperas sin limite en autorizacion.** La implementacion anterior carecia de cancelacion/versionado. Se invalida ahora toda respuesta de una identidad anterior, al cerrar sesion o desmontar; las lecturas usan AbortSignal y un limite de 15 segundos. Error, revocacion o timeout deniegan acceso; no se conserva una concesion caducada.
4. **Navegacion normal y estado temporal.** Cambiar de ruta desmonta la pagina anterior por contrato del router. La infraestructura compartida de borradores solo esta incorporada a crear/editar productos. No existe autosave transversal aprobado para formularios de proveedores, catalogos, POS o el compositor editorial. No se anaden almacenamientos paralelos ni CRUD nuevos para ocultar esta limitacion.

No se encontro una llamada automatica a location.reload/assign/replace en el shell/router/auth. No hay registro de service worker en src. El unico setInterval de src es el reloj editorial de 60 segundos; no consulta el servidor. No se demostraron recargas de navegador, cache corrupta, fallo de chunks del despliegue, expiracion real de JWT ni errores remotos OWNER. No hay un Error Boundary global en App; no se incorpora uno sin una causa de excepcion reproducida.

## Correccion y controles de seguridad

- Revalidar al mismo usuario conserva el subarbol React y lo vuelve **inert** mientras se confirma perfil/roles. No se elimina ninguna consulta ni comprobacion de autorizacion.
- La primera autorizacion, una identidad diferente o una autorizacion revocada no muestran el modulo. Los endpoints, RPC, RLS y permisos de escritura no cambian; inert no sustituye la autorizacion servidor.
- Las consultas se difieren fuera de onAuthStateChange; eventos simultaneos se coalescen y respuestas obsoletas no sobrescriben la sesion nueva.
- Cambios de usuario y cierre de sesion siguen invalidando la autorizacion y el proveedor de borradores por usuario conserva su aislamiento existente.
- Meta, importacion HTTPS comercial, TikTok y WhatsApp mantienen sus bloqueos. No se activa ninguna funcion por incluirla en el recorrido.

## Matriz obligatoria

La [matriz CSV de 18 rutas](CONTROL-CENTER-STABILITY-MATRIX-DEV.csv) incluye fuente, destino, persistencia, acciones, navegacion, recarga, errores y resultado. **PASS aislado** significa estabilidad del componente con transporte simulado; **NOT TESTED** en la columna OWNER significa que no se verifico la lectura/escritura con una sesion real de la propietaria. **BLOCKED** identifica escrituras deshabilitadas por la configuracion publicada; no una ausencia de datos.

| Ruta | Estabilidad aislada | Persistencia y limite principal |
|---|---|---|
| #/ | PASS | vista Supabase DEV; no aplica |
| #/products | PASS | Supabase DEV; productos existentes comprobados; crear/editar: LocalFormDraft por usuario; listas/filtros temporales |
| #/brands | PASS | Supabase DEV; 46 marcas comprobadas; filtros temporales; no CRUD |
| #/categories | PASS | Supabase DEV; 16 categorias comprobadas; filtros temporales |
| #/catalogs | PASS | Supabase DEV; 4 versiones comprobadas; formulario y seleccion React sin journal de borrador |
| #/inventory | PASS | Supabase DEV; 92 movimientos comprobados; filtros y entradas temporales |
| #/suppliers | PASS | Supabase DEV; 11 proveedores comprobados; formulario React; sin borrador local compartido |
| #/purchases | PASS | Supabase DEV; 1 compra existente; formulario/lineas temporales |
| #/orders | PASS | Supabase DEV; 8 pedidos comprobados; formulario/lineas React |
| #/customers/benefits | PASS | Supabase DEV para registros reales; DEMO es local; parametros y preview React |
| #/sales | PASS | Supabase DEV; 6 ventas comprobadas; carrito/formulario React sin journal compartido |
| #/finance | PASS | Supabase DEV; 8 movimientos comprobados; formularios y filtros React |
| #/content/public-hub | PASS | lihen_private.public_hub_blocks; 5 existentes; editor React sin borrador local por formulario |
| #/content/social | PASS | Supabase DEV; 12 publicaciones y 12 programaciones existentes; compositor React; metas personales localStorage; no autosave editorial |
| #/conversations | PASS | tablas durables; 0 borradores/seguimientos comprobados; texto de respuesta/seguimiento React hasta guardar |
| #/cloud | PASS | vista de registros/Storage existentes; filtros y seleccion React |
| #/assistant | PASS | contexto servidor; prompt/respuesta UI temporales; prompt/productId y respuesta React |
| #/operations | PASS | vistas y registros Supabase DEV; filtros/parametros/seleccion temporales |

La consulta administrativa read-only confirmo existencia de tablas/vistas y conteos, no autorizacion OWNER ni un ciclo nuevo de escritura/recarga: productos 1028, marcas 46, categorias 16, catalogos 4, movimientos inventario 92, proveedores 11, compras 1, pedidos 8, clientes 8, ventas 6, movimientos financieros 8, publicaciones 12, programaciones 12, bloques Hub 5; bonos, respuestas preparadas y seguimientos 0. No se leyeron nombres, telefonos, conversaciones ni datos personales. No se modificaron registros.

## Evidencia automatizada

- Antes/despues del provider y la ruta reales: cliente Auth aislado, sin tokens reales. Sonda de formulario en 18 rutas, renovaciones TOKEN_REFRESHED/SIGNED_IN, rafagas, revocacion, cambio de identidad, respuestas tardias, red fallida, timeout y cierre de sesion.
- Recorrido separado de las **18 paginas reales**, navegacion hash consecutiva, regreso, recarga explicita y 61 segundos virtuales por ruta. Backend de lectura simulado; no representa persistencia real ni datos comerciales. No se observaron errores JavaScript no gestionados durante ese recorrido.
- Los borradores de productos y los controles de WebP se verifican mediante las pruebas de regresion existentes; no se escriben registros comerciales.
- No existe navegador OWNER conectado a la automatizacion. No se buscaron ni extrajeron cookies, contrasenas o tokens. La prueba remota de escritura permanece pendiente y necesita autorizacion especifica antes de ejecutarse.

Comando reutilizable de la regresion de autorizacion: `node tooling/test-auth-stability.mjs after`. Requiere Chromium de Playwright ya disponible. Los informes, scripts del recorrido completo y respaldos estan en `.external-image-edge-proof/`, excluidos del candidato. Quality Gate y resultados finales se registran en el manifiesto del candidato tras la validacion.

## Alcance operativo pendiente y autorizaciones

Esta correccion elimina el remontaje reproducido durante revalidaciones satisfactorias. No certifica que todos los formularios sobrevivan a navegacion/recarga, ni que las 18 operaciones CRUD sean operativas. La recuperacion de formularios que no usan el contrato compartido y cualquier nuevo CRUD requieren alcance separado, sin activar escrituras HOLD.

Para poner esta correccion en servicio se requiere autorizar el commit candidato exacto hacia refs/heads/github-pages-dev mediante push normal; no hay migraciones ni Edge Functions que desplegar. Despues deben verificarse CI/Pages y la estabilidad con una sesion OWNER conectada. Cualquier ensayo de persistencia remoto se limitara a registros DEV identificables con aprobacion especifica; no debe confundirse con los conteos administrativos ni con los mocks.


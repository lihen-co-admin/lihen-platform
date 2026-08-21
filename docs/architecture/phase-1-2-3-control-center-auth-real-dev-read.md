# FASE 1.2.3 — Control Center Auth + Real DEV Read Probe

## Objetivo
Demostrar `Login → JWT authenticated → SupabaseProductRepository → RLS → products DEV` sin habilitar escrituras.

## Implementado
- Un único browser Supabase client compartido por Auth y repositories.
- `AuthProvider` restaura sesión y escucha cambios de autenticación.
- `/login` usa `signInWithPassword`.
- Rutas privadas pasan por `ProtectedRoute`.
- Logout disponible desde `AppShell`.
- `VITE_PRODUCT_READ_SOURCE=supabase` para DEV.
- URL y publishable key de `lihen-platform-dev` en `.env.development.local` (archivo local, no secreto de servidor).

## Seguridad
- No existe registro público en Control Center.
- No se usa `service_role`.
- `products` mantiene grant/policy SELECT solamente para `authenticated`.
- Supabase writes siguen bloqueados en adapters y base de datos.

## Gate pendiente
El entorno de ejecución de esta sesión no puede hacer HTTP saliente al endpoint Auth y las herramientas conectadas no exponen una acción segura para crear un usuario Auth. No se inserta manualmente en `auth.users`.

Para cerrar el gate, crear una cuenta DEV por el flujo soportado de Auth y ejecutar el Control Center. Después del login, `/products` debe resolver `[]` (DEV aún vacío) sin 401/403. Ese resultado constituye el probe real browser+JWT.

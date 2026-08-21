# Arquitectura — Overview

LIHEN Platform se construye como **monorepo modular + modular monolith**, con PostgreSQL/Supabase como fuente central.

Principio maestro: **UNA BASE. UN PRODUCTO. UNA HISTORIA. MÚLTIPLES CANALES.**

Apps: Control Center, Storefront y Workers. Los dominios viven en packages y se acceden mediante contratos, no mediante llamadas directas de vista a tablas.

# TANDA 15 · CUT7 · FIX1 — TS5076

Fecha: 2026-08-30

Corrección puntual:
se agregan paréntesis para evitar mezclar `??` y `||` sin agrupación explícita en
`resolveStyleCategoryLabel`.

Antes:
`descriptor?.label ?? value.trim() || 'LIHEN Style'`

Después:
`(descriptor?.label ?? value.trim()) || 'LIHEN Style'`

No cambia comportamiento visual, datos, publicación, snapshots ni infraestructura.

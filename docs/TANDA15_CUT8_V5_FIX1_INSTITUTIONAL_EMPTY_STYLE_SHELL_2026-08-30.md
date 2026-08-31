# TANDA 15 · CUT8 V5 FIX1 — Institutional Empty STYLE Shell

Fecha: 2026-08-30

## Hallazgo del smoke

`line=STYLE` seguía saliendo antes del renderer institucional porque `first`
dependía exclusivamente de `renderEntries`.

Como el snapshot congelado actual no contiene productos STYLE, `renderEntries`
queda vacío y el guard `!first` impedía mostrar las páginas institucionales
compartidas.

## Corrección

`first` ahora usa:

```ts
renderEntries[0] ?? entries[0] ?? null
```

Esto permite utilizar la metadata de la versión como shell del catálogo aunque
la línea seleccionada todavía no tenga productos.

## Resultado esperado

Para `line=STYLE` con snapshot sin productos STYLE:

- página 1 institucional compartida visible;
- página 2 institucional compartida visible;
- página 3 institucional compartida visible;
- página 4 institucional compartida visible;
- cuerpo comercial STYLE vacío;
- página final institucional compartida visible;
- impresión/publicación sigue bloqueada porque no hay productos STYLE.

No se incorporan productos fuera del snapshot y no se altera la inmutabilidad
de la versión.

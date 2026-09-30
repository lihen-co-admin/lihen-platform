import { useId, useRef, useState } from 'react';
import type { ProductListItemDTO } from '@lihen/products';
import type { InventoryBalance } from '@lihen/inventory';

export function EditorialProductSelector({
  products,
  balances,
  value,
  onChange,
}: {
  products: readonly ProductListItemDTO[];
  balances: readonly InventoryBalance[];
  value: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const label = (product: ProductListItemDTO) =>
    [product.name, product.sku].filter(Boolean).join(' · ');
  const selected = products.find((product) => product.id === value);
  const stockByProduct = new Map(
    balances.map((balance) => [balance.productId, balance.stockAvailable]),
  );
  // Stable sort retains catalog order within each availability group.
  const filtered = products
    .filter((product) =>
      label(product).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .sort(
      (left, right) =>
        Number((stockByProduct.get(right.id) ?? 0) > 0) -
        Number((stockByProduct.get(left.id) ?? 0) > 0),
    );
  const options = [
    { id: '', label: 'Sin producto asociado' },
    ...filtered.map((product) => {
      const stock = stockByProduct.get(product.id);
      const availability =
        stock === 0
          ? 'Sin stock'
          : stock !== undefined && stock > 0
            ? `Stock: ${stock}`
            : 'Inventario no disponible';
      return { id: product.id, label: `${label(product)} · ${availability}` };
    }),
  ];
  function choose(productId: string) {
    onChange(productId);
    setOpen(false);
    setQuery('');
    input.current?.focus();
  }
  return (
    <div
      className="editorial-product-selector"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery('');
        }
      }}
    >
      <label htmlFor={id}>Producto a promocionar</label>
      <input
        ref={input}
        id={id}
        autoFocus
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        aria-describedby={`${id}-help`}
        value={open ? query : selected ? label(selected) : value ? 'Producto asociado' : ''}
        placeholder="Explora el catálogo o filtra por nombre o SKU"
        onClick={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActive((previous) =>
              !open
                ? 0
                : Math.max(
                    0,
                    Math.min(options.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1)),
                  ),
            );
          } else if (event.key === 'Enter' && open) {
            event.preventDefault();
            choose(options[active]?.id ?? '');
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setQuery('');
          }
        }}
      />
      <small id={`${id}-help`}>
        Abre el catálogo para elegir un producto. No necesitas conocer su SKU.
      </small>
      {open && (
        <div className="editorial-product-options">
          <div id={`${id}-options`} role="listbox" aria-label="Productos disponibles">
            {options.map((option, index) => (
              <div
                key={option.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={value === option.id}
                className={active === index ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option.id)}
              >
                {option.label}
              </div>
            ))}
          </div>
          {!filtered.length && (
            <p role="status">
              {products.length
                ? 'No hay productos que coincidan.'
                : 'No hay productos disponibles en el catálogo.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

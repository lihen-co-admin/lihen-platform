import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ProductListItemDTO } from '@lihen/products';
import { EditorialComposer } from '../../src/components/EditorialComposer';
import { createEditorialDraft } from '../../src/composition/editorial-workspace';
import '../../src/styles/reset.css';
import '../../src/styles/tokens.css';
import '../../src/styles/app.css';
import '../../src/styles/editorial.css';

// Local browser fixture. Saving only records the existing draft contract in the DOM.
const products = [
  {
    id: 'durable-product-1',
    name: 'Producto uno',
    brandId: 'brand-a',
    brandName: 'Marca A',
    categoryName: 'Cuidado',
    sku: 'SKU-1',
    status: 'ACTIVE',
    salePrice: { amount: 10000, currency: 'COP' },
  },
  {
    id: 'durable-product-2',
    name: 'Producto dos',
    brandId: 'brand-b',
    brandName: 'Marca B',
    categoryName: 'Cuidado',
    sku: 'SKU-2',
    status: 'ACTIVE',
    salePrice: { amount: 15000, currency: 'COP' },
  },
] as ProductListItemDTO[];
let sequence = 0;
const readVideos = async () => [];
function Fixture() {
  const [catalog, setCatalog] = useState(products);
  return (
    <MemoryRouter>
      <button
        onClick={() =>
          setCatalog((current) =>
            current.map((product) =>
              product.id === 'durable-product-1' ? { ...product, sku: 'SKU-CHANGED' } : product,
            ),
          )
        }
      >
        Cambiar SKU fixture
      </button>
      <button
        onClick={() =>
          setCatalog((current) =>
            current.map((product) =>
              product.id === 'durable-product-1'
                ? { ...product, brandId: 'brand-c', brandName: 'Marca C' }
                : product,
            ),
          )
        }
      >
        Cambiar marca fixture
      </button>
      <EditorialComposer
        item={null}
        products={catalog}
        busy={false}
        readVideos={readVideos}
        onClose={() => undefined}
        onSave={(draft) => {
          document.body.dataset.saved = JSON.stringify(
            createEditorialDraft(draft, new Date(), () => `fixture-${++sequence}`),
          );
        }}
      />
    </MemoryRouter>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);

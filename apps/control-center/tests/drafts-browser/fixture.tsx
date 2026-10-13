import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { AuthContext, type AuthContextValue } from '../../src/auth/auth-context';
import { ProtectedRoute } from '../../src/auth/ProtectedRoute';
import { FormDraftProvider } from '../../src/drafts/FormDraftProvider';
import { CreateProductPage } from '../../src/pages/CreateProductPage';
import { Product, Brand, Category } from '@lihen/products';
import { UpdateProductPage } from '../../src/pages/UpdateProductPage';
import { productsComposition } from '../../src/composition/products';
import type { ProductDetailDTO } from '@lihen/products';

// Test-only backend. All calls stay on localhost; no Supabase client/auth data is created.
const initial: ProductDetailDTO = {
  id: 'product-a',
  name: 'Producto original',
  businessLine: 'BEAUTY_CARE',
  status: 'ACTIVE',
  slug: 'producto-original',
  salePrice: { amount: 100, currency: 'COP' },
};
function readProduct(id: string): ProductDetailDTO | null {
  if (id !== 'product-a' && id !== 'product-b' && !localStorage.getItem(`fixture:server:${id}`))
    return null;
  return JSON.parse(
    localStorage.getItem(`fixture:server:${id}`) ?? JSON.stringify({ ...initial, id }),
  ) as ProductDetailDTO;
}
productsComposition.getProductById.execute = async (query) => readProduct(query.productId);
productsComposition.getBrands.execute = async () => [
  {
    id: 'brand-active',
    name: 'Marca prueba',
    normalizedName: 'marca prueba',
    status: localStorage.getItem('fixture:brand-inactive') === 'true' ? 'INACTIVE' : 'ACTIVE',
  },
];
productsComposition.getCategories.execute = async () => [
  {
    id: 'category-active',
    name: 'Categoria prueba',
    normalizedName: 'categoria prueba',
    status: 'ACTIVE',
    businessLine: 'BEAUTY_CARE',
  },
];
productsComposition.brandRepository.findById = async (id) =>
  id === 'brand-active'
    ? new Brand({ id, name: 'Marca prueba', normalizedName: 'marca prueba', status: 'ACTIVE' })
    : null;
productsComposition.categoryRepository.findById = async (id) =>
  id === 'category-active'
    ? new Category({
        id,
        name: 'Categoria prueba',
        normalizedName: 'categoria prueba',
        status: 'ACTIVE',
        businessLine: 'BEAUTY_CARE',
      })
    : null;
productsComposition.repository.create = async (product, context) => {
  const response = await fetch('/__draft_test__/create', {
    method: 'POST',
    body: JSON.stringify({
      id: product.id,
      operationKey: context?.operationKey,
      name: product.name,
      salePrice: product.salePrice.amount,
    }),
  });
  const outcome = (await response.json()) as {
    committed: boolean;
    fail: boolean;
    staleReadback?: boolean;
  };
  const result: ProductDetailDTO = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    businessLine: product.businessLine,
    status: product.status,
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.catalogCode ? { catalogCode: product.catalogCode } : {}),
    ...(product.brandId ? { brandId: product.brandId } : {}),
    ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    salePrice: { amount: product.salePrice.amount, currency: 'COP' },
  };
  if (outcome.committed && !outcome.staleReadback)
    localStorage.setItem('fixture:server:' + product.id, JSON.stringify(result));
  if (outcome.fail) throw new Error('Simulated lost creation response');
  return new Product({
    id: product.id,
    name: product.name,
    businessLine: product.businessLine,
    status: product.status,
    slug: product.slug,
    salePrice: product.salePrice,
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.catalogCode ? { catalogCode: product.catalogCode } : {}),
    ...(product.brandId ? { brandId: product.brandId } : {}),
    ...(product.categoryId ? { categoryId: product.categoryId } : {}),
  });
};
productsComposition.updateProduct.execute = async (command) => {
  const response = await fetch('/__draft_test__/write', {
    method: 'POST',
    body: JSON.stringify(command),
  });
  const outcome = (await response.json()) as {
    committed: boolean;
    fail: boolean;
    staleReadback?: boolean;
  };
  const product = {
    ...readProduct(command.payload.productId),
    ...command.payload,
    id: command.payload.productId,
  };
  if (outcome.committed && !outcome.staleReadback)
    localStorage.setItem(`fixture:server:${product.id}`, JSON.stringify(product));
  if (outcome.fail) throw new Error('Simulated lost response');
  return product;
};

function Fixture() {
  const [userId, setUserId] = useState<string | null>(
    () => sessionStorage.getItem('fixture:user') ?? 'user-a',
  );
  const [authorizationLoading, setAuthorizationLoading] = useState(false);
  const switchUser = (value: string | null) => {
    setUserId(value);
    sessionStorage.setItem('fixture:user', value ?? '');
  };
  const auth: AuthContextValue = {
    enabled: false,
    bootstrapSignUpEnabled: false,
    session: null,
    user: userId ? ({ id: userId } as User) : null,
    profile: null,
    knownRoleCodes: [],
    authorized: Boolean(userId),
    authorizationReason: 'ACTIVE_ROLE',
    loading: false,
    authorizationLoading,
    signIn: async () => {},
    signInWithGitHub: async () => {},
    signUp: async () => ({ needsEmailConfirmation: false }),
    signOut: async () => switchUser(null),
  };
  // Route teardown is reproduced explicitly during authorization refresh, without changing AuthProvider.
  return (
    <AuthContext.Provider value={auth}>
      <button onClick={() => switchUser(null)}>Cerrar sesión de prueba</button>
      <button onClick={() => switchUser('user-a')}>Usuario A</button>
      <button onClick={() => switchUser('user-b')}>Usuario B</button>
      <button
        onClick={() => {
          setAuthorizationLoading(true);
          setTimeout(() => setAuthorizationLoading(false), 150);
        }}
      >
        Simular autorización
      </button>
      <FormDraftProvider
        userId={userId}
        enabled={new URLSearchParams(location.search).get('drafts') !== 'off'}
      >
        {!userId ? (
          <p>Sesión cerrada</p>
        ) : authorizationLoading ? (
          <p>Validando autorización</p>
        ) : (
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/products/new" element={<CreateProductPage />} />
              <Route path="/products/:id/edit" element={<UpdateProductPage />} />
              <Route
                path="*"
                element={
                  <section>
                    <h1>Otro módulo</h1>
                    <Link to="/products/product-a/edit">Editar A</Link>
                    <Link to="/products/new">Crear producto</Link>
                    <Link to="/products/product-b/edit">Editar B</Link>
                  </section>
                }
              />
            </Route>
          </Routes>
        )}
        <Link to="/other">Otro módulo</Link>
      </FormDraftProvider>
    </AuthContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Fixture />
    </HashRouter>
  </StrictMode>,
);

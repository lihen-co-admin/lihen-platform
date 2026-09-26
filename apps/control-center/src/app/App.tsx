import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AppShell } from '../components/AppShell';





const ProductsPage = lazy(async () => {
  const module = await import('../pages/ProductsPage');
  return { default: module.ProductsPage };
});

const ProductDetailPage = lazy(async () => {
  const module = await import('../pages/ProductDetailPage');
  return { default: module.ProductDetailPage };
});

const CreateProductPage = lazy(async () => {
  const module = await import('../pages/CreateProductPage');
  return { default: module.CreateProductPage };
});

const UpdateProductPage = lazy(async () => {
  const module = await import('../pages/UpdateProductPage');
  return { default: module.UpdateProductPage };
});

const ChangeProductSalePricePage = lazy(async () => {
  const module = await import('../pages/ChangeProductSalePricePage');
  return { default: module.ChangeProductSalePricePage };
});

const ProductImagesPage = lazy(async () => {
  const module = await import('../pages/ProductImagesPage');
  return { default: module.ProductImagesPage };
});

const BrandsPage = lazy(async () => {
  const module = await import('../pages/BrandsPage');
  return { default: module.BrandsPage };
});

const CategoriesPage = lazy(async () => {
  const module = await import('../pages/CategoriesPage');
  return { default: module.CategoriesPage };
});

const LoginPage = lazy(async () => {
  const module = await import('../pages/LoginPage');
  return { default: module.LoginPage };
});

const BootstrapAdminPage = lazy(async () => {
  const module = await import('../pages/BootstrapAdminPage');
  return { default: module.BootstrapAdminPage };
});

const DevAuthProbePage = lazy(async () => {
  const module = await import('../pages/DevAuthProbePage');
  return { default: module.DevAuthProbePage };
});

const InventoryPage = lazy(async () => {
  const module = await import('../pages/InventoryPage');
  return { default: module.InventoryPage };
});

const SuppliersPage = lazy(async () => {
  const module = await import('../pages/SuppliersPage');
  return { default: module.SuppliersPage };
});

const PurchasesPage = lazy(async () => {
  const module = await import('../pages/PurchasesPage');
  return { default: module.PurchasesPage };
});

const PurchaseDetailPage = lazy(async () => {
  const module = await import('../pages/PurchaseDetailPage');
  return { default: module.PurchaseDetailPage };
});

const OrdersPage = lazy(async () => {
  const module = await import('../pages/OrdersPage');
  return { default: module.OrdersPage };
});

const SalesPage = lazy(async () => {
  const module = await import('../pages/SalesPage');
  return { default: module.SalesPage };
});

const FinancePage = lazy(async () => {
  const module = await import('../pages/FinancePage');
  return { default: module.FinancePage };
});

const CatalogsPage = lazy(async () => {
  const module = await import('../pages/CatalogsPage');
  return { default: module.CatalogsPage };
});

const CatalogPdfRenderPage = lazy(async () => {
  const module = await import('../pages/CatalogPdfRenderPage');
  return { default: module.CatalogPdfRenderPage };
});

const CatalogInstitutionalContentPage = lazy(async () => {
  const module = await import('../pages/CatalogInstitutionalContentPage');
  return { default: module.CatalogInstitutionalContentPage };
});

const PublicHubPage = lazy(async () => {
  const module = await import('../pages/PublicHubPage');
  return { default: module.PublicHubPage };
});

const CloudWorkspacePage = lazy(async () => {
  const module = await import('../pages/CloudWorkspacePage');
  return { default: module.CloudWorkspacePage };
});

const AssistantPage = lazy(async () => {
  const module = await import('../pages/AssistantPage');
  return { default: module.AssistantPage };
});

const SocialContentPage = lazy(async () => {
  const module = await import('../pages/SocialContentPage');
  return { default: module.SocialContentPage };
});

const DashboardPage = lazy(async () => {
  const module = await import('../pages/DashboardPage');
  return { default: module.DashboardPage };
});

const OperationsPage = lazy(async () => {
  const module = await import('../pages/OperationsPage');
  return { default: module.OperationsPage };
});
export function App() {
  return (
    <Suspense fallback={<div>Cargando…</div>}>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/bootstrap-admin" element={<BootstrapAdminPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/catalogs/:id/render" element={<CatalogPdfRenderPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />
          <Route path="/purchases/:id" element={<PurchaseDetailPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/cloud" element={<CloudWorkspacePage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/catalogs" element={<CatalogsPage />} />
          <Route path="/catalogs/content" element={<CatalogInstitutionalContentPage />} />
          <Route path="/content/public-hub" element={<PublicHubPage />} />
          <Route path="/content/social" element={<SocialContentPage />} />
          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/dev-auth-probe" element={<DevAuthProbePage />} />
          <Route path="/products/new" element={<CreateProductPage />} />
          <Route path="/products/:id/edit" element={<UpdateProductPage />} />
          <Route path="/products/:id/price" element={<ChangeProductSalePricePage />} />
          <Route path="/products/:id/images" element={<ProductImagesPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
      </Routes>
    </Suspense>
  );
}

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AppShell } from '../components/AppShell';

/*
 * Aquí cada página se carga solo cuando se necesita.
 * Esto reduce el bundle inicial del Control Center y mantiene
 * separados los slices verticales sin mezclar responsabilidades.
 */
const DashboardPage = lazy(() => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const ProductsPage = lazy(() => import('../pages/ProductsPage').then((module) => ({ default: module.ProductsPage })));
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })));
const CreateProductPage = lazy(() => import('../pages/CreateProductPage').then((module) => ({ default: module.CreateProductPage })));
const UpdateProductPage = lazy(() => import('../pages/UpdateProductPage').then((module) => ({ default: module.UpdateProductPage })));
const ChangeProductSalePricePage = lazy(() => import('../pages/ChangeProductSalePricePage').then((module) => ({ default: module.ChangeProductSalePricePage })));
const ProductImagesPage = lazy(() => import('../pages/ProductImagesPage').then((module) => ({ default: module.ProductImagesPage })));
const BrandsPage = lazy(() => import('../pages/BrandsPage').then((module) => ({ default: module.BrandsPage })));
const CategoriesPage = lazy(() => import('../pages/CategoriesPage').then((module) => ({ default: module.CategoriesPage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const BootstrapAdminPage = lazy(() => import('../pages/BootstrapAdminPage').then((module) => ({ default: module.BootstrapAdminPage })));
const DevAuthProbePage = lazy(() => import('../pages/DevAuthProbePage').then((module) => ({ default: module.DevAuthProbePage })));

function RouteLoadingState() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>Cargando módulo…</span>
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteLoadingState />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/bootstrap-admin" element={<BootstrapAdminPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
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

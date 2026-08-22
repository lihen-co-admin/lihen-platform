import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AppShell } from '../components/AppShell';
import { DashboardPage } from '../pages/DashboardPage';
import { ProductsPage } from '../pages/ProductsPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { CreateProductPage } from '../pages/CreateProductPage';
import { UpdateProductPage } from '../pages/UpdateProductPage';
import { ChangeProductSalePricePage } from '../pages/ChangeProductSalePricePage';
import { ProductImagesPage } from '../pages/ProductImagesPage';
import { BrandsPage } from '../pages/BrandsPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { LoginPage } from '../pages/LoginPage';
import { BootstrapAdminPage } from '../pages/BootstrapAdminPage';
import { DevAuthProbePage } from '../pages/DevAuthProbePage';
import { InventoryPage } from '../pages/InventoryPage';
import { SuppliersPage } from '../pages/SuppliersPage';
import { PurchasesPage } from '../pages/PurchasesPage';
import { PurchaseDetailPage } from '../pages/PurchaseDetailPage';
import { OrdersPage } from '../pages/OrdersPage';
import { SalesPage } from '../pages/SalesPage';
import { FinancePage } from '../pages/FinancePage';
import { OperationsPage } from '../pages/OperationsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/bootstrap-admin" element={<BootstrapAdminPage />} />
      <Route element={<ProtectedRoute />}>
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
  );
}

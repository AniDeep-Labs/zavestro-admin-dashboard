import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OrderProvider } from './context/OrderContext';
import { CustomerLayout } from './pages/customer/CustomerLayout';
import { HomePage } from './pages/customer/HomePage';
import { FabricCatalogPage } from './pages/customer/FabricCatalogPage';
import { OwnFabricPage } from './pages/customer/OwnFabricPage';
import { DesignCatalogPage } from './pages/customer/DesignCatalogPage';
import { DesignDetailPage } from './pages/customer/DesignDetailPage';
import { MeasurementPage } from './pages/customer/MeasurementPage';
import { SelfMeasurePage } from './pages/customer/SelfMeasurePage';
import { TailorSelectionPage } from './pages/customer/TailorSelectionPage';
import { OrderSummaryPage } from './pages/customer/OrderSummaryPage';
import { OrderConfirmationPage } from './pages/customer/OrderConfirmationPage';
import { OrderTrackingPage } from './pages/customer/OrderTrackingPage';
import { DesignerLayout } from './pages/designer/DesignerLayout';
import { DesignerOnboardingPage } from './pages/designer/DesignerOnboardingPage';
import { DesignerDashboardPage } from './pages/designer/DesignerDashboardPage';
import { DesignUploadDetailsPage } from './pages/designer/DesignUploadDetailsPage';
import { DesignUploadFabricPage } from './pages/designer/DesignUploadFabricPage';
import { DesignUploadMeasurementsPage } from './pages/designer/DesignUploadMeasurementsPage';
import { DesignUploadPricingPage } from './pages/designer/DesignUploadPricingPage';
import { MyDesignsPage } from './pages/designer/MyDesignsPage';
import { DesignAnalyticsPage } from './pages/designer/DesignAnalyticsPage';
import { EarningsPayoutsPage } from './pages/designer/EarningsPayoutsPage';
import { DesignerProfilePage } from './pages/designer/DesignerProfilePage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { OrdersListPage } from './pages/admin/OrdersListPage';
import { OrderDetailPage } from './pages/admin/OrderDetailPage';
import { UsersListPage } from './pages/admin/UsersListPage';
import { UserDetailPage } from './pages/admin/UserDetailPage';
import { HubsListPage } from './pages/admin/HubsListPage';
import { HubDetailPage } from './pages/admin/HubDetailPage';
import { ProductsListPage } from './pages/admin/ProductsListPage';
import { ProductEditPage } from './pages/admin/ProductEditPage';
import { ContentPage } from './pages/admin/ContentPage';
import { AnalyticsPage } from './pages/admin/AnalyticsPage';
import { SupportListPage } from './pages/admin/SupportListPage';
import { TicketDetailPage } from './pages/admin/TicketDetailPage';
import { AppConfigPage } from './pages/admin/AppConfigPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import { WaitlistPage } from './pages/admin/WaitlistPage';
import { AdminRegisterPage } from './pages/admin/AdminRegisterPage';
import { AdminResetPasswordPage } from './pages/admin/AdminResetPasswordPage';
import { AdminUsersManagePage } from './pages/admin/AdminUsersManagePage';
import { CollectionsListPage } from './pages/admin/CollectionsListPage';
import { CollectionEditPage } from './pages/admin/CollectionEditPage';
import { LuxeFabricsListPage } from './pages/admin/LuxeFabricsListPage';
import { LuxeFabricEditPage } from './pages/admin/LuxeFabricEditPage';
import { ConsultationSlotsPage } from './pages/admin/ConsultationSlotsPage';
import { ConsultationsListPage } from './pages/admin/ConsultationsListPage';

function App() {
  return (
    <BrowserRouter>
      <OrderProvider>
        <Routes>
          {/* Customer Routes */}
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route element={<CustomerLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/fabrics" element={<FabricCatalogPage />} />
            <Route path="/own-fabric" element={<OwnFabricPage />} />
            <Route path="/designs" element={<DesignCatalogPage />} />
            <Route path="/designs/:id" element={<DesignDetailPage />} />
            <Route path="/measurements" element={<MeasurementPage />} />
            <Route path="/measurements/self" element={<SelfMeasurePage />} />
            <Route path="/tailors" element={<TailorSelectionPage />} />
            <Route path="/order-summary" element={<OrderSummaryPage />} />
            <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
            <Route path="/orders/:id" element={<OrderTrackingPage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/register" element={<AdminRegisterPage />} />
          <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="orders" element={<OrdersListPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="users" element={<UsersListPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="hubs" element={<HubsListPage />} />
            <Route path="hubs/new" element={<HubDetailPage />} />
            <Route path="hubs/:id" element={<HubDetailPage />} />
            <Route path="catalog/products" element={<ProductsListPage />} />
            <Route path="catalog/products/:id" element={<ProductEditPage />} />
            <Route path="catalog/collections" element={<CollectionsListPage />} />
            <Route path="catalog/collections/:id" element={<CollectionEditPage />} />
            <Route path="catalog/luxe-fabrics" element={<LuxeFabricsListPage />} />
            <Route path="catalog/luxe-fabrics/:id" element={<LuxeFabricEditPage />} />
            <Route path="catalog/consultation-slots" element={<ConsultationSlotsPage />} />
            <Route path="catalog/consultations" element={<ConsultationsListPage />} />
            <Route path="content/:section" element={<ContentPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="analytics/:section" element={<AnalyticsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="support" element={<SupportListPage />} />
            <Route path="support/:id" element={<TicketDetailPage />} />
            <Route path="system/config" element={<AppConfigPage />} />
            <Route path="system/audit" element={<AuditLogPage />} />
            <Route path="system/waitlist" element={<WaitlistPage />} />
            <Route path="system/admins" element={<AdminUsersManagePage />} />
          </Route>

          {/* Designer Routes */}
          <Route path="/designer/onboarding" element={<DesignerOnboardingPage />} />
          <Route element={<DesignerLayout />}>
            <Route path="/designer/dashboard" element={<DesignerDashboardPage />} />
            <Route path="/designer/upload/details" element={<DesignUploadDetailsPage />} />
            <Route path="/designer/upload/fabric" element={<DesignUploadFabricPage />} />
            <Route path="/designer/upload/measurements" element={<DesignUploadMeasurementsPage />} />
            <Route path="/designer/upload/pricing" element={<DesignUploadPricingPage />} />
            <Route path="/designer/designs" element={<MyDesignsPage />} />
            <Route path="/designer/analytics" element={<DesignAnalyticsPage />} />
            <Route path="/designer/earnings" element={<EarningsPayoutsPage />} />
            <Route path="/designer/profile" element={<DesignerProfilePage />} />
          </Route>
        </Routes>
      </OrderProvider>
    </BrowserRouter>
  );
}

export default App;

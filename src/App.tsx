import { BrowserRouter, Routes, Route, Navigate, useNavigate as useNav404 } from 'react-router-dom';
import { lazy, type ComponentType } from 'react';
// Eager: the entry/auth pages + the layout shell (always needed on first paint).
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminRegisterPage } from './pages/admin/AdminRegisterPage';
import { AdminResetPasswordPage } from './pages/admin/AdminResetPasswordPage';

// G23 — route pages are lazy-loaded so each becomes its own chunk instead of
// one ~1.3 MB bundle. These modules use NAMED exports, so map to the { default }
// shape React.lazy expects. The <Suspense> boundary lives in AdminLayout (around
// its <Outlet/>), so the sidebar stays put while a page chunk loads.
function lazyPage<M extends Record<string, ComponentType<object>>>(
  loader: () => Promise<M>,
  name: keyof M,
) {
  return lazy(async () => ({ default: (await loader())[name] }));
}

const AdminDashboardPage = lazyPage(() => import('./pages/admin/AdminDashboardPage'), 'AdminDashboardPage');
const OrdersListPage = lazyPage(() => import('./pages/admin/OrdersListPage'), 'OrdersListPage');
const OrderDetailPage = lazyPage(() => import('./pages/admin/OrderDetailPage'), 'OrderDetailPage');
const UsersListPage = lazyPage(() => import('./pages/admin/UsersListPage'), 'UsersListPage');
const UserDetailPage = lazyPage(() => import('./pages/admin/UserDetailPage'), 'UserDetailPage');
const HubsListPage = lazyPage(() => import('./pages/admin/HubsListPage'), 'HubsListPage');
const HubDetailPage = lazyPage(() => import('./pages/admin/HubDetailPage'), 'HubDetailPage');
const ProductsListPage = lazyPage(() => import('./pages/admin/ProductsListPage'), 'ProductsListPage');
const ProductEditPage = lazyPage(() => import('./pages/admin/ProductEditPage'), 'ProductEditPage');
const ContentPage = lazyPage(() => import('./pages/admin/ContentPage'), 'ContentPage');
const AnalyticsPage = lazyPage(() => import('./pages/admin/AnalyticsPage'), 'AnalyticsPage');
const SupportListPage = lazyPage(() => import('./pages/admin/SupportListPage'), 'SupportListPage');
const TicketDetailPage = lazyPage(() => import('./pages/admin/TicketDetailPage'), 'TicketDetailPage');
const PromoCodesPage = lazyPage(() => import('./pages/admin/PromoCodesPage'), 'PromoCodesPage');
const AppConfigPage = lazyPage(() => import('./pages/admin/AppConfigPage'), 'AppConfigPage');
const AuditLogPage = lazyPage(() => import('./pages/admin/AuditLogPage'), 'AuditLogPage');
const WaitlistPage = lazyPage(() => import('./pages/admin/WaitlistPage'), 'WaitlistPage');
const AdminUsersManagePage = lazyPage(() => import('./pages/admin/AdminUsersManagePage'), 'AdminUsersManagePage');
const CollectionsListPage = lazyPage(() => import('./pages/admin/CollectionsListPage'), 'CollectionsListPage');
const CollectionEditPage = lazyPage(() => import('./pages/admin/CollectionEditPage'), 'CollectionEditPage');
const BannersPage = lazyPage(() => import('./pages/admin/BannersPage'), 'BannersPage');
const CategoriesPage = lazyPage(() => import('./pages/admin/CategoriesPage'), 'CategoriesPage');
const HomeSectionsPage = lazyPage(() => import('./pages/admin/HomeSectionsPage'), 'HomeSectionsPage');
const ReturnsListPage = lazyPage(() => import('./pages/admin/ReturnsListPage'), 'ReturnsListPage');
const ReturnDetailPage = lazyPage(() => import('./pages/admin/ReturnDetailPage'), 'ReturnDetailPage');
const AlterationsListPage = lazyPage(() => import('./pages/admin/AlterationsListPage'), 'AlterationsListPage');
const HomeVisitsListPage = lazyPage(() => import('./pages/admin/HomeVisitsListPage'), 'HomeVisitsListPage');
const HomeVisitDetailPage = lazyPage(() => import('./pages/admin/HomeVisitDetailPage'), 'HomeVisitDetailPage');
const InvoicesListPage = lazyPage(() => import('./pages/admin/InvoicesListPage'), 'InvoicesListPage');
const CodReconciliationPage = lazyPage(() => import('./pages/admin/CodReconciliationPage'), 'CodReconciliationPage');
const ConsultationsPage = lazyPage(() => import('./pages/admin/ConsultationsPage'), 'ConsultationsPage');
const NotificationBlastPage = lazyPage(() => import('./pages/admin/NotificationBlastPage'), 'NotificationBlastPage');
const PincodeWaitlistPage = lazyPage(() => import('./pages/admin/PincodeWaitlistPage'), 'PincodeWaitlistPage');
const ServiceAreasPage = lazyPage(() => import('./pages/admin/ServiceAreasPage'), 'ServiceAreasPage');
const AdminProfilePage = lazyPage(() => import('./pages/admin/AdminProfilePage'), 'AdminProfilePage');
const MeasurementBookingsListPage = lazyPage(() => import('./pages/admin/MeasurementBookingsListPage'), 'MeasurementBookingsListPage');
const MeasurementBookingDetailPage = lazyPage(() => import('./pages/admin/MeasurementBookingDetailPage'), 'MeasurementBookingDetailPage');
const MeasurementBookingNewPage = lazyPage(() => import('./pages/admin/MeasurementBookingNewPage'), 'MeasurementBookingNewPage');
const GarmentTypesPage = lazyPage(() => import('./pages/admin/GarmentTypesPage'), 'GarmentTypesPage');
const ReviewsListPage = lazyPage(() => import('./pages/admin/ReviewsListPage'), 'ReviewsListPage');

function NotFoundPage() {
  const nav = useNav404();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.25 }}>404</div>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 600 }}>Page not found</h2>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', opacity: 0.55, maxWidth: 360 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button
        onClick={() => nav('/admin/dashboard')}
        style={{
          padding: '10px 24px', background: 'var(--color-primary, #1F6B4F)', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem',
          fontFamily: 'inherit', fontWeight: 500,
        }}
      >
        ← Back to Dashboard
      </button>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
        <Routes>
          {/* Root + legacy paths redirect to the admin panel */}
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/register" element={<AdminRegisterPage />} />
          <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
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
            <Route path="catalog/banners" element={<BannersPage />} />
            <Route path="catalog/categories" element={<CategoriesPage />} />
            <Route path="catalog/home-layout" element={<HomeSectionsPage />} />
            <Route path="content/:section" element={<ContentPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="analytics/:section" element={<AnalyticsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="support" element={<SupportListPage />} />
            <Route path="support/:id" element={<TicketDetailPage />} />
            <Route path="system/app-config" element={<AppConfigPage />} />
            <Route path="system/audit-log" element={<AuditLogPage />} />
            <Route path="system/waitlist" element={<WaitlistPage />} />
            <Route path="system/admin-users" element={<AdminUsersManagePage />} />
            <Route path="system/service-areas" element={<ServiceAreasPage />} />
            <Route path="returns" element={<ReturnsListPage />} />
            <Route path="returns/:id" element={<ReturnDetailPage />} />
            <Route path="alterations" element={<AlterationsListPage />} />
            <Route path="home-visits" element={<HomeVisitsListPage />} />
            <Route path="home-visits/:id" element={<HomeVisitDetailPage />} />
            <Route path="invoices" element={<InvoicesListPage />} />
            <Route path="finance/cod-reconciliation" element={<CodReconciliationPage />} />
            <Route path="consultations" element={<ConsultationsPage />} />
            <Route path="notifications" element={<NotificationBlastPage />} />
            <Route path="pincode-waitlist" element={<PincodeWaitlistPage />} />
            <Route path="promo-codes" element={<PromoCodesPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
            <Route path="measurement-bookings" element={<MeasurementBookingsListPage />} />
            <Route path="measurement-bookings/new" element={<MeasurementBookingNewPage />} />
            <Route path="measurement-bookings/:id" element={<MeasurementBookingDetailPage />} />
            <Route path="system/garment-types" element={<GarmentTypesPage />} />
            <Route path="reviews" element={<ReviewsListPage />} />
            {/* Admin 404 — renders inside the sidebar layout */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Global 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
    </BrowserRouter>
  );
}

export default App;

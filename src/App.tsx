import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate as useNav404,
} from "react-router-dom";
import { lazy, type ComponentType } from "react";
// Eager: the entry/auth pages + the layout shell (always needed on first paint).
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminRegisterPage } from "./pages/admin/AdminRegisterPage";
import { AdminResetPasswordPage } from "./pages/admin/AdminResetPasswordPage";

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

const AdminDashboardPage = lazyPage(
  () => import("./pages/admin/AdminDashboardPage"),
  "AdminDashboardPage",
);
const OrdersListPage = lazyPage(
  () => import("./pages/admin/OrdersListPage"),
  "OrdersListPage",
);
const OrderDetailPage = lazyPage(
  () => import("./pages/admin/OrderDetailPage"),
  "OrderDetailPage",
);
const UsersListPage = lazyPage(
  () => import("./pages/admin/UsersListPage"),
  "UsersListPage",
);
const UserDetailPage = lazyPage(
  () => import("./pages/admin/UserDetailPage"),
  "UserDetailPage",
);
const HubsListPage = lazyPage(
  () => import("./pages/admin/HubsListPage"),
  "HubsListPage",
);
const HubDetailPage = lazyPage(
  () => import("./pages/admin/HubDetailPage"),
  "HubDetailPage",
);
const ProductsListPage = lazyPage(
  () => import("./pages/admin/ProductsListPage"),
  "ProductsListPage",
);
const ProductEditPage = lazyPage(
  () => import("./pages/admin/ProductEditPage"),
  "ProductEditPage",
);
const ContentPage = lazyPage(
  () => import("./pages/admin/ContentPage"),
  "ContentPage",
);
const AnalyticsPage = lazyPage(
  () => import("./pages/admin/AnalyticsPage"),
  "AnalyticsPage",
);
const SupportListPage = lazyPage(
  () => import("./pages/admin/SupportListPage"),
  "SupportListPage",
);
const TicketDetailPage = lazyPage(
  () => import("./pages/admin/TicketDetailPage"),
  "TicketDetailPage",
);
const CallConsolePage = lazyPage(
  () => import("./pages/admin/CallConsolePage"),
  "CallConsolePage",
);
const PromoCodesPage = lazyPage(
  () => import("./pages/admin/PromoCodesPage"),
  "PromoCodesPage",
);
const AppConfigPage = lazyPage(
  () => import("./pages/admin/AppConfigPage"),
  "AppConfigPage",
);
const AuditLogPage = lazyPage(
  () => import("./pages/admin/AuditLogPage"),
  "AuditLogPage",
);
const AdminUsersManagePage = lazyPage(
  () => import("./pages/admin/AdminUsersManagePage"),
  "AdminUsersManagePage",
);
const CollectionsListPage = lazyPage(
  () => import("./pages/admin/CollectionsListPage"),
  "CollectionsListPage",
);
const CollectionEditPage = lazyPage(
  () => import("./pages/admin/CollectionEditPage"),
  "CollectionEditPage",
);
const BannersPage = lazyPage(
  // BannersPage also exports the reusable BannerHero renderer + helpers; narrow the
  // module to just the page component so the (components-only) generic is satisfied.
  () => import("./pages/admin/BannersPage") as Promise<{ BannersPage: ComponentType<object> }>,
  "BannersPage",
);
const CategoriesPage = lazyPage(
  () => import("./pages/admin/CategoriesPage"),
  "CategoriesPage",
);
const HomeSectionsPage = lazyPage(
  () => import("./pages/admin/HomeSectionsPage"),
  "HomeSectionsPage",
);
const ReturnsListPage = lazyPage(
  () => import("./pages/admin/ReturnsListPage"),
  "ReturnsListPage",
);
const ReturnDetailPage = lazyPage(
  () => import("./pages/admin/ReturnDetailPage"),
  "ReturnDetailPage",
);
const AlterationsListPage = lazyPage(
  () => import("./pages/admin/AlterationsListPage"),
  "AlterationsListPage",
);
const SampleDetailPage = lazyPage(
  () => import("./pages/admin/SampleDetailPage"),
  "SampleDetailPage",
);
const DesignLibraryPage = lazyPage(
  () => import("./pages/admin/DesignLibraryPage"),
  "DesignLibraryPage",
);
const DesignDetailPage = lazyPage(
  () => import("./pages/admin/DesignDetailPage"),
  "DesignDetailPage",
);
const DesignOverviewPage = lazyPage(
  () => import("./pages/admin/DesignOverviewPage"),
  "DesignOverviewPage",
);
const ListingsOverviewPage = lazyPage(
  () => import("./pages/admin/ListingsOverviewPage"),
  "ListingsOverviewPage",
);
const SupplyOverviewPage = lazyPage(
  () => import("./pages/admin/SupplyOverviewPage"),
  "SupplyOverviewPage",
);
const HubConstraintsPage = lazyPage(
  () => import("./pages/admin/HubConstraintsPage"),
  "HubConstraintsPage",
);
const InvoicesListPage = lazyPage(
  () => import("./pages/admin/InvoicesListPage"),
  "InvoicesListPage",
);
const CodReconciliationPage = lazyPage(
  () => import("./pages/admin/CodReconciliationPage"),
  "CodReconciliationPage",
);
const FinanceReportPage = lazyPage(
  () => import("./pages/admin/FinanceReportPage"),
  "FinanceReportPage",
);
const NotificationBlastPage = lazyPage(
  () => import("./pages/admin/NotificationBlastPage"),
  "NotificationBlastPage",
);
const PincodeWaitlistPage = lazyPage(
  () => import("./pages/admin/PincodeWaitlistPage"),
  "PincodeWaitlistPage",
);
const ServiceAreasPage = lazyPage(
  () => import("./pages/admin/ServiceAreasPage"),
  "ServiceAreasPage",
);
const SystemHealthPage = lazyPage(
  () => import("./pages/admin/SystemHealthPage"),
  "SystemHealthPage",
);
const FitOutcomesPage = lazyPage(
  () => import("./pages/admin/FitOutcomesPage"),
  "FitOutcomesPage",
);
const AdminProfilePage = lazyPage(
  () => import("./pages/admin/AdminProfilePage"),
  "AdminProfilePage",
);
// T3-2 (W-U1): per-console in-product help.
const HelpPage = lazyPage(() => import("./pages/admin/HelpPage"), "HelpPage");
const GarmentTypeTemplatesPage = lazyPage(
  () => import("./pages/admin/GarmentTypeTemplatesPage"),
  "GarmentTypeTemplatesPage",
);
const GarmentTemplateEditorPage = lazyPage(
  () => import("./pages/admin/GarmentTemplateEditorPage"),
  "GarmentTemplateEditorPage",
);
const DesignAnalyticsPage = lazyPage(
  () => import("./pages/admin/DesignAnalyticsPage"),
  "DesignAnalyticsPage",
);
const EngineTesterPage = lazyPage(
  () => import("./pages/admin/EngineTesterPage"),
  "EngineTesterPage",
);
const SamplesPage = lazyPage(
  () => import("./pages/admin/SamplesPage"),
  "SamplesPage",
);
const FabricsMasterPage = lazyPage(
  () => import("./pages/admin/FabricsMasterPage"),
  "FabricsMasterPage",
);
const FabricPdpPage = lazyPage(
  () => import("./pages/admin/FabricPdpPage"),
  "FabricPdpPage",
);
const DistributionPage = lazyPage(
  () => import("./pages/admin/DistributionPage"),
  "DistributionPage",
);
const RestockQueuePage = lazyPage(
  () => import("./pages/admin/RestockQueuePage"),
  "RestockQueuePage",
);
const CrossHubStockPage = lazyPage(
  () => import("./pages/admin/CrossHubStockPage"),
  "CrossHubStockPage",
);
const ListingRequestsPage = lazyPage(
  () => import("./pages/admin/ListingRequestsPage"),
  "ListingRequestsPage",
);
const FabricAtHubPage = lazyPage(
  () => import("./pages/admin/FabricAtHubPage"),
  "FabricAtHubPage",
);
const ListingsManagePage = lazyPage(
  () => import("./pages/admin/ListingsManagePage"),
  "ListingsManagePage",
);
const FabricStockPage = lazyPage(
  () => import("./pages/admin/FabricStockPage"),
  "FabricStockPage",
);
const BrandQcPage = lazyPage(
  () => import("./pages/admin/BrandQcPage"),
  "BrandQcPage",
);
const QcResultPage = lazyPage(
  () => import("./pages/admin/QcResultPage"),
  "QcResultPage",
);
const QcTemplatesPage = lazyPage(
  () => import("./pages/admin/QcTemplatesPage"),
  "QcTemplatesPage",
);
const DeadStockPage = lazyPage(
  () => import("./pages/admin/DeadStockPage"),
  "DeadStockPage",
);
const CentralStockPage = lazyPage(
  () => import("./pages/admin/CentralStockPage"),
  "CentralStockPage",
);
const ReviewsListPage = lazyPage(
  () => import("./pages/admin/ReviewsListPage"),
  "ReviewsListPage",
);
const FitFeedbackPage = lazyPage(
  () => import("./pages/admin/FitFeedbackPage"),
  "FitFeedbackPage",
);
const RefundsPage = lazyPage(
  () => import("./pages/admin/RefundsPage"),
  "RefundsPage",
);
const BrandLedgerPage = lazyPage(
  () => import("./pages/admin/BrandLedgerPage"),
  "BrandLedgerPage",
);
const CreditApprovalsPage = lazyPage(
  () => import("./pages/admin/CreditApprovalsPage"),
  "CreditApprovalsPage",
);
const StaffManagementPage = lazyPage(
  () => import("./pages/admin/StaffManagementPage"),
  "StaffManagementPage",
);

function NotFoundPage() {
  const nav = useNav404();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.25 }}>404</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem", fontWeight: 600 }}>
        Page not found
      </h2>
      <p
        style={{
          margin: "0 0 24px",
          fontSize: "0.875rem",
          opacity: 0.55,
          maxWidth: 360,
        }}
      >
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button
        onClick={() => nav("/admin/dashboard")}
        style={{
          padding: "10px 24px",
          background: "var(--color-primary, #1F6B4F)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: "0.875rem",
          fontFamily: "inherit",
          fontWeight: 500,
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
        <Route
          path="/admin/reset-password"
          element={<AdminResetPasswordPage />}
        />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="orders" element={<OrdersListPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="orders/qc/:orderItemId" element={<QcResultPage />} />
          <Route path="users" element={<UsersListPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="hubs" element={<HubsListPage />} />
          <Route path="hubs/new" element={<HubDetailPage />} />
          <Route path="hubs/:id" element={<HubDetailPage />} />
          {/* Catalog has no index page of its own (it's split into Listings/Categories/etc.)
              — redirect the bare segment to Listings so the "Catalog" breadcrumb / a typed
              URL doesn't 404. (content + analytics already have bare routes.) */}
          <Route path="catalog" element={<Navigate to="/admin/catalog/listings" replace />} />
          <Route path="catalog/products" element={<ProductsListPage />} />
          <Route path="catalog/products/:id" element={<ProductEditPage />} />
          <Route path="catalog/collections" element={<CollectionsListPage />} />
          <Route
            path="catalog/collections/:id"
            element={<CollectionEditPage />}
          />
          <Route path="catalog/banners" element={<BannersPage />} />
          <Route path="catalog/categories" element={<CategoriesPage />} />
          <Route path="catalog/home-layout" element={<HomeSectionsPage />} />
          <Route path="content/:section" element={<ContentPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="analytics/:section" element={<AnalyticsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="support" element={<SupportListPage />} />
          <Route path="support/call" element={<CallConsolePage />} />
          <Route path="fit-feedback" element={<FitFeedbackPage />} />
          <Route path="fit-outcomes" element={<FitOutcomesPage />} />
          <Route path="support/:id" element={<TicketDetailPage />} />
          <Route path="system/app-config" element={<AppConfigPage />} />
          <Route path="system/audit-log" element={<AuditLogPage />} />
          <Route path="system/admin-users" element={<AdminUsersManagePage />} />
          <Route path="system/service-areas" element={<ServiceAreasPage />} />
          <Route path="system/health" element={<SystemHealthPage />} />
          <Route path="system/staff" element={<StaffManagementPage />} />
          <Route path="returns" element={<ReturnsListPage />} />
          <Route path="returns/:id" element={<ReturnDetailPage />} />
          <Route path="alterations" element={<AlterationsListPage />} />
          <Route path="design/samples" element={<SamplesPage />} />
          <Route path="design/samples/:id" element={<SampleDetailPage />} />
          <Route path="design/library" element={<DesignLibraryPage />} />
          {/* New/edit open the wizard modal OVER the library/detail (page stays behind, dimmed). */}
          <Route path="design/library/new" element={<DesignLibraryPage autoNew />} />
          <Route path="design/library/:id" element={<DesignDetailPage />} />
          <Route path="design/library/:id/cut-sheet" element={<DesignDetailPage autoCutSheet />} />
          <Route path="design/library/:id/edit" element={<DesignDetailPage autoEdit />} />
          <Route
            path="design/templates"
            element={<GarmentTypeTemplatesPage />}
          />
          <Route
            path="design/templates/:id"
            element={<GarmentTemplateEditorPage />}
          />
          <Route path="design/analytics" element={<DesignAnalyticsPage />} />
          <Route path="design/engine-tester" element={<EngineTesterPage />} />
          <Route
            path="design/fabrics"
            element={<FabricsMasterPage mode="design" />}
          />
          <Route
            path="design/fabrics/:id"
            element={<FabricPdpPage mode="design" />}
          />
          {/* Legacy path — the two sample pages are now one tabbed Samples page. Keep the
              route so old deep-links (?design=) + the CM nav entry still resolve. */}
          <Route path="design/my-samples" element={<SamplesPage />} />
          <Route path="procurement/fabrics" element={<FabricsMasterPage />} />
          <Route path="procurement/fabrics/:id" element={<FabricPdpPage />} />
          <Route
            path="procurement/distribution"
            element={<DistributionPage />}
          />
          <Route path="procurement/restock" element={<RestockQueuePage />} />
          <Route path="procurement/stock" element={<CrossHubStockPage />} />
          <Route
            path="procurement/listing-requests"
            element={<ListingRequestsPage mode="procurement" />}
          />
          <Route
            path="catalog/listing-requests"
            element={<ListingRequestsPage mode="cm" />}
          />
          <Route
            path="catalog/restock"
            element={<RestockQueuePage mode="cm" />}
          />
          <Route path="catalog/listings" element={<ListingsManagePage />} />
          <Route path="catalog/fabric-stock" element={<FabricStockPage />} />
          <Route path="catalog/qc-templates" element={<QcTemplatesPage />} />
          <Route path="catalog/brand-qc" element={<BrandQcPage />} />
          <Route path="catalog/dead-stock" element={<DeadStockPage />} />
          <Route path="procurement/central-stock" element={<CentralStockPage />} />
          <Route
            path="procurement/track/:hubId/:fabricId"
            element={<FabricAtHubPage />}
          />
          <Route path="oversight/designs" element={<DesignOverviewPage />} />
          <Route path="oversight/listings" element={<ListingsOverviewPage />} />
          <Route path="oversight/supply" element={<SupplyOverviewPage />} />
          <Route path="oversight/hub-constraints" element={<HubConstraintsPage />} />
          <Route path="invoices" element={<InvoicesListPage />} />
          <Route
            path="finance/cod-reconciliation"
            element={<CodReconciliationPage />}
          />
          <Route
            path="finance/settlement"
            element={<FinanceReportPage mode="settlement" />}
          />
          <Route
            path="finance/pnl"
            element={<FinanceReportPage mode="pnl" />}
          />
          <Route path="finance/refunds" element={<RefundsPage />} />
          <Route path="finance/brand-ledger" element={<BrandLedgerPage />} />
          <Route path="finance/credit-approvals" element={<CreditApprovalsPage />} />
          <Route path="notifications" element={<NotificationBlastPage />} />
          <Route path="pincode-waitlist" element={<PincodeWaitlistPage />} />
          <Route path="promo-codes" element={<PromoCodesPage />} />
          <Route path="profile" element={<AdminProfilePage />} />
          <Route path="help" element={<HelpPage />} />
          {/* measurement-bookings routes removed (G-21): System-2 model retired;
              the backend router is unmounted — these pages 404'd on every call. */}
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

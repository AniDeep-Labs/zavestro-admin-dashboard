import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate as useNav404,
  useLocation as useLoc404,
} from "react-router-dom";
import { lazy, type ComponentType } from "react";
import nf from "./pages/admin/NotFoundPage.module.css"; // [KA1-10]
// Eager: the entry/auth pages + the layout shell (always needed on first paint).
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
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
// AG-S3 (scan): print garment tags, attached at cutting.
const GarmentTagsPage = lazyPage(
  () => import("./pages/admin/GarmentTagsPage"),
  "GarmentTagsPage",
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
const TechPackImportPage = lazyPage(
  () => import("./pages/admin/TechPackImportPage"),
  "TechPackImportPage",
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
  const loc = useLoc404();

  // [KA1-10] Open the palette through the SAME entry point the rest of the app uses:
  // AdminLayout binds ⌘K on `window`, so dispatching the shortcut reuses that one handler
  // rather than adding a second way in that could drift from it.
  const openPalette = () =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }),
    );

  return (
    <div className={nf.wrap}>
      <div className={nf.code}>404</div>
      <h2 className={nf.title}>Page not found</h2>
      <p className={nf.body}>The page you're looking for doesn't exist or has been moved.</p>
      <p className={nf.path}>{loc.pathname}</p>
      <div className={nf.actions}>
        <button className={nf.primary} onClick={() => nav('/admin/dashboard')}>
          ← Back to Dashboard
        </button>
        <button className={nf.secondary} onClick={openPalette}>
          Search for a page<span className={nf.kbd}>⌘K</span>
        </button>
      </div>
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
        {/* [SHL-2-5 / SHL-2-6] Self-registration was removed (T1-8 / P-3) and the backend
            has returned 410 ever since — but the page still RENDERED, so the one
            call-to-action aimed at a brand-new colleague was a four-field form (name,
            email, password, confirm) that could never succeed, ending in "ask someone
            else". It also invited a password the system would never store, and its
            "Request submitted! … pending activation" success screen was unreachable dead
            code describing a workflow that no longer exists — a trap for the next
            developer, who would read it as current. Component deleted; the path redirects
            so an old bookmark lands somewhere real instead of on a 404. */}
        <Route path="/admin/register" element={<Navigate to="/admin/login" replace />} />
        <Route
          path="/admin/reset-password"
          element={<AdminResetPasswordPage />}
        />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="orders" element={<OrdersListPage />} />
          {/* AG-S3 (scan): tags are printed at cutting, so this sits under orders.
              Declared BEFORE orders/:id. React Router ranks a static segment
              above a dynamic one so this would win either way, but relying on
              that makes the file read as if "tags" could be an order id. */}
          <Route path="orders/tags" element={<GarmentTagsPage />} />
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
          {/* [SHL-3-10] quick-create deep-link — opens the create modal, not just the list */}
          <Route path="support/new" element={<SupportListPage autoNew />} />
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
          {/* [SHL-3-10] */}
          <Route path="system/staff/new" element={<StaffManagementPage autoNew />} />
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
          {/* A brand's own size chart into the engine. Until this existed, every
              design fell back to a generic category chart and nothing said so. */}
          <Route path="design/tech-packs" element={<TechPackImportPage />} />
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
          {/* [SHL-3-10] Before :id for readability — v6 already ranks the static
              segment above the dynamic one, so "new" can never be read as a fabric id. */}
          <Route path="procurement/fabrics/new" element={<FabricsMasterPage autoNew />} />
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
          {/* [SHL-3-10] */}
          <Route path="catalog/listings/new" element={<ListingsManagePage autoNew />} />
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

import React, { Suspense } from "react";
import { Outlet, useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import { toggleTheme, getCurrentTheme } from "../../utils/theme";
import { hasAdminToken } from "../../api/catalogApi";
import {
  adminAuth,
  getAdminUser,
  getAdminCapabilities,
  setAdminCapabilities,
  adminAuthExtApi,
  navCountsApi,
  hubsApi,
} from "../../api/adminApi";
import type { NavCounts, Hub } from "../../api/adminApi";
import { getAdminHubContext, setAdminHubContext } from "../../utils/hubContext";
import { isProductionApi, apiHost } from "../../api/apiBase"; // [SHL-2-13]
import { ErrorBoundary } from "../../components/ErrorBoundary/ErrorBoundary";
import { Spinner } from "../../components/Spinner";
import { AccessDenied } from "../../components/AccessDenied/AccessDenied";
import {
  BreadcrumbProvider,
  useBreadcrumb,
} from "../../contexts/BreadcrumbContext";
import styles from "./AdminLayout.module.css";
import { NotificationBell } from "./NotificationBell";
import { CommandPalette } from "../../components/CommandPalette";
import type { NavTarget, PaletteAction } from "../../components/CommandPalette";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { hasUnsavedChanges } from "../../hooks/useDirtyGuard";
import {
  UilAngleDoubleLeft,
  UilAngleDoubleRight,
  UilAngleDown,
  UilAngleRight,
  UilBolt,
  UilBox,
  UilBuilding,
  UilChartBar,
  UilCheckCircle,
  UilDashboard,
  UilFileAlt,
  UilHeadphones,
  UilPhone,
  UilHistory,
  UilLayerGroup,
  UilMapMarker,
  UilMegaphone,
  UilMoon,
  UilPlus,
  UilProcess,
  UilQuestionCircle,
  UilReceipt,
  UilRuler,
  UilSearch,
  UilSetting,
  UilShoppingBag,
  UilSignout,
  UilStar,
  UilSun,
  UilTag,
  UilTicket,
  UilUsersAlt,
  UilWallet,
} from "@iconscout/react-unicons";

// Role-scoped navigation (CATALOG-DARKSTORE-ARCHITECTURE §11–18): the sidebar is
// grouped into capability-gated WORKSPACES, not a flat list. A role sees only the
// sections whose capability it holds — e.g. `design` sees only the Design console;
// `super_admin` (all caps) sees everything. Item-level `cap` gates within a section.
interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  cap?: string;
  caps?: string[]; // visible if the user holds ANY of these (overrides `cap`)
  // `superOnly` child: account-governance links (e.g. Admin Users) that the backend
  // gates to super_admin ONLY. Hidden even from legacy god-mode `admin`, so what the
  // Operations role SEES matches what it can actually DO (no click-then-403).
  children?: { label: string; path: string; superOnly?: boolean }[];
  hidden?: boolean; // kept in code (routes/page intact) but never shown in nav — for dormant, unowned surfaces
}
interface NavSection {
  title: string;
  caps: string[]; // section shows if the user holds ANY of these
  items: NavItem[];
  // A role-owned *operating* console (design/catalog_manager). super_admin is
  // oversight-only, so these are hidden from super (super gets read-only overviews
  // instead). Shown to the owning role + the legacy `admin` god-mode account.
  roleOwned?: boolean;
  // A super-admin read-only OVERVIEW section — shown only to super_admin (+ legacy admin).
  superOnly?: boolean;
}

// Always-visible home (no section header).
const HOME: NavItem = {
  label: "Dashboard",
  icon: <UilDashboard size={18} />,
  path: "/admin/dashboard",
};

const SECTIONS: NavSection[] = [
  {
    title: "Overviews",
    caps: ["reports:read"],
    superOnly: true,
    items: [
      {
        label: "Design Overview",
        icon: <UilLayerGroup size={18} />,
        path: "/admin/oversight/designs",
        cap: "reports:read",
      },
      {
        label: "Listings Overview",
        icon: <UilTag size={18} />,
        path: "/admin/oversight/listings",
        cap: "reports:read",
      },
      {
        label: "Supply Overview",
        icon: <UilBox size={18} />,
        path: "/admin/oversight/supply",
        cap: "reports:read",
      },
      {
        // T2-7: per-hub WIP × stage bottleneck view + festival/leave calendar.
        label: "Hub Constraints",
        icon: <UilBox size={18} />,
        path: "/admin/oversight/hub-constraints",
        cap: "reports:read",
      },
    ],
  },
  {
    title: "Design",
    caps: ["designs:write"],
    roleOwned: true,
    items: [
      {
        label: "Design Library",
        icon: <UilLayerGroup size={18} />,
        path: "/admin/design/library",
        cap: "designs:write",
      },
      {
        label: "Fabrics",
        icon: <UilTag size={18} />,
        path: "/admin/design/fabrics",
        cap: "designs:write",
      },
      {
        label: "Garment Types",
        icon: <UilRuler size={18} />,
        path: "/admin/design/templates",
        cap: "designs:write",
      },
      {
        label: "Engine Tester",
        icon: <UilBolt size={18} />,
        path: "/admin/design/engine-tester",
        cap: "fit:read",
      },
      {
        // The brand's own sizing, into the engine. Sits beside Engine Tester
        // because they are two halves of the same job: load the chart, then see
        // what it cuts.
        label: "Tech Packs",
        icon: <UilRuler size={18} />,
        path: "/admin/design/tech-packs",
        cap: "designs:write",
      },
      {
        // One nav home for the sampling pipeline — the page has Requests + Review tabs
        // (Review shows only with designs:write). Replaces the two confusable entries.
        label: "Samples",
        icon: <UilCheckCircle size={18} />,
        path: "/admin/design/samples",
        cap: "samples:write",
      },
      {
        label: "Design Analytics",
        icon: <UilChartBar size={18} />,
        path: "/admin/design/analytics",
        cap: "fit:read",
      },
      {
        // [SUP-34-4] The other half of the fit loop, surfaced in the console that
        // owns the fix. Same page as CX's entry; the API masks the customer for a
        // role that holds fit:read without customers:read.
        label: "Fit Complaints",
        icon: <UilRuler size={18} />,
        path: "/admin/fit-feedback",
        cap: "fit:read",
      },
    ],
  },
  {
    title: "Procurement",
    caps: ["distribution:write"],
    roleOwned: true,
    items: [
      {
        label: "Fabrics Master",
        icon: <UilTag size={18} />,
        path: "/admin/procurement/fabrics",
        cap: "distribution:write",
      },
      {
        label: "Central Stock",
        icon: <UilLayerGroup size={18} />,
        path: "/admin/procurement/central-stock",
        cap: "distribution:write",
      },
      {
        label: "Distribution",
        icon: <UilProcess size={18} />,
        path: "/admin/procurement/distribution",
        cap: "distribution:write",
      },
      {
        label: "Restock Queue",
        icon: <UilHistory size={18} />,
        path: "/admin/procurement/restock",
        cap: "distribution:write",
      },
      {
        label: "Cross-hub Stock",
        icon: <UilBox size={18} />,
        path: "/admin/procurement/stock",
        cap: "distribution:write",
      },
      {
        label: "Listing Requests",
        icon: <UilReceipt size={18} />,
        path: "/admin/procurement/listing-requests",
        cap: "distribution:write",
      },
    ],
  },
  {
    title: "Catalog · storefront",
    caps: ["catalog:write", "cms:write"],
    roleOwned: true,
    items: [
      {
        label: "Listings",
        icon: <UilShoppingBag size={18} />,
        path: "/admin/catalog/listings",
        cap: "catalog:write",
      },
      {
        label: "Fabric for Listing",
        icon: <UilReceipt size={18} />,
        path: "/admin/catalog/listing-requests",
        cap: "catalog:write",
      },
      {
        // The CM's pipeline step BETWEEN fabric and listing: request a sample (design×fabric)
        // for the design team to review. The CM holds `samples:write` (backend expects them to
        // REQUEST samples — sample-jobs.admin.routes §73), but the request page lived only under
        // the `designs:write` Design console → the CM couldn't reach it. Surfaced here in the
        // CM's own pipeline. (Same page; the design-only "Sample Review"/verdict stays gated.)
        label: "Sample Requests",
        icon: <UilBox size={18} />,
        path: "/admin/design/my-samples",
        cap: "samples:write",
      },
      {
        label: "Fabric Stock",
        icon: <UilLayerGroup size={18} />,
        path: "/admin/catalog/fabric-stock",
        cap: "catalog:write",
      },
      {
        // T1-13b: per-garment-category inbound-QC checklists (which checks + tolerances).
        label: "QC Templates",
        icon: <UilCheckCircle size={18} />,
        path: "/admin/catalog/qc-templates",
        cap: "catalog:write",
      },
      {
        // T3-4: a 3P brand's second QC layer (QC-2) per garment category.
        label: "Brand QC-2",
        icon: <UilCheckCircle size={18} />,
        path: "/admin/catalog/brand-qc",
        cap: "catalog:write",
      },
      {
        // T2-15: dead-stock aging + markdown flag (capital tied up).
        label: "Dead Stock",
        icon: <UilLayerGroup size={18} />,
        path: "/admin/catalog/dead-stock",
        cap: "catalog:write",
      },
      {
        label: "Request Restock",
        icon: <UilHistory size={18} />,
        path: "/admin/catalog/restock",
        cap: "restock:write",
      },
      {
        label: "Storefront",
        icon: <UilTag size={18} />,
        path: "/admin/catalog/collections",
        cap: "catalog:write",
        children: [
          { label: "Collections", path: "/admin/catalog/collections" },
          { label: "Hero Banners", path: "/admin/catalog/banners" },
          { label: "Categories", path: "/admin/catalog/categories" },
          { label: "Home Layout", path: "/admin/catalog/home-layout" },
        ],
      },
      {
        // HIDDEN from nav (2026-06-26, founder-approved). Content (Lookbook/Stories/Journal)
        // is a ghost CMS — no storefront route/fetch and no public endpoint renders it — and
        // it's brand content with no owner in the role model (CM had it by cap accident). Per
        // FABLE-ADMIN-UIUX §367/§573: "keep dormant; hide unowned children." Routes (App.tsx),
        // the ContentPage, and cmsApi stay INTACT (deep-link still works); flip `hidden` off
        // and re-gate `cap` to the marketing-owner role when one exists.
        label: "Content",
        icon: <UilFileAlt size={18} />,
        path: "/admin/content",
        cap: "cms:write",
        hidden: true,
        children: [
          { label: "Lookbook", path: "/admin/content/lookbook" },
          { label: "Stories", path: "/admin/content/stories" },
          { label: "Journal", path: "/admin/content/journal" },
        ],
      },
    ],
  },
  {
    // Brand-wide promotions — pricing_manager's home (pricing:write). Per-hub listing
    // PRICE belongs to catalog_manager (§6A); this role owns promo codes only.
    title: "Promotions",
    caps: ["pricing:write"],
    items: [
      {
        label: "Promo Codes",
        icon: <UilTicket size={18} />,
        path: "/admin/promo-codes",
        cap: "pricing:write",
      },
    ],
  },
  {
    title: "Orders & support",
    caps: ["orders:read", "orders:write", "customers:read", "reviews:moderate"],
    items: [
      {
        label: "Orders",
        icon: <UilShoppingBag size={18} />,
        path: "/admin/orders",
        cap: "orders:read",
      },
      {
        label: "Customers",
        icon: <UilUsersAlt size={18} />,
        path: "/admin/users",
        cap: "customers:read",
      },
      {
        label: "Returns",
        icon: <UilHistory size={18} />,
        path: "/admin/returns",
        // [SUP-31-1] Support raises and works the return; FINANCE approves the
        // refund — `ReturnDetailPage` is the only caller of `returnsApi.approve`
        // in the whole admin, and the finance Refunds worklist lists only refunds
        // already in flight, so there is no second door. With this page held at
        // `orders:write` alone, the role that could open it could not approve and
        // the role that could approve could not open it: a `defect_confirmed`
        // return was finishable only by the legacy god-mode account. The API
        // already 200s finance on both GETs — the backend expected it here.
        caps: ["orders:write", "refunds:approve"],
      },
      {
        label: "Alterations",
        icon: <UilProcess size={18} />,
        path: "/admin/alterations",
        cap: "orders:write",
      },
      {
        label: "Support",
        icon: <UilHeadphones size={18} />,
        path: "/admin/support",
        // [SUP-32-3] Escalation always targets FINANCE (`escalateTicket` →
        // notifyAdminRole('finance')), and finance held no ticket capability — so
        // the notification it received pointed at a page the nav guard refused and
        // an API that 403'd. Finance can now open the ticket it was handed; the
        // reply/assign verbs stay behind `customers:write` inside the page.
        caps: ["customers:write", "refunds:approve"],
      },
      {
        label: "Call console",
        icon: <UilPhone size={18} />,
        path: "/admin/support/call",
        cap: "customers:write",
      },
      {
        label: "Reviews",
        icon: <UilStar size={18} />,
        path: "/admin/reviews",
        cap: "reviews:moderate",
      },
      {
        label: "Fit Feedback",
        icon: <UilRuler size={18} />,
        path: "/admin/fit-feedback",
        // [SUP-34-4] Design owns fit calibration and could not read one verbatim
        // fit complaint; support reads them all day and cannot see the aggregate.
        // The raw feed is fit data — design gets it with the customer masked.
        caps: ["reviews:moderate", "fit:read"],
      },
      {
        label: "Coverage / Waitlist",
        icon: <UilMapMarker size={18} />,
        path: "/admin/pincode-waitlist",
        cap: "orders:read",
      },
    ],
  },
  {
    title: "Finance",
    caps: ["refunds:approve", "finance:read"],
    items: [
      {
        label: "Invoices",
        icon: <UilReceipt size={18} />,
        path: "/admin/invoices",
        cap: "refunds:approve",
      },
      {
        label: "COD Reconciliation",
        icon: <UilWallet size={18} />,
        path: "/admin/finance/cod-reconciliation",
        cap: "refunds:approve",
      },
      {
        label: "Refunds",
        icon: <UilReceipt size={18} />,
        path: "/admin/finance/refunds",
        cap: "refunds:approve",
      },
      {
        label: "Credit approvals",
        icon: <UilWallet size={18} />,
        path: "/admin/finance/credit-approvals",
        cap: "refunds:approve",
      },
      {
        label: "Brand ledger",
        icon: <UilReceipt size={18} />,
        path: "/admin/finance/brand-ledger",
        cap: "finance:read",
      },
      {
        label: "Online Settlement",
        icon: <UilReceipt size={18} />,
        path: "/admin/finance/settlement",
        cap: "finance:read",
      },
      {
        label: "Per-Hub P&L",
        icon: <UilChartBar size={18} />,
        path: "/admin/finance/pnl",
        cap: "finance:read",
      },
      // G-31: "Pincode Demand" removed — it pointed at the same /admin/pincode-waitlist
      // as "Coverage / Waitlist" in Orders & support, which finance already sees (orders:read).
    ],
  },
  // G-32: Analytics (reports:read) + Notification Blast (cms:write) moved OUT of the
  // super-only "Oversight · system" section into their own section, so their capability
  // owners can actually reach them — e.g. the design team sees the fit-calibration
  // analytics that tune their size charts. Item-level caps still gate each item.
  {
    title: "Insights & comms",
    // fit:read lets the design team into the section for Fit Outcomes only;
    // the company Analytics item below stays reports:read (design can't see it).
    // pricing:write = the promotions owner (pricing_manager) for the blast (G-86).
    caps: ["reports:read", "pricing:write", "fit:read"],
    items: [
      {
        label: "Analytics",
        icon: <UilChartBar size={18} />,
        path: "/admin/analytics",
        cap: "reports:read",
        children: [
          { label: "Revenue", path: "/admin/analytics/revenue" },
          { label: "Orders", path: "/admin/analytics/orders" },
          { label: "Fit Scores", path: "/admin/analytics/fit-scores" },
          {
            label: "Hub Performance",
            path: "/admin/analytics/hub-performance",
          },
          { label: "Retention", path: "/admin/analytics/retention" },
        ],
      },
      {
        label: "Fit Outcomes",
        icon: <UilRuler size={18} />,
        path: "/admin/fit-outcomes",
        caps: ["fit:read", "reports:read"], // design (fit) + finance/super (oversight)
      },
      {
        label: "Notification Blast",
        icon: <UilMegaphone size={18} />,
        path: "/admin/notifications",
        cap: "pricing:write", // G-86: promotions owner (pricing_manager), not catalog_manager
      },
    ],
  },
  {
    title: "Oversight · system",
    caps: ["system:manage"],
    items: [
      {
        label: "Hubs",
        icon: <UilBuilding size={18} />,
        path: "/admin/hubs",
        cap: "system:manage",
      },
      {
        label: "Ops Staff",
        icon: <UilUsersAlt size={18} />,
        path: "/admin/system/staff",
        cap: "staff:manage",
      },
      {
        label: "System",
        icon: <UilSetting size={18} />,
        path: "/admin/system",
        cap: "system:manage",
        children: [
          { label: "App Config", path: "/admin/system/app-config" },
          { label: "Audit Log", path: "/admin/system/audit-log" },
          { label: "Admin Users", path: "/admin/system/admin-users", superOnly: true },
          { label: "Service Areas", path: "/admin/system/service-areas" },
          { label: "System Health", path: "/admin/system/health" },
        ],
      },
    ],
  },
];

// Flat label→caps map (for the deep-link route guard), derived from SECTIONS + HOME.
// [SUP-31-1] It carries a LIST, not a single capability: a page whose API admits two
// roles must admit both here too, or the page and the verb end up held by different
// people — which is exactly how a return refund became un-approvable by any designed
// role (the page was `orders:write`/support, the approve button `refunds:approve`/
// finance, and only the legacy god-mode account held both).
const navCapsOf = (it: NavItem): string[] | undefined =>
  it.caps ?? (it.cap ? [it.cap] : undefined);
const NAV_CAP: Record<string, string[] | undefined> = Object.fromEntries([
  [HOME.label, undefined],
  ...SECTIONS.flatMap((s) => s.items.map((it) => [it.label, navCapsOf(it)])),
]);
const ALL_ITEMS: NavItem[] = [HOME, ...SECTIONS.flatMap((s) => s.items)];

// T3-9 (P-4): capability guard for routes that have NO nav ancestor (so `currentNav` misses
// them). Prefix-matched. FabricAtHub (procurement/track) needs the same cap as the rest of the
// procurement console. /admin/profile is intentionally omitted — any admin may view it.
const NAV_LESS_CAP: { prefix: string; caps: string[] }[] = [
  { prefix: "/admin/procurement/track", caps: ["distribution:write"] },
  // [SUP-27-1] The QC-result page hangs off an order row, not off the nav. It is a
  // floor verb held as break-glass; without an entry here a role without `qc:write`
  // deep-links into a page whose only button is hidden.
  { prefix: "/admin/orders/qc", caps: ["qc:write"] },
  // [LGC-24-2] The legacy product catalogue has no nav item at all — it was retired from
  // the sidebar and left reachable by URL — so `currentNav` misses it and NAV_CAP cannot
  // cover it. Rendered as `design` it gave the full page, filters and an "Add Product"
  // button, with three "your admin role lacks permission" toasts. The API denies
  // correctly; only the UI was wrong, which is the worse half: a role is shown a console
  // it cannot use and told so three times by a toast instead of once by the page.
  { prefix: "/admin/catalog/products", caps: ["catalog:write"] },
];

// T3-1 (S-1 + S-3): cap-gated create verbs — the single source for both the palette actions
// and the quick-create (+) menu, so they never offer a create the role can't do.
const CREATE_ACTIONS: { label: string; cap: string; to: string }[] = [
  { label: "New design", cap: "designs:write", to: "/admin/design/library/new" },
  { label: "New fabric", cap: "distribution:write", to: "/admin/procurement/fabrics" },
  { label: "New listing", cap: "catalog:write", to: "/admin/catalog/listings" },
  { label: "New ticket", cap: "customers:write", to: "/admin/support" },
  { label: "New staff", cap: "staff:manage", to: "/admin/system/staff" },
];
// Paths inside role-owned operating consoles (Design, Catalog) — deep-link-blocked for super_admin.
const ROLE_OWNED_PATHS: string[] = SECTIONS.filter((s) => s.roleOwned).flatMap(
  (s) => s.items.map((it) => it.path),
);

// Breadcrumb segment → display label, for URL segments whose path slug differs
// from the human label shown in the nav (e.g. /admin/users is the "Customers"
// workspace). Without this the breadcrumb just title-cases the slug → "Users".
const BREADCRUMB_SEGMENT_LABELS: Record<string, string> = {
  users: "Customers",
};

// Inner component rendered inside BreadcrumbProvider so useBreadcrumb() reads
// the correct context value (entity titles set by detail pages).
const AdminLayoutInner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { title: entityTitle } = useBreadcrumb();
  const [theme, setTheme] = React.useState(getCurrentTheme());
  const [collapsed, setCollapsed] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<string[]>([
    "Storefront",
    "Content",
    "Analytics",
    "System",
  ]);

  const adminUser = getAdminUser();
  const adminEmail = adminUser?.email ?? "admin@zavestro.in";
  // [SHL-3-6] Was `?? "admin"` — the legacy god-mode role. The cached user blob is
  // client-owned and written once at login, so deleting that one localStorage key
  // while keeping the token promoted any session to god-mode in the UI (measured:
  // a 3-capability `design` account went from 1 create verb to all 5, including
  // "New staff"). The backend refused everything, so this was a UI escalation, not
  // a privilege one — but it failed toward the exact role the RBAC model exists to
  // retire. A missing cache now means the LEAST privilege, not the most.
  const cachedRole = adminUser?.role ?? "pending";
  const adminInitial = adminEmail[0].toUpperCase();

  // Capabilities drive which nav sections show. Refresh from the server on mount
  // (covers page reloads + admins who logged in before this feature existed).
  //
  // [SHL-3-5]/[PEN-38-2] `capsLoaded` is the whole point of this state. The route
  // guard used to escape on `caps.length > 0` — added so a still-loading session
  // isn't bounced to a lock screen — but `pending` holds zero capabilities
  // PERMANENTLY, so the guard was structurally unreachable for exactly the role it
  // most needed to stop: a zero-cap account reached 24 of 24 consoles by URL.
  // "Still loading" and "genuinely zero" are now different states.
  const [caps, setCaps] = React.useState<string[]>(getAdminCapabilities());
  const [capsLoaded, setCapsLoaded] = React.useState(false);
  // [SHL-3-6]/[SHL-2-11] The authoritative role comes from the server, not from a
  // client-owned localStorage blob written once at login.
  const [serverRole, setServerRole] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    adminAuthExtApi
      .me()
      .then((me) => {
        if (alive) {
          setAdminCapabilities(me.capabilities ?? []);
          setCaps(me.capabilities ?? []);
          setServerRole(me.role);
          setCapsLoaded(true);
        }
      })
      .catch(() => {
        /* keep cached caps; the guard stays in its "not yet known" state */
      });
    return () => {
      alive = false;
    };
  }, []);
  // The server's answer wins the moment it arrives; the cache only covers the first
  // paint, and it can no longer name a role more powerful than the one you have.
  const adminRole = serverRole ?? cachedRole;

  // Nav badge counts (FABLE-ADMIN-UIUX §1.2) — "what needs me" per nav item.
  // Keyed by item path; the endpoint already returns only cap-allowed keys.
  const [navCounts, setNavCounts] = React.useState<NavCounts>({});
  React.useEffect(() => {
    let alive = true;
    const load = () =>
      navCountsApi.get().then((c) => { if (alive) setNavCounts(c); }).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const NAV_BADGE: Record<string, keyof NavCounts> = {
    "/admin/orders": "stuck_orders",
    "/admin/design/samples": "samples_review",
    "/admin/procurement/restock": "restock_pending",
    "/admin/procurement/stock": "below_reorder",
    "/admin/catalog/listings": "listings_oos",
    "/admin/finance/refunds": "refunds_awaiting",
    "/admin/finance/cod-reconciliation": "cod_unconfirmed",
    "/admin/support": "tickets_open",
    "/admin/returns": "returns_requested",
  };
  const badgeFor = (path: string): number | undefined => {
    const key = NAV_BADGE[path];
    const n = key ? navCounts[key] : undefined;
    return n && n > 0 ? n : undefined;
  };

  const canSee = (item: NavItem) =>
    !item.hidden &&
    (item.caps ? item.caps.some((c) => caps.includes(c)) : !item.cap || caps.includes(item.cap));
  // Legacy `admin` = unchanged god-mode (sees all). super_admin = oversight-only:
  // role-owned operating consoles (Design, Catalog) are hidden — super gets
  // read-only overviews instead. Other roles: capability-gated as usual.
  const canSeeSection = (section: NavSection) => {
    if (adminRole === "admin") return true;
    if (section.superOnly) return adminRole === "super_admin";
    if (adminRole === "super_admin" && section.roleOwned) return false;
    // super_admin (oversight): show a section if it holds the cap for ANY item in it;
    // the item-level `canSee` filter then shows only those. This is what lets super
    // SEE Finance's read-only Settlement/P&L (reports:read) while the refunds/promo
    // operating items (refunds:approve / pricing:write — which super lacks) stay hidden.
    if (adminRole === "super_admin") return section.items.some(canSee);
    return section.caps.some((c) => caps.includes(c));
  };
  const visibleSections = SECTIONS.filter(canSeeSection)
    .map((s) => ({ ...s, items: s.items.filter(canSee) }))
    .filter((s) => s.items.length > 0);

  // ⌘K command palette (FABLE-ADMIN-UIUX §1.2) — wires the top-bar search.
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false); // T3-1 (S-4): shortcuts help sheet
  React.useEffect(() => {
    // T3-1 (S-4): keyboard shortcuts. `g o`/`g d` jump, `/` opens the palette, `?` shows help.
    // Sequence keys (g→o/d) are tracked with a short-lived pending flag; letter shortcuts are
    // ignored while typing in a field so they never steal keystrokes.
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      const tag = el?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el?.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (gPending) {
        gPending = false;
        clearTimeout(gTimer);
        const k = e.key.toLowerCase();
        if (k === "o") { e.preventDefault(); navigate("/admin/orders"); }
        else if (k === "d") { e.preventDefault(); navigate("/admin/dashboard"); }
        return;
      }
      if (e.key === "g") { gPending = true; gTimer = setTimeout(() => { gPending = false; }, 1000); }
      else if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); }
      else if (e.key === "?") { e.preventDefault(); setHelpOpen((h) => !h); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(gTimer); };
  }, [navigate]);
  const navTargets: NavTarget[] = React.useMemo(
    () =>
      visibleSections.flatMap((s) =>
        s.items.map((it) => ({ label: it.label, path: it.path, section: s.title })),
      ),
    [visibleSections],
  );

  // T3-1 (S-1/S-3): cap-gated create verbs → palette actions + quick-create menu (legacy 'admin'
  // holds everything). Fabric jumps target the console the role can actually open.
  const hasCap = React.useCallback(
    (cap: string) => adminRole === "admin" || caps.includes(cap),
    [adminRole, caps],
  );
  const createTargets = React.useMemo(
    () => CREATE_ACTIONS.filter((a) => hasCap(a.cap)),
    [hasCap],
  );
  const createActions: PaletteAction[] = React.useMemo(
    () => createTargets.map((a) => ({ label: a.label, run: () => navigate(a.to) })),
    [createTargets, navigate],
  );
  const fabricBase = hasCap("distribution:write")
    ? "/admin/procurement/fabrics"
    : "/admin/design/fabrics";

  // T3-1 (S-3): quick-create (+) header menu open/close.
  const [createMenuOpen, setCreateMenuOpen] = React.useState(false);
  const createMenuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) setCreateMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // T3-1 (S-2): global hub-context switcher for hub-agnostic roles. Only meaningful with >1
  // hub (single-hub is livable), so the control hides itself until then.
  //
  // [SHL-3-8] This comment used to end "Pages read the selection via getAdminHubContext() as
  // their default hub filter". They did not — this file was the ONLY importer, and used it to
  // seed the switcher's own value, so picking a hub changed nothing anywhere and the comment
  // said otherwise. An operator switching to one hub and reading another hub's rows has been
  // told something false. The eight pages with a hub filter now take it from
  // `useHubContextFilter()`, which reads this selection and follows it as it changes.
  const hubAgnostic = ["super_admin", "finance", "procurement", "admin"].includes(adminRole);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubCtx, setHubCtx] = React.useState<string>(getAdminHubContext());
  React.useEffect(() => {
    if (hubAgnostic) hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
  }, [hubAgnostic]);

  // Route guard: block the content area if the current path needs a capability the
  // role lacks (deep-link protection). Backend also 403s the APIs.
  // LONGEST matching path wins, not the first declared. `/admin/support/call` is its
  // own nav item AND a child of `/admin/support`; with first-match the two entries'
  // capabilities were decided by declaration order, so widening one silently widened
  // the other. Most specific route wins is the only stable rule here.
  const currentNav = ALL_ITEMS.filter(
    (n) =>
      location.pathname === n.path ||
      location.pathname.startsWith(n.path + "/"),
  ).sort((a, b) => b.path.length - a.path.length)[0];
  // T3-9 (P-4): pages with no nav ancestor still need a cap guard, else a role without it
  // deep-links in and sees a broken 403-toast page instead of the access-denied screen.
  // (/admin/profile is intentionally cap-free — any admin may view their own profile.)
  // PATH_CAP wins over the nav ancestor: it is the more specific statement, and a
  // sub-page can need a capability its parent list does not (e.g. /admin/orders/qc).
  const requiredCaps =
    NAV_LESS_CAP.find((m) => location.pathname.startsWith(m.prefix))?.caps ??
    (currentNav ? NAV_CAP[currentNav.label] : undefined);
  // super_admin is oversight-only — deep-link into a role-owned console is blocked too.
  const superBlocked =
    adminRole === "super_admin" &&
    ROLE_OWNED_PATHS.some(
      (p) => location.pathname === p || location.pathname.startsWith(p + "/"),
    );
  // [SHL-3-5]/[PEN-38-2] Enforce once capabilities are KNOWN, not once they are
  // non-empty. `capsLoaded` is false only while `me()` is in flight (or has failed),
  // which is the case the old `caps.length > 0` clause was trying to cover — and
  // which it covered by also exempting every zero-capability account forever.
  const accessDenied =
    superBlocked ||
    (!!requiredCaps && capsLoaded && !requiredCaps.some((c) => caps.includes(c)));

  // T3-1 (S-6): don't let a logout silently eat unsaved form edits — confirm first.
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const doLogout = async () => {
    await adminAuth.logout();
    navigate("/admin/login", { replace: true });
  };
  const handleLogout = () => {
    if (hasUnsavedChanges()) {
      setShowLogoutConfirm(true);
      return;
    }
    void doLogout();
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label],
    );
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.path);
    const expanded = expandedSections.includes(item.label);
    if (item.children) {
      return (
        <div key={item.label} className={styles.navGroup}>
          <button
            className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
            onClick={() => !collapsed && toggleSection(item.label)}
            title={collapsed ? item.label : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && (
              <>
                <span className={styles.navLabel}>{item.label}</span>
                <span className={styles.navChevron}>
                  {expanded ? (
                    <UilAngleDown size={14} />
                  ) : (
                    <UilAngleRight size={14} />
                  )}
                </span>
              </>
            )}
          </button>
          {!collapsed && expanded && (
            <div className={styles.navChildren}>
              {item.children
                .filter((child) => !child.superOnly || adminRole === "super_admin")
                .map((child) => (
                <Link
                  key={child.path}
                  to={child.path}
                  className={`${styles.navChild} ${isActive(child.path) ? styles.navChildActive : ""}`}
                  aria-current={isActive(child.path) ? "page" : undefined}
                >
                  <span className={styles.navChildDot} />
                  {child.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }
    const badge = badgeFor(item.path);
    // [SHL-3-3] A destination is a LINK. This was a <button onClick={navigate()}> with no
    // href — a DOM probe of the sidebar found 0 anchors and 11 buttons — which removed the
    // affordances a multi-tab desk seat uses reflexively: ⌘-click / middle-click to open a
    // second tab (a support agent on a call cannot keep the order list open while opening a
    // customer), right-click → Copy link address, the hover URL preview, dragging to the
    // bookmarks bar. Assistive tech also announced "button", so the nav could not be
    // enumerated as the list of links it is. <Link> keeps the SPA navigation and adds all
    // of that back, and `aria-current` names the one you are on.
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
      >
        <span className={styles.navIcon}>{item.icon}</span>
        {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
        {badge !== undefined &&
          (collapsed ? (
            <span className={styles.navBadgeDot} aria-label={`${badge} need attention`} />
          ) : (
            <span className={styles.navBadge}>{badge > 99 ? "99+" : badge}</span>
          ))}
      </Link>
    );
  };

  return (
    <div className={`${styles.layout} ${collapsed ? styles.collapsed : ""}`}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div
            className={styles.brand}
            onClick={() => navigate("/admin/dashboard")}
          >
            {!collapsed ? (
              <>
                <span className={styles.brandName}>Zavestro</span>
                <span className={styles.adminBadge}>Admin</span>
              </>
            ) : (
              <span className={styles.brandIcon}>Z</span>
            )}
          </div>

          <nav className={styles.nav}>
            {renderItem(HOME)}
            {visibleSections.map((section) => (
              <div key={section.title} className={styles.navSection}>
                {!collapsed && (
                  <span className={styles.navSectionTitle}>
                    {section.title}
                  </span>
                )}
                {section.items.map(renderItem)}
              </div>
            ))}
          </nav>
        </div>

        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <UilAngleDoubleRight size={16} />
          ) : (
            <UilAngleDoubleLeft size={16} />
          )}
        </button>
      </aside>

      {/* Main area */}
      <div className={styles.main}>
        {/* [SHL-2-13 / SHL-2-2] The banner names the API THIS CONSOLE IS WRITING TO, not the
            build mode. It read `import.meta.env.MODE`, so a dev build pointed at the production
            API — which is exactly what a fresh clone used to produce — displayed "LOCAL DEV —
            not production" while every write landed on the live business. The banner was most
            reassuring precisely when it was most wrong.

            Two states now: a normal non-production build names its backend, and a
            non-production build attached to PRODUCTION says so, loudly, because that is the
            combination nothing else on screen distinguishes. */}
        {import.meta.env.MODE !== "production" && (
          isProductionApi() ? (
            <div className={`${styles.envBanner} ${styles.envBannerDanger}`}>
              ⚠ PRODUCTION API ({apiHost()}) — this is the live business. Writes are real.
            </div>
          ) : (
            <div className={styles.envBanner}>
              {import.meta.env.MODE === "development" ? "LOCAL DEV" : "STAGING"} — not production ·
              API: {apiHost()}
            </div>
          )
        )}
        {/* Top bar */}
        <header className={styles.topBar}>
          <div className={styles.breadcrumb}>
            {location.pathname
              .split("/")
              .filter(Boolean)
              .map((part, i, arr) => {
                const isLast = i === arr.length - 1;
                // Detect UUID-like segments (8-4-4-4-12 hex or 32 hex chars)
                const isUuid =
                  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(part) ||
                  /^[0-9a-f]{24,}$/i.test(part);
                let label: string;
                if (isUuid && entityTitle) {
                  label = entityTitle;
                } else if (isUuid) {
                  label = "…";
                } else {
                  label =
                    BREADCRUMB_SEGMENT_LABELS[part] ??
                    part.charAt(0).toUpperCase() +
                      part.slice(1).replace(/-/g, " ");
                }
                return (
                  <span key={i}>
                    <span
                      className={
                        isLast
                          ? styles.breadcrumbCurrent
                          : styles.breadcrumbLink
                      }
                      onClick={() =>
                        !isLast
                          ? navigate("/" + arr.slice(0, i + 1).join("/"))
                          : undefined
                      }
                    >
                      {label}
                    </span>
                    {!isLast && (
                      <span className={styles.breadcrumbSep}> / </span>
                    )}
                  </span>
                );
              })}
          </div>

          <button
            className={styles.topSearch}
            onClick={() => setPaletteOpen(true)}
            aria-label="Search or jump to a page (⌘K)"
          >
            <UilSearch size={16} className={styles.topSearchIcon} />
            <span className={styles.topSearchInput}>Search or type a command…</span>
            <span className={styles.topSearchKbd}>⌘K</span>
          </button>

          <div className={styles.topActions}>
            {/* T3-1 (S-2): global hub-context switcher (hub-agnostic roles, only with >1 hub). */}
            {hubAgnostic && hubs.length > 1 && (
              <select
                className={styles.hubSwitcher}
                value={hubCtx}
                onChange={(e) => { setHubCtx(e.target.value); setAdminHubContext(e.target.value); }}
                aria-label="Hub context"
                title="Hub context"
              >
                <option value="">All hubs</option>
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}

            {/* T3-1 (S-3): quick-create (+) menu — cap-gated create verbs. */}
            {createTargets.length > 0 && (
              <div className={styles.createMenu} ref={createMenuRef}>
                <button
                  className={styles.iconBtn}
                  onClick={() => setCreateMenuOpen((o) => !o)}
                  aria-label="Quick create"
                  title="Create…"
                >
                  <UilPlus size={18} />
                </button>
                {createMenuOpen && (
                  <div className={styles.createDropdown}>
                    {createTargets.map((a) => (
                      <button
                        key={a.label}
                        className={styles.createItem}
                        onClick={() => { setCreateMenuOpen(false); navigate(a.to); }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* T3-2 (W-U1) / S-4: help + shortcuts. */}
            <button
              className={styles.iconBtn}
              onClick={() => setHelpOpen((h) => !h)}
              aria-label="Help & shortcuts"
              title="Help & shortcuts (?)"
            >
              <UilQuestionCircle size={18} />
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => {
                toggleTheme();
                setTheme(getCurrentTheme());
              }}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <UilSun size={18} /> : <UilMoon size={18} />}
            </button>
            <NotificationBell />
            <div
              className={styles.adminUser}
              onClick={() => navigate("/admin/profile")}
              title="My Profile"
              style={{ cursor: "pointer" }}
            >
              <div className={styles.avatar}>{adminInitial}</div>
              {!collapsed && (
                <>
                  <span className={styles.adminName}>{adminEmail}</span>
                  <span
                    className={`${styles.roleBadge} ${adminRole === "super_admin" ? styles.roleBadgeSuperAdmin : ""}`}
                  >
                    {adminRole === "super_admin"
                      ? "Super Admin"
                      : adminRole.replace("_", " ")}
                  </span>
                </>
              )}
            </div>
            <button
              className={styles.logoutBtn}
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              <UilSignout size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className={styles.content}>
          <ErrorBoundary>
            {accessDenied ? (
              /* ACP-1 [KA9-1..KA9-7]: ONE refusal screen, and it NAMES the
                 capability. This was a hand-rolled block with the generic
                 "Your role doesn't have permission for this page" — the second of
                 the admin's two denial dialects. The orders list's
                 "Viewing this requires one of: orders:read" is the good version
                 and already existed; this promotes it everywhere. */
              <AccessDenied
                /* Wave 1's LIST: a page whose API admits two roles names both —
                   e.g. /admin/returns is orders:write OR refunds:approve. */
                requires={requiredCaps}
                what={currentNav ? `“${currentNav.label}”` : 'this section'}
                reason={
                  superBlocked
                    ? 'oversight-only'
                    : caps.length === 0
                      ? 'no-role'
                      : 'no-capability'
                }
              />
            ) : (
              // Suspense catches lazy route-chunk loads (G23); sidebar stays put.
              <Suspense
                fallback={
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: "64px",
                    }}
                  >
                    <Spinner />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            )}
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navTargets={navTargets}
        actions={createActions}
        canSearchOrders={hasCap("orders:read")}
        canSearchCustomers={hasCap("customers:read")}
        canSearchFabrics={hasCap("distribution:write") || hasCap("designs:write")}
        canSearchDesigns={hasCap("designs:write")}
        fabricBase={fabricBase}
      />

      {/* T3-1 (S-4): keyboard-shortcuts help sheet (opened with `?`). */}
      {helpOpen && (
        <div className={styles.helpOverlay} onClick={() => setHelpOpen(false)}>
          <div className={styles.helpSheet} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.helpTitle}>Keyboard shortcuts</h3>
            <ul className={styles.helpList}>
              <li><kbd>⌘</kbd> <kbd>K</kbd> — command palette</li>
              <li><kbd>/</kbd> — search</li>
              <li><kbd>g</kbd> then <kbd>o</kbd> — go to Orders</li>
              <li><kbd>g</kbd> then <kbd>d</kbd> — go to Dashboard</li>
              <li><kbd>?</kbd> — this help</li>
              <li><kbd>esc</kbd> — close</li>
            </ul>
            {/* T3-2 (W-U1): link into the per-console help page. */}
            <button
              className={styles.helpConsoleLink}
              onClick={() => { setHelpOpen(false); navigate("/admin/help"); }}
            >
              How this console works →
            </button>
            <button className={styles.helpClose} onClick={() => setHelpOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* T3-1 (S-6): confirm before a logout drops unsaved edits. */}
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Unsaved changes"
        message="You have unsaved edits open. Log out anyway? Your changes will be lost."
        confirmLabel="Log out"
        variant="danger"
        onConfirm={() => { setShowLogoutConfirm(false); void doLogout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};

export const AdminLayout: React.FC = () => {
  if (!hasAdminToken()) {
    return <Navigate to="/admin/login" replace />;
  }
  return (
    <BreadcrumbProvider>
      <AdminLayoutInner />
    </BreadcrumbProvider>
  );
};

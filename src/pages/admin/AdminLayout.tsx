import React, { Suspense } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { toggleTheme, getCurrentTheme } from '../../utils/theme';
import { hasAdminToken } from '../../api/catalogApi';
import { adminAuth, getAdminUser, getAdminCapabilities, setAdminCapabilities, adminAuthExtApi } from '../../api/adminApi';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import { Spinner } from '../../components/Spinner';
import { BreadcrumbProvider, useBreadcrumb } from '../../contexts/BreadcrumbContext';
import styles from './AdminLayout.module.css';
import { UilAngleDoubleLeft, UilAngleDoubleRight, UilAngleDown, UilAngleRight, UilBuilding, UilChartBar, UilCheckCircle, UilDashboard, UilFileAlt, UilHeadphones, UilHistory, UilLayerGroup, UilMapMarker, UilMegaphone, UilMoon, UilProcess, UilReceipt, UilRuler, UilSearch, UilSetting, UilShoppingBag, UilSignout, UilStar, UilSun, UilTag, UilTicket, UilUsersAlt, UilWallet } from "@iconscout/react-unicons";

// Role-scoped navigation (CATALOG-DARKSTORE-ARCHITECTURE §11–18): the sidebar is
// grouped into capability-gated WORKSPACES, not a flat list. A role sees only the
// sections whose capability it holds — e.g. `design` sees only the Design console;
// `super_admin` (all caps) sees everything. Item-level `cap` gates within a section.
interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  cap?: string;
  children?: { label: string; path: string }[];
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
const HOME: NavItem = { label: 'Dashboard', icon: <UilDashboard size={18} />, path: '/admin/dashboard' };

const SECTIONS: NavSection[] = [
  {
    title: 'Overviews',
    caps: ['reports:read'],
    superOnly: true,
    items: [
      { label: 'Design Overview', icon: <UilLayerGroup size={18} />, path: '/admin/oversight/designs', cap: 'reports:read' },
      { label: 'Listings Overview', icon: <UilTag size={18} />, path: '/admin/oversight/listings', cap: 'reports:read' },
    ],
  },
  {
    title: 'Design',
    caps: ['designs:write'],
    roleOwned: true,
    items: [
      { label: 'Design Library', icon: <UilLayerGroup size={18} />, path: '/admin/design/library', cap: 'designs:write' },
      { label: 'Garment Types', icon: <UilRuler size={18} />, path: '/admin/system/garment-types', cap: 'designs:write' },
      { label: 'Sample Review', icon: <UilCheckCircle size={18} />, path: '/admin/design/samples', cap: 'samples:write' },
    ],
  },
  {
    title: 'Catalog · storefront',
    caps: ['catalog:write', 'cms:write'],
    roleOwned: true,
    items: [
      {
        label: 'Catalog', icon: <UilTag size={18} />, path: '/admin/catalog', cap: 'catalog:write',
        children: [
          { label: 'Products', path: '/admin/catalog/products' },
          { label: 'Collections', path: '/admin/catalog/collections' },
          { label: 'Hero Banners', path: '/admin/catalog/banners' },
          { label: 'Categories', path: '/admin/catalog/categories' },
          { label: 'Home Layout', path: '/admin/catalog/home-layout' },
        ],
      },
      {
        label: 'Content', icon: <UilFileAlt size={18} />, path: '/admin/content', cap: 'cms:write',
        children: [
          { label: 'Lookbook', path: '/admin/content/lookbook' },
          { label: 'Craftspeople', path: '/admin/content/craftspeople' },
          { label: 'Stories', path: '/admin/content/stories' },
          { label: 'Journal', path: '/admin/content/journal' },
        ],
      },
    ],
  },
  {
    title: 'Orders & support',
    caps: ['orders:read', 'orders:write', 'customers:read', 'reviews:moderate'],
    items: [
      { label: 'Orders', icon: <UilShoppingBag size={18} />, path: '/admin/orders', cap: 'orders:read' },
      { label: 'Customers', icon: <UilUsersAlt size={18} />, path: '/admin/users', cap: 'customers:read' },
      { label: 'Returns', icon: <UilHistory size={18} />, path: '/admin/returns', cap: 'orders:write' },
      { label: 'Alterations', icon: <UilProcess size={18} />, path: '/admin/alterations', cap: 'orders:write' },
      { label: 'Support', icon: <UilHeadphones size={18} />, path: '/admin/support', cap: 'customers:write' },
      { label: 'Reviews', icon: <UilStar size={18} />, path: '/admin/reviews', cap: 'reviews:moderate' },
    ],
  },
  {
    title: 'Finance',
    caps: ['refunds:approve', 'pricing:write'],
    items: [
      { label: 'Invoices', icon: <UilReceipt size={18} />, path: '/admin/invoices', cap: 'refunds:approve' },
      { label: 'COD Reconciliation', icon: <UilWallet size={18} />, path: '/admin/finance/cod-reconciliation', cap: 'refunds:approve' },
      { label: 'Promo Codes', icon: <UilTicket size={18} />, path: '/admin/promo-codes', cap: 'pricing:write' },
      { label: 'Pincode Demand', icon: <UilMapMarker size={18} />, path: '/admin/pincode-waitlist', cap: 'reports:read' },
    ],
  },
  {
    title: 'Oversight · system',
    caps: ['system:manage'],
    items: [
      { label: 'Hubs', icon: <UilBuilding size={18} />, path: '/admin/hubs', cap: 'system:manage' },
      {
        label: 'Analytics', icon: <UilChartBar size={18} />, path: '/admin/analytics', cap: 'reports:read',
        children: [
          { label: 'Revenue', path: '/admin/analytics/revenue' },
          { label: 'Orders', path: '/admin/analytics/orders' },
          { label: 'Fit Scores', path: '/admin/analytics/fit-scores' },
          { label: 'Hub Performance', path: '/admin/analytics/hub-performance' },
          { label: 'Retention', path: '/admin/analytics/retention' },
        ],
      },
      { label: 'Notification Blast', icon: <UilMegaphone size={18} />, path: '/admin/notifications', cap: 'cms:write' },
      {
        label: 'System', icon: <UilSetting size={18} />, path: '/admin/system', cap: 'system:manage',
        children: [
          { label: 'App Config', path: '/admin/system/app-config' },
          { label: 'Audit Log', path: '/admin/system/audit-log' },
          { label: 'Admin Users', path: '/admin/system/admin-users' },
          { label: 'Service Areas', path: '/admin/system/service-areas' },
        ],
      },
    ],
  },
];

// Flat label→cap map (for the deep-link route guard), derived from SECTIONS + HOME.
const NAV_CAP: Record<string, string | undefined> = Object.fromEntries([
  [HOME.label, undefined],
  ...SECTIONS.flatMap((s) => s.items.map((it) => [it.label, it.cap])),
]);
const ALL_ITEMS: NavItem[] = [HOME, ...SECTIONS.flatMap((s) => s.items)];
// Paths inside role-owned operating consoles (Design, Catalog) — deep-link-blocked for super_admin.
const ROLE_OWNED_PATHS: string[] = SECTIONS.filter(s => s.roleOwned).flatMap(s => s.items.map(it => it.path));

// Inner component rendered inside BreadcrumbProvider so useBreadcrumb() reads
// the correct context value (entity titles set by detail pages).
const AdminLayoutInner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { title: entityTitle } = useBreadcrumb();
  const [theme, setTheme] = React.useState(getCurrentTheme());
  const [collapsed, setCollapsed] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['Catalog', 'Content', 'Analytics', 'System', 'Consultations']);

  const adminUser = getAdminUser();
  const adminEmail = adminUser?.email ?? 'admin@zavestro.in';
  const adminRole = adminUser?.role ?? 'admin';
  const adminInitial = adminEmail[0].toUpperCase();

  // Capabilities drive which nav sections show. Refresh from the server on mount
  // (covers page reloads + admins who logged in before this feature existed).
  const [caps, setCaps] = React.useState<string[]>(getAdminCapabilities());
  React.useEffect(() => {
    let alive = true;
    adminAuthExtApi.me()
      .then(me => { if (alive) { setAdminCapabilities(me.capabilities ?? []); setCaps(me.capabilities ?? []); } })
      .catch(() => { /* keep cached caps */ });
    return () => { alive = false; };
  }, []);

  const canSee = (item: NavItem) => !item.cap || caps.includes(item.cap);
  // Legacy `admin` = unchanged god-mode (sees all). super_admin = oversight-only:
  // role-owned operating consoles (Design, Catalog) are hidden — super gets
  // read-only overviews instead. Other roles: capability-gated as usual.
  const canSeeSection = (section: NavSection) => {
    if (adminRole === 'admin') return true;
    if (section.superOnly) return adminRole === 'super_admin';
    if (adminRole === 'super_admin' && section.roleOwned) return false;
    return section.caps.some(c => caps.includes(c));
  };
  const visibleSections = SECTIONS
    .filter(canSeeSection)
    .map(s => ({ ...s, items: s.items.filter(canSee) }))
    .filter(s => s.items.length > 0);

  // Route guard: block the content area if the current path needs a capability the
  // role lacks (deep-link protection). Only enforce once caps are known (non-empty)
  // so a still-loading session isn't bounced. Backend also 403s the APIs.
  const currentNav = ALL_ITEMS.find(n => location.pathname === n.path || location.pathname.startsWith(n.path + '/'));
  const requiredCap = currentNav ? NAV_CAP[currentNav.label] : undefined;
  // super_admin is oversight-only — deep-link into a role-owned console is blocked too.
  const superBlocked =
    adminRole === 'super_admin' &&
    ROLE_OWNED_PATHS.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
  const accessDenied = superBlocked || (!!requiredCap && caps.length > 0 && !caps.includes(requiredCap));

  const handleLogout = async () => {
    await adminAuth.logout();
    navigate('/admin/login', { replace: true });
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const toggleSection = (label: string) => {
    setExpandedSections(prev =>
      prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]
    );
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.path);
    const expanded = expandedSections.includes(item.label);
    if (item.children) {
      return (
        <div key={item.label} className={styles.navGroup}>
          <button
            className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
            onClick={() => !collapsed && toggleSection(item.label)}
            title={collapsed ? item.label : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && (
              <>
                <span className={styles.navLabel}>{item.label}</span>
                <span className={styles.navChevron}>
                  {expanded ? <UilAngleDown size={14} /> : <UilAngleRight size={14} />}
                </span>
              </>
            )}
          </button>
          {!collapsed && expanded && (
            <div className={styles.navChildren}>
              {item.children.map(child => (
                <button
                  key={child.path}
                  className={`${styles.navChild} ${isActive(child.path) ? styles.navChildActive : ''}`}
                  onClick={() => navigate(child.path)}
                >
                  <span className={styles.navChildDot} />
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <button
        key={item.path}
        className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
        onClick={() => navigate(item.path)}
        title={collapsed ? item.label : undefined}
      >
        <span className={styles.navIcon}>{item.icon}</span>
        {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
      </button>
    );
  };

  return (
    <div className={`${styles.layout} ${collapsed ? styles.collapsed : ''}`}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brand} onClick={() => navigate('/admin/dashboard')}>
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
            {visibleSections.map(section => (
              <div key={section.title} className={styles.navSection}>
                {!collapsed && <span className={styles.navSectionTitle}>{section.title}</span>}
                {section.items.map(renderItem)}
              </div>
            ))}
          </nav>
        </div>

        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <UilAngleDoubleRight size={16} /> : <UilAngleDoubleLeft size={16} />}
        </button>
      </aside>

      {/* Main area */}
      <div className={styles.main}>
        {/* Top bar */}
        <header className={styles.topBar}>
          <div className={styles.breadcrumb}>
            {location.pathname.split('/').filter(Boolean).map((part, i, arr) => {
              const isLast = i === arr.length - 1;
              // Detect UUID-like segments (8-4-4-4-12 hex or 32 hex chars)
              const isUuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(part)
                          || /^[0-9a-f]{24,}$/i.test(part);
              let label: string;
              if (isUuid && entityTitle) {
                label = entityTitle;
              } else if (isUuid) {
                label = '…';
              } else {
                label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
              }
              return (
                <span key={i}>
                  <span
                    className={isLast ? styles.breadcrumbCurrent : styles.breadcrumbLink}
                    onClick={() => !isLast ? navigate('/' + arr.slice(0, i + 1).join('/')) : undefined}
                  >
                    {label}
                  </span>
                  {!isLast && <span className={styles.breadcrumbSep}> / </span>}
                </span>
              );
            })}
          </div>

          <div className={styles.topSearch}>
            <UilSearch size={16} className={styles.topSearchIcon} />
            <input className={styles.topSearchInput} placeholder="Search or type a command…" aria-label="Search" />
            <span className={styles.topSearchKbd}>⌘K</span>
          </div>

          <div className={styles.topActions}>
            <button
              className={styles.iconBtn}
              onClick={() => { toggleTheme(); setTheme(getCurrentTheme()); }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <UilSun size={18} /> : <UilMoon size={18} />}
            </button>
            {/* Notification bell removed — there is no admin notification feed yet, and a
                dead "coming soon" control is worse than none. Re-add when a real feed exists. */}
            <div
              className={styles.adminUser}
              onClick={() => navigate('/admin/profile')}
              title="My Profile"
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.avatar}>{adminInitial}</div>
              {!collapsed && (
                <>
                  <span className={styles.adminName}>{adminEmail}</span>
                  <span className={`${styles.roleBadge} ${adminRole === 'super_admin' ? styles.roleBadgeSuperAdmin : ''}`}>
                    {adminRole === 'super_admin' ? 'Super Admin' : adminRole.replace('_', ' ')}
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
              <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
                <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>No access to this section</h2>
                <p style={{ color: 'var(--text-muted, #888)', fontSize: 14, marginBottom: 20 }}>
                  Your role doesn’t have permission for this page. Contact a Super Admin if you need access.
                </p>
                <button className={styles.navItem} style={{ display: 'inline-flex', width: 'auto', padding: '8px 18px' }}
                  onClick={() => navigate('/admin/dashboard')}>
                  Go to Dashboard
                </button>
              </div>
            ) : (
              // Suspense catches lazy route-chunk loads (G23); sidebar stays put.
              <Suspense
                fallback={
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
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

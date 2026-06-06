import React, { Suspense } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { toggleTheme, getCurrentTheme } from '../../utils/theme';
import { hasAdminToken } from '../../api/catalogApi';
import { adminAuth, getAdminUser, getAdminCapabilities, setAdminCapabilities, adminAuthExtApi } from '../../api/adminApi';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import { Spinner } from '../../components/Spinner';
import { BreadcrumbProvider, useBreadcrumb } from '../../contexts/BreadcrumbContext';
import styles from './AdminLayout.module.css';
import { UilAngleDoubleLeft, UilAngleDoubleRight, UilAngleDown, UilAngleRight, UilBuilding, UilChartBar, UilDashboard, UilEstate, UilFileAlt, UilHeadphones, UilHistory, UilMapMarker, UilMegaphone, UilMoon, UilProcess, UilReceipt, UilRuler, UilSearch, UilSetting, UilShoppingBag, UilSignout, UilStar, UilSun, UilTag, UilTicket, UilUsersAlt, UilWallet } from "@iconscout/react-unicons";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  children?: { label: string; path: string }[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard',  icon: <UilDashboard size={18} />, path: '/admin/dashboard', roles: ['admin', 'admin_finance', 'admin_ops'] },
  { label: 'Orders',     icon: <UilShoppingBag size={18} />,     path: '/admin/orders',    roles: ['admin', 'admin_support'] },
  { label: 'Users',      icon: <UilUsersAlt size={18} />,           path: '/admin/users',     roles: ['admin', 'admin_support'] },
  { label: 'Hubs',       icon: <UilBuilding size={18} />,       path: '/admin/hubs',      roles: ['admin', 'admin_ops'] },
  {
    label: 'Catalog', icon: <UilTag size={18} />, path: '/admin/catalog', roles: ['admin', 'admin_catalog'],
    children: [
      { label: 'Products',            path: '/admin/catalog/products' },
      { label: 'Collections',         path: '/admin/catalog/collections' },
      { label: 'Hero Banners',        path: '/admin/catalog/banners' },
      { label: 'Categories',          path: '/admin/catalog/categories' },
      { label: 'Home Layout',         path: '/admin/catalog/home-layout' },
    ],
  },
  {
    label: 'Content', icon: <UilFileAlt size={18} />, path: '/admin/content', roles: ['admin', 'admin_catalog'],
    children: [
      { label: 'Lookbook',       path: '/admin/content/lookbook' },
      { label: 'Craftspeople',   path: '/admin/content/craftspeople' },
      { label: 'Stories',        path: '/admin/content/stories' },
      { label: 'Journal',        path: '/admin/content/journal' },
    ],
  },
  {
    label: 'Analytics', icon: <UilChartBar size={18} />, path: '/admin/analytics', roles: ['admin', 'admin_finance'],
    children: [
      { label: 'Revenue',          path: '/admin/analytics/revenue' },
      { label: 'Orders',           path: '/admin/analytics/orders' },
      { label: 'Fit Scores',       path: '/admin/analytics/fit-scores' },
      { label: 'Hub Performance',  path: '/admin/analytics/hub-performance' },
      { label: 'Retention',        path: '/admin/analytics/retention' },
    ],
  },
  { label: 'Promo Codes', icon: <UilTicket size={18} />, path: '/admin/promo-codes', roles: ['admin', 'admin_marketing'] },
  { label: 'Support',     icon: <UilHeadphones size={18} />,  path: '/admin/support',      roles: ['admin', 'admin_support'] },
  { label: 'Returns',     icon: <UilHistory size={18} />,   path: '/admin/returns',      roles: ['admin', 'admin_ops'] },
  { label: 'Alterations', icon: <UilProcess size={18} />,    path: '/admin/alterations',  roles: ['admin', 'admin_ops'] },
  { label: 'Reviews',     icon: <UilStar size={18} />,        path: '/admin/reviews',       roles: ['admin', 'admin_ops'] },
  { label: 'Home Visits', icon: <UilEstate size={18} />,        path: '/admin/home-visits',           roles: ['admin', 'admin_ops'] },
  // Consultations belonged to the scrapped Premium Custom flow — hidden from nav (route still exists).
  { label: 'Measurements', icon: <UilRuler size={18} />,     path: '/admin/measurement-bookings',  roles: ['admin', 'admin_ops'] },
  { label: 'Invoices',    icon: <UilReceipt size={18} />,     path: '/admin/invoices',              roles: ['admin', 'admin_finance'] },
  { label: 'COD Reconciliation', icon: <UilWallet size={18} />, path: '/admin/finance/cod-reconciliation', roles: ['admin', 'admin_finance'] },
  { label: 'Notification Blast', icon: <UilMegaphone size={18} />, path: '/admin/notifications',     roles: ['admin', 'admin_marketing'] },
  { label: 'Pincode Demand', icon: <UilMapMarker size={18} />,    path: '/admin/pincode-waitlist',      roles: ['admin', 'admin_finance'] },
  {
    label: 'System', icon: <UilSetting size={18} />, path: '/admin/system', roles: ['admin', 'admin_ops', 'admin_finance'],
    children: [
      { label: 'App Config',     path: '/admin/system/app-config' },
      { label: 'Audit Log',      path: '/admin/system/audit-log' },
      { label: 'Waitlist',       path: '/admin/system/waitlist' },
      { label: 'Admin Users',    path: '/admin/system/admin-users' },
      { label: 'Service Areas',  path: '/admin/system/service-areas' },
      { label: 'Garment Types',  path: '/admin/system/garment-types' },
    ],
  },
];

// Capability required to see each top-level nav section (super_admin holds all).
// Drives the role-based sidebar — see backend src/admin/auth/permissions.ts.
const NAV_CAP: Record<string, string | undefined> = {
  'Dashboard':    undefined,            // everyone signed in
  'Orders':       'orders:read',
  'Users':        'customers:read',
  'Hubs':         'system:manage',
  'Catalog':      'catalog:write',
  'Content':      'cms:write',
  'Analytics':    'reports:read',
  'Promo Codes':  'pricing:write',
  'Support':      'customers:write',
  'Returns':      'orders:write',
  'Alterations':  'orders:write',
  'Reviews':      'reviews:moderate',
  'Home Visits':  'orders:write',
  'Measurements': 'orders:write',
  'Invoices':     'refunds:approve',
  'COD Reconciliation': 'refunds:approve',
  'Consultations': 'orders:write',
  'Notification Blast': 'cms:write',
  'Pincode Demand': 'reports:read',
  'System':       'system:manage',
};

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

  const canSee = (label: string) => { const c = NAV_CAP[label]; return !c || caps.includes(c); };
  const visibleNav = NAV.filter(item => canSee(item.label));

  // Route guard: block the content area if the current path needs a capability the
  // role lacks (deep-link protection). Only enforce once caps are known (non-empty)
  // so a still-loading session isn't bounced. Backend also 403s the APIs.
  const currentNav = NAV.find(n => location.pathname === n.path || location.pathname.startsWith(n.path + '/'));
  const requiredCap = currentNav ? NAV_CAP[currentNav.label] : undefined;
  const accessDenied = !!requiredCap && caps.length > 0 && !caps.includes(requiredCap);

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
            {visibleNav.map(item => {
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
            })}
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

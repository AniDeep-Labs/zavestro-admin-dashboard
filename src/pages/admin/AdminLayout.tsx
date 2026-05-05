import React from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Users, Building2, Tag, FileText,
  BarChart3, Headphones, Settings, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Sun, Moon, LogOut, Bell,
  RotateCcw, Scissors, Home, Receipt,
} from 'lucide-react';
import { toggleTheme, getCurrentTheme } from '../../utils/theme';
import { hasAdminToken } from '../../api/catalogApi';
import { adminAuth, getAdminUser } from '../../api/adminApi';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import styles from './AdminLayout.module.css';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  children?: { label: string; path: string }[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard',  icon: <LayoutDashboard size={18} />, path: '/admin/dashboard', roles: ['admin', 'admin_finance', 'admin_ops'] },
  { label: 'Orders',     icon: <ShoppingBag size={18} />,     path: '/admin/orders',    roles: ['admin', 'admin_support'] },
  { label: 'Users',      icon: <Users size={18} />,           path: '/admin/users',     roles: ['admin', 'admin_support'] },
  { label: 'Hubs',       icon: <Building2 size={18} />,       path: '/admin/hubs',      roles: ['admin', 'admin_ops'] },
  {
    label: 'Catalog', icon: <Tag size={18} />, path: '/admin/catalog', roles: ['admin', 'admin_catalog'],
    children: [
      { label: 'Products',            path: '/admin/catalog/products' },
      { label: 'Collections',         path: '/admin/catalog/collections' },
    ],
  },
  {
    label: 'Content', icon: <FileText size={18} />, path: '/admin/content', roles: ['admin', 'admin_catalog'],
    children: [
      { label: 'Lookbook',       path: '/admin/content/lookbook' },
      { label: 'Craftspeople',   path: '/admin/content/craftspeople' },
      { label: 'Stories',        path: '/admin/content/stories' },
      { label: 'Journal',        path: '/admin/content/journal' },
    ],
  },
  {
    label: 'Analytics', icon: <BarChart3 size={18} />, path: '/admin/analytics', roles: ['admin', 'admin_finance'],
    children: [
      { label: 'Revenue',          path: '/admin/analytics/revenue' },
      { label: 'Orders',           path: '/admin/analytics/orders' },
      { label: 'Fit Scores',       path: '/admin/analytics/fit-scores' },
      { label: 'Hub Performance',  path: '/admin/analytics/hubs' },
      { label: 'Retention',        path: '/admin/analytics/retention' },
      { label: 'Promo Codes',      path: '/admin/analytics/promos' },
    ],
  },
  { label: 'Support',     icon: <Headphones size={18} />,  path: '/admin/support',      roles: ['admin', 'admin_support'] },
  { label: 'Returns',     icon: <RotateCcw size={18} />,   path: '/admin/returns',      roles: ['admin', 'admin_ops'] },
  { label: 'Alterations', icon: <Scissors size={18} />,    path: '/admin/alterations',  roles: ['admin', 'admin_ops'] },
  { label: 'Home Visits', icon: <Home size={18} />,        path: '/admin/home-visits',  roles: ['admin', 'admin_ops'] },
  { label: 'Invoices',    icon: <Receipt size={18} />,     path: '/admin/invoices',     roles: ['admin', 'admin_finance'] },
  {
    label: 'System', icon: <Settings size={18} />, path: '/admin/system', roles: ['admin', 'admin_ops', 'admin_finance'],
    children: [
      { label: 'App Config',   path: '/admin/system/config' },
      { label: 'Audit Log',    path: '/admin/system/audit' },
      { label: 'Waitlist',     path: '/admin/system/waitlist' },
      { label: 'Admin Users',  path: '/admin/system/admins' },
    ],
  },
];

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = React.useState(getCurrentTheme());
  const [collapsed, setCollapsed] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['Catalog', 'Content', 'Analytics', 'System', 'Consultations']);

  if (!hasAdminToken()) {
    return <Navigate to="/admin/login" replace />;
  }

  const adminUser = getAdminUser();
  const adminEmail = adminUser?.email ?? 'admin@zavestro.in';
  const adminRole = adminUser?.role ?? 'admin';
  const adminInitial = adminEmail[0].toUpperCase();

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
            {NAV.map(item => {
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
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </aside>

      {/* Main area */}
      <div className={styles.main}>
        {/* Top bar */}
        <header className={styles.topBar}>
          <div className={styles.breadcrumb}>
            {location.pathname.split('/').filter(Boolean).map((part, i, arr) => (
              <span key={i}>
                <span
                  className={i < arr.length - 1 ? styles.breadcrumbLink : styles.breadcrumbCurrent}
                  onClick={() => i < arr.length - 1 ? navigate('/' + arr.slice(0, i + 1).join('/')) : undefined}
                >
                  {part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ')}
                </span>
                {i < arr.length - 1 && <span className={styles.breadcrumbSep}> / </span>}
              </span>
            ))}
          </div>

          <div className={styles.topActions}>
            <button
              className={styles.iconBtn}
              onClick={() => { toggleTheme(); setTheme(getCurrentTheme()); }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className={styles.iconBtn} aria-label="Notifications">
              <Bell size={18} />
            </button>
            <div className={styles.adminUser}>
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
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className={styles.content}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

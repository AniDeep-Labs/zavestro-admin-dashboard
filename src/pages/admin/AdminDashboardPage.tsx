import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UilSync, UilTruck, UilRuler, UilCheckCircle, UilReceipt, UilBox, UilExclamationTriangle, UilShoppingBag, UilHistory, UilProcess } from '@iconscout/react-unicons';
import { dashboardApi, hasCapability } from '../../api/adminApi';
import type { DashboardData } from '../../api/adminApi';
import { clearAdminToken } from '../../api/catalogApi';
import { Sparkline, AreaTrendChart, BarMini, STAGE_COLORS, fmtINRShort } from '../../components/charts/Charts';
import { ActionInbox } from '../../components/ActionInbox';
import styles from './AdminDashboardPage.module.css';

/* ── Inline SVG icons (Lucide-style) ── */
const Icons = {
  Package: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  ),
  Activity: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  IndianRupee: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Headphones: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>
    </svg>
  ),
  UserPlus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>
    </svg>
  ),
  ClipboardList: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
    </svg>
  ),
  TrendUp: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  TrendDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  AlertTriangle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  ),
  Tag: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
    </svg>
  ),
  CreditCard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  ),
};

type IconKey = keyof typeof Icons;

const PERIOD_MAP: Record<string, string> = {
  'Today': 'today', 'This Week': 'week', 'This Month': 'month',
  'Last 30 Days': 'last30', 'This Quarter': 'quarter',
};

type Accent = 'Emerald' | 'Amber' | 'Red' | 'Gold';

// `cap` gates each KPI to the roles that should see it (undefined = everyone).
const kpis: { label: string; key: string; format: (v: number) => string; icon: IconKey; accent: Accent; navPath: string; cap?: string }[] = [
  { label: 'Total Orders',     key: 'totalOrders',     format: v => v.toLocaleString(),                   icon: 'Package',       accent: 'Emerald', navPath: '/admin/orders', cap: 'orders:read' },
  { label: 'Active Orders',    key: 'activeOrders',    format: v => v.toLocaleString(),                   icon: 'Activity',      accent: 'Emerald', navPath: '/admin/orders?view=stuck', cap: 'orders:read' },
  { label: 'GMV',              key: 'gmv',             format: v => '₹' + (v / 100000).toFixed(1) + 'L', icon: 'IndianRupee',   accent: 'Emerald', navPath: '/admin/analytics/revenue', cap: 'reports:read' },
  { label: 'Pending Payments', key: 'pendingPayments', format: v => v.toLocaleString(),                   icon: 'Clock',         accent: 'Amber',   navPath: '/admin/orders?stage=pending_payment', cap: 'orders:read' },
  { label: 'Open Tickets',     key: 'openTickets',     format: v => v.toLocaleString(),                   icon: 'Headphones',    accent: 'Red',     navPath: '/admin/support', cap: 'customers:write' },
  { label: 'New Customers',    key: 'newCustomers',    format: v => v.toLocaleString(),                   icon: 'UserPlus',      accent: 'Emerald', navPath: '/admin/users', cap: 'customers:read' },
];

// Each dashboard card section → the capability that should see it.
const CARD_CAP = {
  pipeline: 'orders:read', hubPerf: 'reports:read',
  support: 'customers:write', revenue: 'reports:read',
} as const;

// Infer a meaningful, colour-coded icon for each activity from its text.
type ActivityIconFC = React.FC<{ size?: number }>;
const ACTIVITY_VISUAL: { re: RegExp; Icon: ActivityIconFC; tint: string }[] = [
  { re: /deliver/i,                    Icon: UilTruck,               tint: 'avEmerald' },
  { re: /\bqc\b|quality/i,             Icon: UilCheckCircle,         tint: 'avEmerald' },
  { re: /cash|cod|paid|payment|refund/i, Icon: UilReceipt,           tint: 'avGold' },
  { re: /dispatch|courier|ship|track/i, Icon: UilTruck,              tint: 'avBlue' },
  { re: /measure/i,                    Icon: UilRuler,               tint: 'avPurple' },
  { re: /fabric|sourc/i,               Icon: UilBox,                 tint: 'avGold' },
  { re: /alterat|stitch|re-?delivery/i, Icon: UilProcess,            tint: 'avAmber' },
  { re: /seam|defect|fail|reject|cancel/i, Icon: UilExclamationTriangle, tint: 'avRed' },
  { re: /order|placed|created|confirm/i, Icon: UilShoppingBag,       tint: 'avEmerald' },
];
function activityVisual(text: string): { Icon: ActivityIconFC; tint: string } {
  return ACTIVITY_VISUAL.find(v => v.re.test(text)) ?? { Icon: UilHistory, tint: 'avNeutral' };
}

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = React.useState('This Month');
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [apiErrorStatus, setApiErrorStatus] = React.useState<number | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const refresh = React.useCallback(() => setRefreshTick(t => t + 1), []);

  const revenueTotal = React.useMemo(
    () => (data?.revenue ?? []).reduce((sum, r) => sum + (r.simplified || 0), 0),
    [data],
  );
  const aov = React.useMemo(() => {
    const orders = (data?.stats?.totalOrders?.value as number) ?? 0;
    return orders > 0 ? Math.round(revenueTotal / orders) : 0;
  }, [data, revenueTotal]);
  const avgQc = React.useMemo(() => {
    const hubs = data?.hubPerformance ?? [];
    return hubs.length ? Math.round(hubs.reduce((s, h) => s + (h.qcPassRate || 0), 0) / hubs.length) : 0;
  }, [data]);
  const funnelData = React.useMemo(
    () => (data?.ordersByStage ?? []).map(s => ({ name: s.label, count: s.count })),
    [data],
  );
  const funnelColors = React.useMemo(
    () => (data?.ordersByStage ?? []).map((_, i) => STAGE_COLORS[i % STAGE_COLORS.length]),
    [data],
  );
  const hubData = React.useMemo(
    () => (data?.hubPerformance ?? []).map(h => ({ name: h.name, capacity: h.capacity })),
    [data],
  );
  const [perfTab, setPerfTab] = React.useState<'Revenue' | 'Hubs'>('Revenue');

  const visibleKpis = React.useMemo(
    () => kpis.filter(k => !k.cap || hasCapability(k.cap)),
    [],
  );

  // One metric cell inside the unified instrument panel: label + tinted icon,
  // big number with an inline coloured delta, and a quiet sparkline.
  const renderMetricCell = (kpi: (typeof kpis)[number]) => {
    const stat = data?.stats[kpi.key];
    // P-5 (T3-8): only a REAL series — no fabricated fallback. Point-in-time KPIs
    // (active orders, pending payments, open tickets) have no daily series → no sparkline.
    const sparks = data?.sparklines?.[kpi.key];
    const isUp = stat ? stat.up : true;
    const KpiIcon = Icons[kpi.icon];
    const iconTint = (styles as Record<string, string>)[`iconTint${kpi.accent}`];
    return (
      <div
        key={kpi.key}
        className={`${styles.metricCell} ${loading ? styles.kpiCardLoading : ''}`}
        onClick={() => navigate(kpi.navPath)}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && navigate(kpi.navPath)}
      >
        <div className={styles.metricTop}>
          <span className={styles.metricLabel}>{kpi.label}</span>
          <span className={`${styles.metricIcon} ${iconTint ?? ''}`}><KpiIcon /></span>
        </div>
        <div className={styles.metricValueRow}>
          <span className={styles.metricValue}>{kpi.format(stat?.value ?? 0)}</span>
          {stat && stat.trend && (
            <span className={`${styles.metricDelta} ${stat.up ? styles.deltaUp : styles.deltaDown}`}>
              {stat.up ? <Icons.TrendUp /> : <Icons.TrendDown />}{stat.trend}
            </span>
          )}
        </div>
        <div className={styles.metricSpark}>
          {!loading && sparks && sparks.length > 0 && (
            <Sparkline data={sparks} up={isUp} height={30} color={isUp ? '#5BC08D' : '#EFA6A6'} />
          )}
        </div>
      </div>
    );
  };

  // Roles with no company KPIs/charts (design/procurement) are 403'd on the
  // dashboard data endpoint by the read-policy (G-82) — skip the fetch so they
  // get the ActionInbox + workspace pointer, not an error banner.
  const hasDashData =
    hasCapability('orders:read') || hasCapability('reports:read') || hasCapability('customers:write');

  React.useEffect(() => {
    if (!hasDashData) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setApiError(null);
    setApiErrorStatus(null);
    dashboardApi.get(PERIOD_MAP[period] ?? 'month', controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : String(err);
        const status = (err as Error & { status?: number }).status ?? null;
        setApiError(msg);
        setApiErrorStatus(status);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period, refreshTick, hasDashData]);

  return (
    <div className={styles.page}>
      {apiError && (
        <div className={styles.errorBanner}>
          <strong>API Error:</strong> {apiError} — check browser console (F12 → Network) for details.
          {apiErrorStatus === 401 ? (
            <span> Your session may have expired — <button className={styles.errorBannerLink} onClick={() => { clearAdminToken(); navigate('/admin/login'); }}>log in again</button>.</span>
          ) : null}
        </div>
      )}

      {/* What needs me today (role-aware) — leads the page above the vanity stats */}
      <ActionInbox />

      {/* Overview — dark hero panel: title + period toggle + refresh. Hidden when the
          role has no company KPIs (design/procurement) so there's no empty band. */}
      {visibleKpis.length > 0 && (
      <div className={styles.overviewPanel}>
        <div className={styles.overviewHead}>
          <div className={styles.overviewTitleWrap}>
            <span className={styles.overviewTitle}>Overview</span>
            <span className={styles.overviewLive}><span className={styles.liveDot} aria-hidden /> Live</span>
          </div>
          <div className={styles.overviewControls}>
            <div className={styles.periodToggle}>
              {Object.keys(PERIOD_MAP).map(p => (
                <button
                  key={p}
                  className={`${styles.periodTab} ${period === p ? styles.periodTabActive : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              className={`${styles.overviewRefresh} ${loading ? styles.refreshSpinning : ''}`}
              onClick={refresh} disabled={loading} title="Refresh data" aria-label="Refresh data"
            >
              <UilSync size={15} />
            </button>
          </div>
        </div>
        <div className={styles.metricsPanel}>
          {visibleKpis.map(kpi => renderMetricCell(kpi))}
        </div>
      </div>
      )}

      {/* ── Mini metrics + Production funnel + Performance (TailAdmin arrangement) ── */}
      {(hasCapability('orders:read') || hasCapability('reports:read')) && (
      <div className={styles.cardsGrid}>
        <div className={styles.cardsLeft}>
          {/* mini metric cards — QC pass rate + AOV are company ops/financial → reports:read */}
          {hasCapability('reports:read') && (
          <div className={styles.miniRow}>
            <div
              className={styles.miniCard} role="button" tabIndex={0}
              onClick={() => navigate('/admin/hubs')}
              onKeyDown={e => e.key === 'Enter' && navigate('/admin/hubs')}
            >
              <div className={styles.miniHead}>
                <span className={styles.miniTitle}>QC Pass Rate</span>
                <span className={styles.miniSub}>across hubs</span>
              </div>
              <div className={styles.miniValue}>{avgQc ? `${avgQc}%` : '—'}</div>
              {/* P-5 (T3-8): no daily QC series exists → draw nothing (was borrowing the
                  activeOrders series, which describes a different quantity). */}
            </div>
            <div
              className={styles.miniCard} role="button" tabIndex={0}
              onClick={() => navigate('/admin/orders')}
              onKeyDown={e => e.key === 'Enter' && navigate('/admin/orders')}
            >
              <div className={styles.miniHead}>
                <span className={styles.miniTitle}>Avg. Order Value</span>
                <span className={styles.miniSub}>per order</span>
              </div>
              <div className={styles.miniValue}>{aov ? '₹' + aov.toLocaleString('en-IN') : '₹0'}</div>
              {/* P-5 (T3-8): AOV's own daily series (was mislabeled — it borrowed the GMV series). */}
              {!loading && data?.sparklines?.aov && data.sparklines.aov.length > 0 && (
                <div className={styles.miniSpark}>
                  <Sparkline data={data.sparklines.aov} up height={42} />
                </div>
              )}
            </div>
          </div>
          )}

          {/* Production funnel — orders by stage as coloured bars */}
          {hasCapability(CARD_CAP.pipeline) && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Production Funnel</h2>
              <button className={styles.cardLink} onClick={() => navigate('/admin/orders')}>View orders →</button>
            </div>
            {loading
              ? <div className={`${styles.skeletonBlock} ${styles.skeletonPulse}`} style={{ height: 240 }} />
              : funnelData.some(f => f.count > 0)
                ? <BarMini data={funnelData} xKey="name" dataKey="count" height={240} colors={funnelColors} />
                : <div className={styles.emptyState}>No orders in the pipeline yet</div>}
          </div>
          )}
        </div>

        {/* Performance — tabbed (Revenue / Hubs): company financials → reports:read */}
        {hasCapability('reports:read') && (
        <div className={`${styles.card} ${styles.perfCard}`}>
          <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Performance</h2></div>
          <div className={styles.perfTabs}>
            {(['Revenue', 'Hubs'] as const).map(t => (
              <button
                key={t}
                className={`${styles.perfTab} ${perfTab === t ? styles.perfTabActive : ''}`}
                onClick={() => setPerfTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className={styles.perfBody}>
            {loading ? (
              <div className={`${styles.skeletonBlock} ${styles.skeletonPulse}`} style={{ height: 260 }} />
            ) : perfTab === 'Revenue' ? (
              (data?.revenue ?? []).length > 0
                ? <AreaTrendChart data={data!.revenue as unknown as Record<string, string | number>[]} xKey="label" dataKey="simplified" height={262} valueFormatter={fmtINRShort} />
                : <div className={styles.emptyState}>No revenue yet</div>
            ) : (
              hubData.length > 0
                ? <BarMini data={hubData} xKey="name" dataKey="capacity" height={262} valueFormatter={v => `${v}%`} />
                : <div className={styles.emptyState}>No hub data</div>
            )}
          </div>
        </div>
        )}
      </div>
      )}

      {/* Overdue Orders (stage breakdown now lives in the Production Funnel above) */}
      {hasCapability(CARD_CAP.pipeline) && (data?.overdueOrders ?? []).length > 0 && (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Overdue Orders</h2>
          <button className={styles.cardLink} onClick={() => navigate('/admin/orders')}>View All Orders →</button>
        </div>
        <div className={styles.overdueList}>
          {data!.overdueOrders.map(o => (
            <div key={o.id} className={styles.overdueRow} onClick={() => navigate(`/admin/orders/${o.id}`)}>
              <span className={styles.overdueDot} aria-hidden />
              <span className={styles.overdueId}>{o.id}</span>
              <span className={styles.overdueCustomer}>{o.customer}</span>
              <span className={styles.overdueStage}>{o.stage.replace(/_/g, ' ')}</span>
              <span className={styles.overdueHub}>{o.hub}</span>
              <span className={styles.overdueCreated}>{o.created}</span>
              <span className={styles.overdueArrow}><Icons.ArrowRight /></span>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Urgent tickets (support) + Alerts (company ops → reports:read) */}
      {(hasCapability(CARD_CAP.support) || hasCapability('reports:read')) && (
      <div className={styles.twoCol}>
        {/* Hub Performance lives in the Performance card's "Hubs" tab —
            Urgent Tickets & Alerts share this operational row. */}
        {/* High-priority tickets */}
        {hasCapability(CARD_CAP.support) && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Urgent Support Tickets</h2>
            <button className={styles.cardLink} onClick={() => navigate('/admin/support')}>View All →</button>
          </div>
          {(data?.urgentTickets ?? []).length > 0 ? (
            <div className={styles.ticketList}>
              {(data?.urgentTickets ?? []).map(t => (
                <div key={t.id} className={styles.ticketRow} onClick={() => navigate(`/admin/support/${t.id}`)}>
                  <div>
                    <div className={styles.ticketSubject}>{t.subject}</div>
                    <div className={styles.ticketMeta}>{t.customer} · {t.created}</div>
                  </div>
                  <span className={styles.ticketBadge}>High</span>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className={`${styles.skeletonBlock} ${styles.skeletonPulse}`} />
          ) : (
            <div className={styles.emptyState}>No urgent tickets — all clear!</div>
          )}
        </div>
        )}

        {/* Alerts — company ops summary → reports:read */}
        {hasCapability('reports:read') && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Alerts</h2>
            {data && data.alerts.length > 0 && <span className={styles.alertCount}>{data.alerts.length}</span>}
          </div>
          {(data?.alerts ?? []).length > 0 ? (
            <div className={styles.alertList}>
              {(data?.alerts ?? []).map((alert, i) => (
                <div
                  key={i}
                  className={`${styles.alertItem} ${alert.level === 'red' ? styles.alertRed : styles.alertYellow}`}
                  onClick={() => navigate(alert.link)}
                >
                  <span className={styles.alertIcon}><UilExclamationTriangle size={15} /></span>
                  <span className={styles.alertText}>{alert.text}</span>
                  <span className={styles.alertArrow}><Icons.ArrowRight /></span>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className={`${styles.skeletonBlock} ${styles.skeletonPulse}`} />
          ) : (
            <div className={styles.emptyState}>No active alerts — all systems good.</div>
          )}
        </div>
        )}
      </div>
      )}

      {/* Recent Activity — company audit feed → reports:read */}
      {hasCapability('reports:read') && (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Recent Activity</h2>
          <button className={styles.cardLink} onClick={() => navigate('/admin/system/audit-log')}>View Audit Log →</button>
        </div>
        <div className={styles.activityList}>
          {(data?.recentActivity ?? []).length > 0
            ? (data?.recentActivity ?? []).map((item, i) => {
                const { Icon: AIcon, tint } = activityVisual(item.text);
                return (
                  <div key={i} className={styles.activityItem}>
                    <span className={`${styles.activityIcon} ${(styles as Record<string, string>)[tint] ?? ''}`}>
                      <AIcon size={15} />
                    </span>
                    <span className={styles.activityText}>{item.text}</span>
                    <span className={styles.activityTime}>{item.time}</span>
                  </div>
                );
              })
            : loading
              ? [1, 2, 3].map(i => <div key={i} className={`${styles.activitySkeleton} ${styles.skeletonPulse}`} />)
              : <div className={styles.emptyState}>No recent activity.</div>
          }
        </div>
      </div>
      )}

      {/* Role with no company widgets (e.g. design/procurement): the ActionInbox above
          carries their actionable work; point them at their workspace. */}
      {!hasCapability('orders:read') && !hasCapability('reports:read') && !hasCapability('customers:write') && (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            Your day-to-day lives in your workspace — use the left nav. Anything needing you shows up at the top.
          </div>
        </div>
      )}
    </div>
  );
};

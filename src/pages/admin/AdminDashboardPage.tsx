import React from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/adminApi';
import type { DashboardData } from '../../api/adminApi';
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

const kpis: { label: string; key: string; format: (v: number) => string; icon: IconKey; accent: Accent; navPath: string }[] = [
  { label: 'Total Orders',     key: 'totalOrders',     format: v => v.toLocaleString(),                   icon: 'Package',       accent: 'Emerald', navPath: '/admin/orders' },
  { label: 'Active Orders',    key: 'activeOrders',    format: v => v.toLocaleString(),                   icon: 'Activity',      accent: 'Emerald', navPath: '/admin/orders' },
  { label: 'GMV',              key: 'gmv',             format: v => '₹' + (v / 100000).toFixed(1) + 'L', icon: 'IndianRupee',   accent: 'Emerald', navPath: '/admin/analytics/revenue' },
  { label: 'Pending Payments', key: 'pendingPayments', format: v => v.toLocaleString(),                   icon: 'Clock',         accent: 'Amber',   navPath: '/admin/orders' },
  { label: 'Open Tickets',     key: 'openTickets',     format: v => v.toLocaleString(),                   icon: 'Headphones',    accent: 'Red',     navPath: '/admin/support' },
  { label: 'New Customers',    key: 'newCustomers',    format: v => v.toLocaleString(),                   icon: 'UserPlus',      accent: 'Emerald', navPath: '/admin/users' },
  { label: 'Waitlist Signups', key: 'waitlistSignups', format: v => v.toLocaleString(),                   icon: 'ClipboardList', accent: 'Gold',    navPath: '/admin/waitlist' },
];

const ACTIVITY_ICON: Record<string, IconKey> = {
  '📦': 'Package', '🏷️': 'Tag', '💳': 'CreditCard',
  '👤': 'User',    '⚠️': 'AlertTriangle', '✅': 'CheckCircle',
};

function fmtRupees(n: number) {
  if (n === 0) return '₹0';
  return n >= 100000 ? '₹' + (n / 100000).toFixed(1) + 'L' : '₹' + n.toLocaleString('en-IN');
}

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = React.useState('This Month');
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [apiErrorStatus, setApiErrorStatus] = React.useState<number | null>(null);

  const pipelinePhase = React.useMemo<Record<string, string>>(() => ({
    payment_pending:   styles.pipelinePhasePayment,
    payment_confirmed: styles.pipelinePhasePayment,
    fabric_sourced:    styles.pipelinePhaseProduction,
    in_tailoring:      styles.pipelinePhaseProduction,
    quality_check:     styles.pipelinePhaseProduction,
    ready_to_dispatch: styles.pipelinePhaseProduction,
    dispatched:        styles.pipelinePhaseDispatched,
  }), []);

  React.useEffect(() => {
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
  }, [period]);

  const { maxRevenue, yLabels } = React.useMemo(() => {
    const rev = data?.revenue ?? [];
    const max = Math.max(...rev.map(r => r.simplified + r.luxe), 1);
    return { maxRevenue: max, yLabels: [fmtRupees(max), fmtRupees(Math.round(max * 0.5)), '₹0'] };
  }, [data?.revenue]);

  return (
    <div className={styles.page}>
      {apiError && (
        <div className={styles.errorBanner}>
          <strong>API Error:</strong> {apiError} — check browser console (F12 → Network) for details.
          {apiErrorStatus === 401 ? (
            <span> Your session may have expired — <button className={styles.errorBannerLink} onClick={() => navigate('/admin/login')}>log in again</button>.</span>
          ) : null}
        </div>
      )}

      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.periodSelector}>
          {Object.keys(PERIOD_MAP).map(p => (
            <button
              key={p}
              className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.kpiGrid}>
        {kpis.map(kpi => {
          const stat = data?.stats[kpi.key];
          const sparks = data?.sparklines?.[kpi.key] ?? [40, 55, 48, 62, 70, 58, 75];
          const isUp = stat ? stat.up : true;
          const KpiIcon = Icons[kpi.icon];
          const accentClass = (styles as Record<string, string>)[`kpiAccent${kpi.accent}`];
          const iconClass = (styles as Record<string, string>)[`kpiIcon${kpi.accent}`];
          return (
            <div
              key={kpi.key}
              className={`${styles.kpiCard} ${accentClass ?? ''} ${loading ? styles.kpiCardLoading : ''}`}
              onClick={() => navigate(kpi.navPath)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(kpi.navPath)}
            >
              <div className={styles.kpiCardTop}>
                <div className={styles.kpiLabel}>{kpi.label}</div>
                <div className={`${styles.kpiIcon} ${iconClass ?? ''}`}>
                  <KpiIcon />
                </div>
              </div>
              <div className={styles.kpiValue}>{stat ? kpi.format(stat.value) : '—'}</div>
              {stat && (
                <div className={`${styles.kpiTrend} ${stat.up ? styles.trendUp : styles.trendDown}`}>
                  <span className={styles.kpiTrendIcon}>
                    {stat.up ? <Icons.TrendUp /> : <Icons.TrendDown />}
                  </span>
                  {stat.trend} vs last period
                </div>
              )}
              <div className={styles.sparkline}>
                {sparks.map((h, i) => (
                  <div
                    key={i}
                    className={`${styles.sparkBar} ${isUp ? styles.sparkBarUp : styles.sparkBarDown}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Stage Pipeline */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Order Pipeline</h2>
          <button className={styles.cardLink} onClick={() => navigate('/admin/orders')}>View All Orders →</button>
        </div>
        <div className={styles.pipeline}>
          {(data?.ordersByStage ?? []).length > 0
            ? (data?.ordersByStage ?? []).map((s, i, arr) => (
                <React.Fragment key={s.stage}>
                  <div
                    className={`${styles.pipelineStage} ${s.overdue > 0 ? styles.pipelineStageOverdue : ''} ${pipelinePhase[s.stage] ?? ''}`}
                    onClick={() => navigate(`/admin/orders?stage=${s.stage}`)}
                  >
                    <div className={styles.pipelineCount}>{s.count}</div>
                    <div className={styles.pipelineLabel}>{s.label}</div>
                    {s.overdue > 0 && (
                      <div className={styles.pipelineOverdueBadge}>
                        <span className={styles.overdueBadgeIcon}><Icons.AlertTriangle /></span>
                        {s.overdue} overdue
                      </div>
                    )}
                  </div>
                  {i < arr.length - 1 && (
                    <div className={styles.pipelineArrow}><Icons.ArrowRight /></div>
                  )}
                </React.Fragment>
              ))
            : loading
              ? [1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className={`${styles.pipelineSkeleton} ${styles.skeletonPulse}`} />)
              : <div className={styles.emptyState}>No pipeline data</div>
          }
        </div>
        {(data?.overdueOrders ?? []).length > 0 && (
          <div className={styles.overdueList}>
            <div className={styles.overdueTitle}>Overdue Orders</div>
            {data!.overdueOrders.map(o => (
              <div key={o.id} className={styles.overdueRow} onClick={() => navigate(`/admin/orders/${o.id}`)}>
                <span className={styles.overdueId}>{o.id}</span>
                <span className={styles.overdueCustomer}>{o.customer}</span>
                <span className={styles.overdueStage}>{o.stage.replace(/_/g, ' ')}</span>
                <span className={styles.overdueHub}>{o.hub}</span>
                <span className={styles.overdueCreated}>{o.created}</span>
                <span className={styles.overdueArrow}><Icons.ArrowRight /></span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mode Split + Hub Performance */}
      <div className={styles.twoCol}>
        {/* Mode Split */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Simplified vs Luxe</h2>
          </div>
          {data?.modeSplit ? (() => {
            const ms = data.modeSplit;
            const total = ms.simplifiedOrders + ms.luxeOrders;
            const sPct = Math.round(ms.simplifiedOrders / total * 100);
            return (
              <div className={styles.modeSplit}>
                <div className={styles.modeRow}>
                  <div className={styles.modeDotPrimary} />
                  <div className={styles.modeInfo}>
                    <div className={styles.modeName}>Simplified</div>
                    <div className={styles.modeStats}>{ms.simplifiedOrders.toLocaleString()} orders · {fmtRupees(ms.simplifiedRevenue)}</div>
                  </div>
                  <div className={styles.modePct}>{sPct}%</div>
                </div>
                <div className={styles.modeBar}>
                  <div className={styles.modeBarSimplified} style={{ width: `${sPct}%` }} />
                  <div className={styles.modeBarLuxe} />
                </div>
                <div className={styles.modeRow}>
                  <div className={styles.modeDotSecondary} />
                  <div className={styles.modeInfo}>
                    <div className={styles.modeName}>Luxe</div>
                    <div className={styles.modeStats}>{ms.luxeOrders.toLocaleString()} orders · {fmtRupees(ms.luxeRevenue)}</div>
                  </div>
                  <div className={styles.modePct}>{100 - sPct}%</div>
                </div>
                <div className={styles.modeDivider} />
                <div className={styles.modeAOV}>
                  <span>Avg Order Value</span>
                  <span>
                    <strong>Simplified:</strong> {fmtRupees(Math.round(ms.simplifiedRevenue / ms.simplifiedOrders))}
                    {' · '}
                    <strong>Luxe:</strong> {fmtRupees(Math.round(ms.luxeRevenue / ms.luxeOrders))}
                  </span>
                </div>
              </div>
            );
          })() : (
            <div className={`${styles.skeletonBlock} ${loading ? styles.skeletonPulse : ''}`} />
          )}
        </div>

        {/* Hub Performance */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Hub Performance</h2>
            <button className={styles.cardLink} onClick={() => navigate('/admin/hubs')}>View All →</button>
          </div>
          {(data?.hubPerformance ?? []).length > 0 ? (
            <div className={styles.hubList}>
              <div className={styles.hubHeader}>
                <span className={styles.hubColName}>Hub</span>
                <span className={styles.hubColBar}>Capacity</span>
                <span className={styles.hubColPct}>Load</span>
                <span className={styles.hubColQC}>QC</span>
              </div>
              {(data?.hubPerformance ?? []).map(hub => (
                <div key={hub.name} className={styles.hubRow} onClick={() => navigate('/admin/hubs')}>
                  <div className={styles.hubName}>{hub.name}</div>
                  <div className={styles.hubBar}>
                    <div
                      className={`${styles.hubBarFill} ${hub.capacity >= 100 ? styles.hubBarFull : hub.capacity >= 80 ? styles.hubBarHigh : styles.hubBarNormal}`}
                      style={{ width: `${hub.capacity}%` }}
                    />
                  </div>
                  <div className={styles.hubCapacity}>{hub.capacity}%</div>
                  <div className={`${styles.hubQC} ${hub.qcPassRate < 93 ? styles.hubQCLow : hub.qcPassRate < 97 ? styles.hubQCMid : ''}`}>
                    {hub.qcPassRate}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            loading
              ? <div className={`${styles.skeletonBlock} ${styles.skeletonPulse}`} />
              : <div className={styles.emptyState}>No hub data</div>
          )}
        </div>
      </div>

      {/* Urgent Tickets + Alerts */}
      <div className={styles.twoCol}>
        {/* High-priority tickets */}
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
          {data?.consultations && (data.consultations.pending > 0 || data.consultations.unassigned > 0) && (
            <div className={styles.consultMini}>
              <div className={styles.consultMiniTitle}>Consultations needing action</div>
              <div className={styles.consultMiniRow}>
                {data.consultations.pending > 0 && (
                  <button className={styles.consultChip} onClick={() => navigate('/admin/catalog/consultations')}>
                    {data.consultations.pending} pending
                  </button>
                )}
                {data.consultations.unassigned > 0 && (
                  <button className={styles.consultChip} onClick={() => navigate('/admin/catalog/consultations')}>
                    {data.consultations.unassigned} unassigned
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alerts */}
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
                  <span className={styles.alertDot} />
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
      </div>

      {/* Revenue chart */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Revenue Trend — {period}</h2>
          <button className={styles.cardLink} onClick={() => navigate('/admin/analytics/revenue')}>Full Report →</button>
        </div>
        <div className={styles.chartWrap}>
          <div className={styles.chartYAxis}>
            {yLabels.map((l, i) => <span key={i} className={styles.chartYLabel}>{l}</span>)}
          </div>
          <div className={styles.chartMain}>
            <div className={styles.chartBars}>
              <div className={`${styles.chartGridline} ${styles.chartGridlineTop}`} />
              <div className={`${styles.chartGridline} ${styles.chartGridlineMid}`} />
              <div className={`${styles.chartGridline} ${styles.chartGridlineBot}`} />
              {(data?.revenue ?? []).map((d, i) => (
                <div
                  key={i}
                  className={styles.chartBarGroup}
                  title={`${d.label}: Simplified ${fmtRupees(d.simplified)}, Luxe ${fmtRupees(d.luxe)}`}
                >
                  <div className={styles.chartBarSimplified} style={{ height: `${Math.max(2, (d.simplified / maxRevenue) * 100)}%` }} />
                  <div className={styles.chartBarLuxe} style={{ height: `${Math.max(2, (d.luxe / maxRevenue) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className={styles.chartXAxis}>
              {(data?.revenue ?? []).map((d, i) => (
                <div key={i} className={`${styles.chartXLabel} ${i % 2 !== 0 ? styles.chartXLabelHidden : ''}`}>{d.label}</div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.chartLegend}>
          <span className={styles.legendSimplified}>■ Simplified</span>
          <span className={styles.legendLuxe}>■ Luxe Prime</span>
        </div>
      </div>

      {/* Recent Activity */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Recent Activity</h2>
          <button className={styles.cardLink} onClick={() => navigate('/admin/system/audit')}>View Audit Log →</button>
        </div>
        <div className={styles.activityList}>
          {(data?.recentActivity ?? []).length > 0
            ? (data?.recentActivity ?? []).map((item, i) => {
                const iconKey = ACTIVITY_ICON[item.icon];
                const ActivityIcon = iconKey ? Icons[iconKey] : null;
                return (
                  <div key={i} className={styles.activityItem}>
                    <span className={styles.activityIcon}>
                      {ActivityIcon ? <ActivityIcon /> : item.icon}
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
    </div>
  );
};

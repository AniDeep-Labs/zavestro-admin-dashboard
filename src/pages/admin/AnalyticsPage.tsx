import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analyticsApi, hubsApi, fitAnalyticsApi } from '../../api/adminApi';
import type { AnalyticsData, Hub, FitAnalyticsData, RetentionData } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { downloadCsv, datedFilename } from '../../utils/csv';
import { AreaTrendChart, fmtINRShort } from '../../components/charts/Charts';
import styles from './AnalyticsPage.module.css';
import { UilChartBar, UilChartDown, UilChartGrowth, UilImport } from "@iconscout/react-unicons";
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

type Section = 'revenue' | 'orders' | 'fit-scores' | 'hub-performance' | 'retention';

const SECTION_TITLES: Record<Section, string> = {
  revenue: 'Revenue Dashboard',
  orders: 'Orders Analytics',
  'fit-scores': 'Fit Scores Analytics',
  'hub-performance': 'Hub Performance',
  retention: 'Customer Retention Metrics',
};

const PERIOD_MAP: Record<string, string> = {
  'Today': 'today', 'This Week': 'week', 'This Month': 'month', 'Last 30 Days': 'last30', 'This Quarter': 'quarter',
};

function fmtMoney(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className={styles.card} style={{ textAlign: 'center', padding: '48px 24px' }}>
      <UilChartBar size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>{message}</p>
    </div>
  );
}

// T2-23: a KPI tile that drills to the underlying records when it has a `to` route.
type KpiItem = { label: string; value: string; trend: string; up: boolean; to?: string };
function KpiCard({ k, navigate }: { k: KpiItem; navigate: ReturnType<typeof useNavigate> }) {
  const clickable = !!k.to;
  return (
    <div
      className={`${styles.kpiCard} ${clickable ? styles.kpiClickable : ''}`}
      onClick={clickable ? () => navigate(k.to!) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') navigate(k.to!); } : undefined}
    >
      <div className={styles.kpiLabel}>{k.label}{clickable && <span className={styles.drillArrow}> →</span>}</div>
      <div className={styles.kpiValue}>{k.value}</div>
      {k.trend && (
        <div className={`${styles.kpiTrend} ${k.up ? styles.trendUp : styles.trendDown}`}>
          {k.up ? <UilChartGrowth size={12}/> : <UilChartDown size={12}/>} {k.trend}
        </div>
      )}
    </div>
  );
}

export const AnalyticsPage: React.FC = () => {
  const { section = 'revenue' } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const [period, setPeriod] = React.useState('This Month');
  const [analyticsData, setAnalyticsData] = React.useState<AnalyticsData | null>(null);
  const [fitData, setFitData] = React.useState<FitAnalyticsData | null>(null);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [hubsLoading, setHubsLoading] = React.useState(false);
  const [hubsError, setHubsError] = React.useState('');
  const [retention, setRetention] = React.useState<RetentionData | null>(null);
  const [retentionLoading, setRetentionLoading] = React.useState(true);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    analyticsApi.get(PERIOD_MAP[period] ?? 'month').then(setAnalyticsData).catch(() => {});
  }, [period]);

  React.useEffect(() => {
    fitAnalyticsApi.get(PERIOD_MAP[period] ?? 'month').then(setFitData).catch((e: Error) => {
      showToast('error', 'Failed to load fit scores', e.message);
    });
  }, [period]);

  React.useEffect(() => {
    setHubsLoading(true);
    setHubsError('');
    hubsApi.list()
      .then(r => setHubs(r.hubs))
      .catch((e: Error) => setHubsError(e.message || 'Failed to load hubs'))
      .finally(() => setHubsLoading(false));
  }, []);

  React.useEffect(() => {
    setRetentionLoading(true);
    analyticsApi.retention()
      .then(setRetention)
      .catch(() => {})
      .finally(() => setRetentionLoading(false));
  }, []);

  const VALID_SECTIONS = Object.keys(SECTION_TITLES) as Section[];
  const isKnownSection = VALID_SECTIONS.includes(section as Section);
  const validSection: Section = isKnownSection ? (section as Section) : 'revenue';
  const title = isKnownSection ? SECTION_TITLES[validSection] : 'Analytics';

  const exportRevenue = () => {
    if (!analyticsData) return;
    downloadCsv<{ label: string; simplified: number }>(
      datedFilename('revenue'),
      [
        { header: 'Period', value: r => r.label },
        { header: 'Revenue (INR)', value: r => r.simplified },
      ],
      analyticsData.revenue,
    );
  };

  const ordersKpi = analyticsData?.kpis.find(k => k.label === 'Orders');
  const gmvKpi    = analyticsData?.kpis.find(k => k.label === 'GMV');
  const custKpi   = analyticsData?.kpis.find(k => k.label === 'Customers');
  const aovKpi    = analyticsData?.kpis.find(k => k.label === 'Avg Order Value');

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{title}</h1>
        {validSection !== 'hub-performance' && validSection !== 'retention' && (
          <div className={styles.periodSelector}>
            {['Today', 'This Week', 'This Month', 'Last 30 Days', 'This Quarter'].map(p => (
              <button key={p} className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`} onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
        )}
      </div>

      {!isKnownSection && !!section && (
        <EmptyState message={`Analytics section "${section}" not found.`} />
      )}

      {/* Revenue */}
      {isKnownSection && validSection === 'revenue' && (
        <>
          <div className={styles.kpiGrid}>
            {[
              { label: 'Total GMV',        value: gmvKpi  ? fmtMoney(gmvKpi.value)  : '₹0', trend: gmvKpi?.trend  ?? '', up: gmvKpi?.up  ?? true },
              { label: 'Total Orders',     value: ordersKpi ? ordersKpi.value.toLocaleString('en-IN') : '0', trend: ordersKpi?.trend ?? '', up: ordersKpi?.up ?? true, to: '/admin/orders' },
              { label: 'New Customers',    value: custKpi ? custKpi.value.toLocaleString('en-IN') : '0', trend: custKpi?.trend ?? '', up: custKpi?.up ?? true },
              { label: 'Avg. Order Value', value: aovKpi  ? `₹${aovKpi.value.toLocaleString('en-IN')}` : '₹0', trend: aovKpi?.trend  ?? '', up: aovKpi?.up  ?? true },
            ].map(k => (
              <KpiCard key={k.label} k={k} navigate={navigate} />
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Revenue Trend</h2>
              <button className={styles.exportBtn} onClick={exportRevenue} disabled={!analyticsData}><UilImport size={14}/> Export CSV</button>
            </div>
            {analyticsData && analyticsData.revenue.some(r => r.simplified > 0) ? (
              <AreaTrendChart
                data={analyticsData.revenue as unknown as Record<string, string | number>[]}
                xKey="label" dataKey="simplified" height={300} valueFormatter={fmtINRShort}
              />
            ) : (
              <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', padding: '24px 0' }}>No revenue recorded yet for this period.</p>
            )}
          </div>
        </>
      )}

      {/* Orders Analytics */}
      {validSection === 'orders' && (
        <>
          <div className={styles.kpiGrid}>
            {[
              { label: 'Total Orders',      value: ordersKpi ? ordersKpi.value.toLocaleString('en-IN') : '0', trend: ordersKpi?.trend ?? '', up: ordersKpi?.up ?? true, to: '/admin/orders' },
              { label: 'GMV',               value: gmvKpi   ? fmtMoney(gmvKpi.value) : '₹0',                  trend: gmvKpi?.trend  ?? '', up: gmvKpi?.up  ?? true },
              { label: 'New Customers',     value: custKpi  ? custKpi.value.toLocaleString('en-IN') : '0',     trend: custKpi?.trend ?? '', up: custKpi?.up ?? true },
              { label: 'Avg. Order Value',  value: aovKpi   ? `₹${aovKpi.value.toLocaleString('en-IN')}` : '₹0', trend: aovKpi?.trend ?? '', up: aovKpi?.up ?? true },
            ].map(k => (
              <KpiCard key={k.label} k={k} navigate={navigate} />
            ))}
          </div>
          <p className={styles.drillHint}>
            Tip: open the <button className={styles.linkBtn} onClick={() => navigate('/admin/oversight/hub-constraints')}>Hub Constraints</button> board for per-stage timing and SLA breaches.
          </p>
        </>
      )}

      {/* Fit Scores */}
      {validSection === 'fit-scores' && (
        <>
          {fitData ? (
            <>
              <div className={styles.kpiGrid}>
                {[
                  { label: 'Avg. Fit Score',        value: `${fitData.avg_fit_score ?? 0} ★` },
                  { label: 'Feedback Submitted',    value: String(fitData.feedback_count ?? 0) },
                  { label: 'Alteration Rate',       value: `${fitData.alteration_rate ?? 0}%` },
                  { label: 'Alteration → Good Fit', value: `${fitData.alteration_success_rate ?? 0}%` },
                ].map(k => (
                  <div key={k.label} className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>{k.label}</div>
                    <div className={styles.kpiValue}>{k.value}</div>
                  </div>
                ))}
              </div>
              {(fitData.by_product ?? []).length > 0 && (
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Fit Score by Product</h2>
                  <div className={styles.fitBars}>
                    {(fitData.by_product ?? []).map(item => {
                      const score = item.avg_fit_score ?? 0;
                      return (
                        <div key={item.name} className={`${styles.fitRow} ${styles.clickable}`} role="button" tabIndex={0}
                          onClick={() => navigate('/admin/fit-outcomes')}
                          onKeyDown={e => { if (e.key === 'Enter') navigate('/admin/fit-outcomes'); }}>
                          <span className={styles.fitCat}>{item.name}</span>
                          <div className={styles.fitBarWrap}>
                            <div className={`${styles.fitBar} ${score < 4 ? styles.fitBarLow : styles.fitBarHigh}`}
                              style={{ width: `${(score / 5) * 100}%` }} />
                          </div>
                          <span className={`${styles.fitScore} ${score < 4 ? styles.fitScoreLow : ''}`}>{score} ★</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {(fitData.hub_performance ?? []).length > 0 && (
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Fit Score by Hub</h2>
                  <div className={styles.fitBars}>
                    {(fitData.hub_performance ?? []).map(h => {
                      const score = h.avg_fit_score ?? 0;
                      return (
                        <div key={h.name} className={`${styles.fitRow} ${styles.clickable}`} role="button" tabIndex={0}
                          onClick={() => navigate('/admin/fit-outcomes')}
                          onKeyDown={e => { if (e.key === 'Enter') navigate('/admin/fit-outcomes'); }}>
                          <span className={styles.fitCat}>{h.name}</span>
                          <div className={styles.fitBarWrap}>
                            <div className={`${styles.fitBar} ${score < 4 ? styles.fitBarLow : styles.fitBarHigh}`}
                              style={{ width: `${(score / 5) * 100}%` }} />
                          </div>
                          <span className={`${styles.fitScore} ${score < 4 ? styles.fitScoreLow : ''}`}>{score} ★</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState message="Fit score data will appear once customers submit fit feedback on their orders." />
          )}
        </>
      )}

      {/* Hub Performance */}
      {validSection === 'hub-performance' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Hub Performance Comparison</h2>
          {hubsLoading ? (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', padding: '24px 0' }}>Loading hub data…</p>
          ) : hubsError ? (
            <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', padding: '24px 0' }}>{hubsError}</p>
          ) : hubs.length === 0 ? (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', padding: '24px 0' }}>No hubs configured yet. Add hubs from the Hubs section.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr><th>Hub</th><th>City</th><th>Active Orders</th><th>Staff</th><th>Tailors</th><th>QC Staff</th><th>Status</th></tr>
              </thead>
              <tbody>
                {hubs.map(h => (
                  <tr key={h.id} className={styles.row} {...rowActivation(() => navigate(`/admin/hubs/${h.id}`))}>
                    <td className={styles.productName}>{h.name}</td>
                    <td>{h.city}</td>
                    <td>{h.activeOrders}</td>
                    <td>{h.staffCount}</td>
                    <td>{h.tailorCount}</td>
                    <td>{h.qcCount}</td>
                    <td><span className={h.status === 'Active' ? styles.onTrack : styles.behind}>{h.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Retention */}
      {validSection === 'retention' && (
        retentionLoading ? (
          <EmptyState message="Loading retention…" />
        ) : !retention || retention.total_customers === 0 ? (
          <EmptyState message="Retention metrics will appear once customers have delivered orders." />
        ) : (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Customer Retention</h2>
            <table className={styles.table}>
              <thead><tr><th>Metric</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td className={styles.productName}>Customers with a delivered order</td><td>{retention.total_customers}</td></tr>
                <tr><td className={styles.productName}>Repeat customers (2+ orders)</td><td>{retention.repeat_customers}</td></tr>
                <tr><td className={styles.productName}>Repeat rate</td><td>{retention.repeat_rate}%</td></tr>
                <tr><td className={styles.productName}>Avg orders per customer</td><td>{retention.avg_orders_per_customer}</td></tr>
                <tr><td className={styles.productName}>Customers with exactly 1 order</td><td>{retention.distribution.one}</td></tr>
                <tr><td className={styles.productName}>Customers with exactly 2 orders</td><td>{retention.distribution.two}</td></tr>
                <tr><td className={styles.productName}>Customers with 3+ orders</td><td>{retention.distribution.three_plus}</td></tr>
              </tbody>
            </table>
          </div>
        )
      )}

    </div>
  );
};

import React from 'react';
import { useParams } from 'react-router-dom';
import { TrendingUp, TrendingDown, Plus, Download, BarChart2 } from 'lucide-react';
import { analyticsApi, hubsApi } from '../../api/adminApi';
import type { AnalyticsData, Hub } from '../../api/adminApi';
import styles from './AnalyticsPage.module.css';

type Section = 'revenue' | 'orders' | 'fit-scores' | 'hubs' | 'retention' | 'promos';

const SECTION_TITLES: Record<Section, string> = {
  revenue: 'Revenue Dashboard',
  orders: 'Orders Analytics',
  'fit-scores': 'Fit Scores Analytics',
  hubs: 'Hub Performance Comparison',
  retention: 'Customer Retention Metrics',
  promos: 'Promo Codes',
};

const PERIOD_MAP: Record<string, string> = {
  'This Week': 'week', 'This Month': 'month', 'Last 30 Days': 'last30', 'This Quarter': 'quarter',
};

function fmtMoney(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

interface FitData {
  avg_fit_score: number;
  feedback_count: number;
  alteration_rate: number;
  alteration_success_rate: number;
  by_product: { name: string; avg_fit_score: number }[];
  hub_performance: { hub_name: string; avg_fit_score: number }[];
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className={styles.card} style={{ textAlign: 'center', padding: '48px 24px' }}>
      <BarChart2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
      <p style={{ color: 'var(--ink-3)', fontSize: '0.875rem' }}>{message}</p>
    </div>
  );
}

export const AnalyticsPage: React.FC = () => {
  const { section = 'revenue' } = useParams<{ section?: string }>();
  const [period, setPeriod] = React.useState('This Month');
  const [showPromoModal, setShowPromoModal] = React.useState(false);
  const [analyticsData, setAnalyticsData] = React.useState<AnalyticsData | null>(null);
  const [fitData, setFitData] = React.useState<FitData | null>(null);
  const [hubs, setHubs] = React.useState<Hub[]>([]);

  React.useEffect(() => {
    analyticsApi.get(PERIOD_MAP[period] ?? 'month')
      .then(setAnalyticsData)
      .catch(() => {});
  }, [period]);

  React.useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/admin/analytics/fit`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('zavestro_admin_token')}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.success ? setFitData(d.data) : null)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    hubsApi.list().then(r => setHubs(r.hubs)).catch(() => {});
  }, []);

  const validSection = (section as Section) in SECTION_TITLES ? (section as Section) : 'revenue';
  const title = SECTION_TITLES[validSection];

  const ordersKpi = analyticsData?.kpis.find(k => k.label === 'Orders');
  const gmvKpi    = analyticsData?.kpis.find(k => k.label === 'GMV');
  const custKpi   = analyticsData?.kpis.find(k => k.label === 'Customers');
  const aovKpi    = analyticsData?.kpis.find(k => k.label === 'Avg Order Value');

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.periodSelector}>
          {['This Week', 'This Month', 'Last 30 Days', 'This Quarter'].map(p => (
            <button key={p} className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>

      {/* Revenue */}
      {validSection === 'revenue' && (
        <>
          <div className={styles.kpiGrid}>
            {[
              { label: 'Total GMV',        value: gmvKpi  ? fmtMoney(gmvKpi.value)  : '₹0', trend: gmvKpi?.trend  ?? '', up: gmvKpi?.up  ?? true },
              { label: 'Total Orders',     value: ordersKpi ? ordersKpi.value.toLocaleString('en-IN') : '0', trend: ordersKpi?.trend ?? '', up: ordersKpi?.up ?? true },
              { label: 'New Customers',    value: custKpi ? custKpi.value.toLocaleString('en-IN') : '0', trend: custKpi?.trend ?? '', up: custKpi?.up ?? true },
              { label: 'Avg. Order Value', value: aovKpi  ? `₹${aovKpi.value.toLocaleString('en-IN')}` : '₹0', trend: aovKpi?.trend  ?? '', up: aovKpi?.up  ?? true },
            ].map(k => (
              <div key={k.label} className={styles.kpiCard}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
                {k.trend && (
                  <div className={`${styles.kpiTrend} ${k.up ? styles.trendUp : styles.trendDown}`}>
                    {k.up ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {k.trend}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Revenue Trend</h2>
              <button className={styles.exportBtn}><Download size={14}/> Export CSV</button>
            </div>
            {analyticsData && analyticsData.revenue.some(r => r.simplified > 0 || r.luxe > 0) ? (
              <div className={styles.chart}>
                <div className={styles.chartBars}>
                  {analyticsData.revenue.map((d, i) => {
                    const maxV = Math.max(...analyticsData.revenue.map(r => Math.max(r.simplified, r.luxe)), 1);
                    return (
                      <div key={i} className={styles.barGroup}>
                        <div className={styles.barSimplified} style={{ height: `${Math.max(4, (d.simplified / maxV) * 100)}%` }} />
                        <div className={styles.barLuxe} style={{ height: `${Math.max(4, (d.luxe / maxV) * 100)}%` }} />
                      </div>
                    );
                  })}
                </div>
                <div className={styles.legend}>
                  <span className={styles.legendGreen}>■ Simplified</span>
                  <span className={styles.legendGold}>■ Luxe Prime</span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--ink-3)', fontSize: '0.875rem', padding: '24px 0' }}>No revenue recorded yet for this period.</p>
            )}
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Top Products by Revenue</h2>
            <p style={{ color: 'var(--ink-3)', fontSize: '0.875rem', padding: '16px 0' }}>No orders recorded yet — top products will appear here once orders come in.</p>
          </div>
        </>
      )}

      {/* Orders Analytics */}
      {validSection === 'orders' && (
        <>
          <div className={styles.kpiGrid}>
            {[
              { label: 'Total Orders',      value: ordersKpi ? ordersKpi.value.toLocaleString('en-IN') : '0', trend: ordersKpi?.trend ?? '', up: ordersKpi?.up ?? true },
              { label: 'GMV',               value: gmvKpi   ? fmtMoney(gmvKpi.value) : '₹0',                  trend: gmvKpi?.trend  ?? '', up: gmvKpi?.up  ?? true },
              { label: 'New Customers',     value: custKpi  ? custKpi.value.toLocaleString('en-IN') : '0',     trend: custKpi?.trend ?? '', up: custKpi?.up ?? true },
              { label: 'Avg. Order Value',  value: aovKpi   ? `₹${aovKpi.value.toLocaleString('en-IN')}` : '₹0', trend: aovKpi?.trend ?? '', up: aovKpi?.up ?? true },
            ].map(k => (
              <div key={k.label} className={styles.kpiCard}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
                {k.trend && (
                  <div className={`${styles.kpiTrend} ${k.up ? styles.trendUp : styles.trendDown}`}>
                    {k.up ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {k.trend}
                  </div>
                )}
              </div>
            ))}
          </div>
          <EmptyState message="Stage latency data will appear once orders progress through production stages." />
        </>
      )}

      {/* Fit Scores */}
      {validSection === 'fit-scores' && (
        <>
          {fitData ? (
            <>
              <div className={styles.kpiGrid}>
                {[
                  { label: 'Avg. Fit Score',        value: `${fitData.avg_fit_score} ★`,       trend: '', up: true },
                  { label: 'Feedback Submitted',    value: fitData.feedback_count.toString(),   trend: '', up: true },
                  { label: 'Alteration Rate',       value: `${fitData.alteration_rate}%`,       trend: '', up: false },
                  { label: 'Alteration → Good Fit', value: `${fitData.alteration_success_rate}%`, trend: '', up: true },
                ].map(k => (
                  <div key={k.label} className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>{k.label}</div>
                    <div className={styles.kpiValue}>{k.value}</div>
                  </div>
                ))}
              </div>
              {fitData.by_product.length > 0 && (
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Fit Score by Product</h2>
                  <div className={styles.fitBars}>
                    {fitData.by_product.map(item => (
                      <div key={item.name} className={styles.fitRow}>
                        <span className={styles.fitCat}>{item.name}</span>
                        <div className={styles.fitBarWrap}>
                          <div className={`${styles.fitBar} ${item.avg_fit_score < 4 ? styles.fitBarLow : styles.fitBarHigh}`}
                            style={{ width: `${(item.avg_fit_score / 5) * 100}%` }} />
                        </div>
                        <span className={`${styles.fitScore} ${item.avg_fit_score < 4 ? styles.fitScoreLow : ''}`}>{item.avg_fit_score} ★</span>
                      </div>
                    ))}
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
      {validSection === 'hubs' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Hub Performance Comparison</h2>
          {hubs.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', fontSize: '0.875rem', padding: '16px 0' }}>No hubs configured yet. Add hubs from the Hubs section.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr><th>Hub</th><th>City</th><th>Active Orders</th><th>Staff</th><th>Tailors</th><th>QC Staff</th><th>Status</th></tr>
              </thead>
              <tbody>
                {hubs.map(h => (
                  <tr key={h.id}>
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
        <EmptyState message="Retention metrics will appear once you have customers with repeat orders." />
      )}

      {/* Promos */}
      {validSection === 'promos' && (
        <>
          <div className={styles.pageHeader} style={{ marginTop: 0 }}>
            <div />
            <button className={styles.addBtn} onClick={() => setShowPromoModal(true)}><Plus size={15}/> Create Promo Code</button>
          </div>
          <EmptyState message="No promo codes created yet. Use the button above to create your first promo code." />
        </>
      )}

      {/* Promo modal */}
      {showPromoModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPromoModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Create Promo Code</h3>
            <div className={styles.fields}>
              <div className={styles.field}><label className={styles.fieldLabel}>Code *</label><input className={styles.fieldInput} placeholder="e.g., SAVE10" /></div>
              <div className={styles.field}><label className={styles.fieldLabel}>Type</label>
                <select className={styles.fieldSelect}><option>Percentage (%)</option><option>Flat (₹)</option><option>Free Delivery</option></select>
              </div>
              <div className={styles.field}><label className={styles.fieldLabel}>Value</label><input className={styles.fieldInput} placeholder="e.g., 10" /></div>
              <div className={styles.field}><label className={styles.fieldLabel}>Expiry Date</label><input type="date" className={styles.fieldInput} /></div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowPromoModal(false)}>Cancel</button>
              <button className={styles.createBtn} onClick={() => setShowPromoModal(false)}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

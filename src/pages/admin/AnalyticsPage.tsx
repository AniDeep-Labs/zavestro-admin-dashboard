import React from 'react';
import { useParams } from 'react-router-dom';
import { TrendingUp, TrendingDown, Plus, Download, BarChart2, ToggleLeft, ToggleRight } from 'lucide-react';
import { analyticsApi, hubsApi, promosApi, fitAnalyticsApi } from '../../api/adminApi';
import type { AnalyticsData, Hub, PromoCode, FitAnalyticsData } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
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
  const [fitData, setFitData] = React.useState<FitAnalyticsData | null>(null);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [promos, setPromos] = React.useState<PromoCode[]>([]);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Promo form state
  const [promoCode, setPromoCode] = React.useState('');
  const [promoType, setPromoType] = React.useState<'percent' | 'flat'>('percent');
  const [promoValue, setPromoValue] = React.useState('');
  const [promoExpiry, setPromoExpiry] = React.useState('');
  const [promoMaxUses, setPromoMaxUses] = React.useState('');
  const [promoMinOrder, setPromoMinOrder] = React.useState('');
  const [savingPromo, setSavingPromo] = React.useState(false);

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
    hubsApi.list().then(r => setHubs(r.hubs)).catch(() => {});
  }, []);

  React.useEffect(() => {
    if ((section as Section) === 'promos') {
      promosApi.list().then(r => setPromos(r.promos)).catch(() => {});
    }
  }, [section]);

  const validSection = (section as Section) in SECTION_TITLES ? (section as Section) : 'revenue';
  const title = SECTION_TITLES[validSection];

  const ordersKpi = analyticsData?.kpis.find(k => k.label === 'Orders');
  const gmvKpi    = analyticsData?.kpis.find(k => k.label === 'GMV');
  const custKpi   = analyticsData?.kpis.find(k => k.label === 'Customers');
  const aovKpi    = analyticsData?.kpis.find(k => k.label === 'Avg Order Value');

  const handleCreatePromo = async () => {
    if (!promoCode.trim() || !promoValue) { showToast('error', 'Code and value are required'); return; }
    setSavingPromo(true);
    try {
      const created = await promosApi.create({
        code: promoCode.trim().toUpperCase(),
        discount_type: promoType,
        discount_value: parseFloat(promoValue),
        min_order_amount: promoMinOrder ? parseFloat(promoMinOrder) : 0,
        max_uses: promoMaxUses ? parseInt(promoMaxUses) : undefined,
        valid_until: promoExpiry ? new Date(promoExpiry).toISOString() : undefined,
      });
      setPromos(prev => [created, ...prev]);
      setShowPromoModal(false);
      setPromoCode(''); setPromoType('percent'); setPromoValue(''); setPromoExpiry(''); setPromoMaxUses(''); setPromoMinOrder('');
      showToast('success', 'Promo created', created.code);
    } catch (e) {
      showToast('error', 'Failed to create promo', e instanceof Error ? e.message : undefined);
    } finally { setSavingPromo(false); }
  };

  const handleTogglePromo = async (promo: PromoCode) => {
    setTogglingId(promo.id);
    try {
      const updated = await promosApi.toggle(promo.id, !promo.is_active);
      setPromos(prev => prev.map(p => p.id === updated.id ? { ...p, is_active: updated.is_active } : p));
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setTogglingId(null); }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
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
            {analyticsData && analyticsData.revenue.some(r => r.simplified > 0) ? (
              <div className={styles.chart}>
                <div className={styles.chartBars}>
                  {analyticsData.revenue.map((d, i) => {
                    const maxV = Math.max(...analyticsData.revenue.map(r => r.simplified), 1);
                    return (
                      <div key={i} className={styles.barGroup}>
                        <div className={styles.barSimplified} style={{ height: `${Math.max(4, (d.simplified / maxV) * 100)}%` }} />
                      </div>
                    );
                  })}
                </div>
                <div className={styles.legend}>
                  <span className={styles.legendGreen}>■ Revenue</span>
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
                  { label: 'Avg. Fit Score',        value: `${fitData.avg_fit_score} ★` },
                  { label: 'Feedback Submitted',    value: fitData.feedback_count.toString() },
                  { label: 'Alteration Rate',       value: `${fitData.alteration_rate}%` },
                  { label: 'Alteration → Good Fit', value: `${fitData.alteration_success_rate}%` },
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
              {fitData.hub_performance.length > 0 && (
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Fit Score by Hub</h2>
                  <div className={styles.fitBars}>
                    {fitData.hub_performance.map(h => (
                      <div key={h.name} className={styles.fitRow}>
                        <span className={styles.fitCat}>{h.name}</span>
                        <div className={styles.fitBarWrap}>
                          <div className={`${styles.fitBar} ${h.avg_fit_score < 4 ? styles.fitBarLow : styles.fitBarHigh}`}
                            style={{ width: `${(h.avg_fit_score / 5) * 100}%` }} />
                        </div>
                        <span className={`${styles.fitScore} ${h.avg_fit_score < 4 ? styles.fitScoreLow : ''}`}>{h.avg_fit_score} ★</span>
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

          {promos.length === 0 ? (
            <EmptyState message="No promo codes created yet. Use the button above to create your first promo code." />
          ) : (
            <div className={styles.card}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Uses</th><th>Expiry</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {promos.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.code}</strong></td>
                      <td>{p.discount_type === 'percent' ? 'Percentage' : 'Flat (₹)'}</td>
                      <td>{p.discount_type === 'percent' ? `${p.discount_value}%` : `₹${p.discount_value}`}</td>
                      <td>{p.min_order_amount > 0 ? `₹${p.min_order_amount}` : '—'}</td>
                      <td>{p.max_uses ?? '∞'}</td>
                      <td>{p.valid_until ? new Date(p.valid_until).toLocaleDateString('en-IN') : '—'}</td>
                      <td>
                        <span className={p.is_active ? styles.onTrack : styles.behind}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={styles.exportBtn}
                          disabled={togglingId === p.id}
                          onClick={() => handleTogglePromo(p)}
                          title={p.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {p.is_active ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                          {p.is_active ? ' Deactivate' : ' Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Promo modal */}
      {showPromoModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPromoModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Create Promo Code</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Code *</label>
                <input className={styles.fieldInput} placeholder="e.g., SAVE10"
                  value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Type</label>
                <select className={styles.fieldSelect} value={promoType} onChange={e => setPromoType(e.target.value as 'percent' | 'flat')}>
                  <option value="percent">Percentage (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Value *</label>
                <input className={styles.fieldInput} placeholder={promoType === 'percent' ? 'e.g., 10' : 'e.g., 200'}
                  value={promoValue} onChange={e => setPromoValue(e.target.value)} type="number" min="0" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Min Order Amount (₹)</label>
                <input className={styles.fieldInput} placeholder="e.g., 500 (optional)"
                  value={promoMinOrder} onChange={e => setPromoMinOrder(e.target.value)} type="number" min="0" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Max Uses (total)</label>
                <input className={styles.fieldInput} placeholder="Leave blank for unlimited"
                  value={promoMaxUses} onChange={e => setPromoMaxUses(e.target.value)} type="number" min="1" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Expiry Date</label>
                <input type="date" className={styles.fieldInput}
                  value={promoExpiry} onChange={e => setPromoExpiry(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowPromoModal(false)}>Cancel</button>
              <button className={styles.createBtn} disabled={savingPromo} onClick={handleCreatePromo}>
                {savingPromo ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

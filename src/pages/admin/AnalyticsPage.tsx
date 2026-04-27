import React from 'react';
import { useParams } from 'react-router-dom';
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

const revenueKpis = [
  { label: 'Total GMV', value: '₹28.4L', trend: '+22%', up: true },
  { label: 'Simplified GMV', value: '₹18.2L', trend: '+18%', up: true },
  { label: 'Luxe Prime GMV', value: '₹10.2L', trend: '+31%', up: true },
  { label: 'Avg. Order Value', value: '₹2,279', trend: '+6%', up: true },
];

const topProducts = [
  { rank: 1, name: 'Bridal Lehenga', mode: 'Luxe', orders: 8, revenue: 520000, avg: 65000 },
  { rank: 2, name: 'Oxford Shirt', mode: 'Simplified', orders: 142, revenue: 178000, avg: 1254 },
  { rank: 3, name: 'Wedding Sherwani', mode: 'Luxe', orders: 6, revenue: 168000, avg: 28000 },
  { rank: 4, name: 'Slim Fit Trouser', mode: 'Simplified', orders: 128, revenue: 129000, avg: 1008 },
  { rank: 5, name: 'Straight Kurta', mode: 'Simplified', orders: 115, revenue: 103000, avg: 896 },
];

const promos = [
  { code: 'ZAVEFIT10', type: 'Percentage', value: '10%', usage: '45 / 200', expiry: '30 Apr 2026', status: 'Active' },
  { code: 'WELCOME100', type: 'Flat (₹)', value: '₹100', usage: '312 / 500', expiry: '31 May 2026', status: 'Active' },
  { code: 'LUXE500', type: 'Flat (₹)', value: '₹500', usage: '28 / 100', expiry: '15 Apr 2026', status: 'Expired' },
  { code: 'FREESHIP', type: 'Free Delivery', value: '—', usage: '89 / unlimited', expiry: 'No expiry', status: 'Active' },
];

const retentionKpis = [
  { label: 'New Customers', value: '94', trend: '+31%', up: true },
  { label: 'Repeat Customers', value: '48', trend: '+12%', up: true },
  { label: 'Repeat Purchase Rate', value: '34%', trend: '+5%', up: true },
  { label: 'Avg. LTV (₹)', value: '₹4,820', trend: '+8%', up: true },
];

export const AnalyticsPage: React.FC = () => {
  const { section = 'revenue' } = useParams<{ section?: string }>();
  const [period, setPeriod] = React.useState('This Month');
  const [showPromoModal, setShowPromoModal] = React.useState(false);

  const validSection = (section as Section) in SECTION_TITLES ? (section as Section) : 'revenue';
  const title = SECTION_TITLES[validSection];

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
            {revenueKpis.map(k => (
              <div key={k.label} className={styles.kpiCard}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
                <div className={`${styles.kpiTrend} ${k.up ? styles.trendUp : styles.trendDown}`}>
                  {k.up ? '▲' : '▼'} {k.trend}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Revenue Trend</h2>
              <button className={styles.exportBtn}>Export CSV</button>
            </div>
            <div className={styles.chart}>
              <div className={styles.chartBars}>
                {[65, 80, 72, 90, 85, 95, 88, 100, 92, 78, 95, 110, 98, 115, 105, 120, 110, 130, 118, 135].map((h, i) => (
                  <div key={i} className={styles.barGroup}>
                    <div className={styles.barSimplified} style={{ height: `${h * 0.6}%` }} />
                    <div className={styles.barLuxe} style={{ height: `${h * 0.4}%` }} />
                  </div>
                ))}
              </div>
              <div className={styles.legend}>
                <span className={styles.legendGreen}>■ Simplified</span>
                <span className={styles.legendGold}>■ Luxe Prime</span>
              </div>
            </div>
          </div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Top Products by Revenue</h2>
            <table className={styles.table}>
              <thead><tr><th>Rank</th><th>Product</th><th>Mode</th><th>Orders</th><th>Revenue</th><th>Avg. Price</th></tr></thead>
              <tbody>
                {topProducts.map(p => (
                  <tr key={p.rank}>
                    <td className={styles.rank}>#{p.rank}</td>
                    <td className={styles.productName}>{p.name}</td>
                    <td><span className={`${styles.pill} ${p.mode === 'Luxe' ? styles.pillGold : styles.pillGreen}`}>{p.mode}</span></td>
                    <td>{p.orders}</td>
                    <td>₹{p.revenue.toLocaleString()}</td>
                    <td>₹{p.avg.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Orders Analytics */}
      {validSection === 'orders' && (
        <>
          <div className={styles.kpiGrid}>
            {[
              { label: 'Total Orders', value: '1,247', trend: '+15%', up: true },
              { label: 'Completed', value: '1,064', trend: '+18%', up: true },
              { label: 'Cancellation Rate', value: '4.2%', trend: '-1.1%', up: true },
              { label: 'Return Rate', value: '2.8%', trend: '-0.5%', up: true },
            ].map(k => (
              <div key={k.label} className={styles.kpiCard}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
                <div className={`${styles.kpiTrend} ${k.up ? styles.trendUp : styles.trendDown}`}>{k.trend}</div>
              </div>
            ))}
          </div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Stage Latency (Avg. Days per Stage)</h2>
            <table className={styles.table}>
              <thead><tr><th>Stage</th><th>Avg. Days</th><th>Target</th><th>Status</th></tr></thead>
              <tbody>
                {[
                  { stage: 'Fabric Sourced', avg: 0.4, target: 0.5, ok: true },
                  { stage: 'In Tailoring', avg: 4.8, target: 4.0, ok: false },
                  { stage: 'Quality Check', avg: 0.6, target: 0.5, ok: true },
                  { stage: 'Ready to Dispatch', avg: 0.2, target: 0.3, ok: true },
                  { stage: 'Dispatched → Delivered', avg: 2.1, target: 2.0, ok: true },
                ].map(s => (
                  <tr key={s.stage}>
                    <td>{s.stage}</td>
                    <td>{s.avg} days</td>
                    <td>{s.target} days</td>
                    <td><span className={s.ok ? styles.onTrack : styles.behind}>{s.ok ? '✓ On Track' : '⚠ Behind'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Fit Scores */}
      {validSection === 'fit-scores' && (
        <>
          <div className={styles.kpiGrid}>
            {[
              { label: 'Avg. Fit Score', value: '4.2 ★', trend: '+0.3', up: true },
              { label: 'Feedback Submitted', value: '847', trend: '+22%', up: true },
              { label: 'Alteration Rate', value: '12%', trend: '-3%', up: true },
              { label: 'Alteration → Good Fit', value: '94%', trend: '+2%', up: true },
            ].map(k => (
              <div key={k.label} className={styles.kpiCard}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
                <div className={`${styles.kpiTrend} ${k.up ? styles.trendUp : styles.trendDown}`}>{k.trend}</div>
              </div>
            ))}
          </div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Fit Score by Category</h2>
            <div className={styles.fitBars}>
              {[
                { cat: 'Shirt', score: 4.4 }, { cat: 'Kurta', score: 4.3 },
                { cat: 'Trouser', score: 3.8 }, { cat: 'Lehenga', score: 4.6 },
                { cat: 'Blouse', score: 4.1 }, { cat: 'Sherwani', score: 4.2 },
              ].map(item => (
                <div key={item.cat} className={styles.fitRow}>
                  <span className={styles.fitCat}>{item.cat}</span>
                  <div className={styles.fitBarWrap}>
                    <div className={`${styles.fitBar} ${item.score < 4 ? styles.fitBarLow : styles.fitBarHigh}`}
                      style={{ width: `${(item.score / 5) * 100}%` }} />
                  </div>
                  <span className={`${styles.fitScore} ${item.score < 4 ? styles.fitScoreLow : ''}`}>{item.score} ★</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Hub Performance */}
      {validSection === 'hubs' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Hub Performance Comparison</h2>
          <table className={styles.table}>
            <thead>
              <tr><th>Hub</th><th>City</th><th>Active Orders</th><th>Avg. Production (days)</th><th>QC Pass Rate</th><th>On-Time Rate</th><th>Capacity Util.</th></tr>
            </thead>
            <tbody>
              {[
                { hub: 'Bengaluru Hub 1', city: 'Bengaluru', orders: 42, prod: 7.8, qc: 96, ontime: 92, cap: 70 },
                { hub: 'Bengaluru Hub 2', city: 'Bengaluru', orders: 60, prod: 8.5, qc: 94, ontime: 89, cap: 100 },
                { hub: 'Mumbai Hub 1', city: 'Mumbai', orders: 38, prod: 7.2, qc: 97, ontime: 94, cap: 63 },
                { hub: 'Delhi Hub 1', city: 'Delhi', orders: 25, prod: 9.1, qc: 93, ontime: 88, cap: 50 },
                { hub: 'Chennai Hub 1', city: 'Chennai', orders: 18, prod: 7.0, qc: 98, ontime: 96, cap: 45 },
              ].map(h => (
                <tr key={h.hub}>
                  <td className={styles.productName}>{h.hub}</td>
                  <td>{h.city}</td>
                  <td>{h.orders}</td>
                  <td><span className={h.prod > 8.5 ? styles.behind : h.prod > 8 ? styles.warning : styles.onTrack}>{h.prod}d</span></td>
                  <td><span className={h.qc >= 95 ? styles.onTrack : styles.warning}>{h.qc}%</span></td>
                  <td><span className={h.ontime >= 92 ? styles.onTrack : styles.warning}>{h.ontime}%</span></td>
                  <td><span className={h.cap >= 100 ? styles.behind : h.cap >= 80 ? styles.warning : styles.onTrack}>{h.cap}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Retention */}
      {validSection === 'retention' && (
        <>
          <div className={styles.kpiGrid}>
            {retentionKpis.map(k => (
              <div key={k.label} className={styles.kpiCard}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
                <div className={`${styles.kpiTrend} ${k.up ? styles.trendUp : styles.trendDown}`}>{k.trend}</div>
              </div>
            ))}
          </div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Customer Order Distribution</h2>
            <div className={styles.distributionBars}>
              {[{ label: '1 order', pct: 48, count: 1247 }, { label: '2–3 orders', pct: 31, count: 805 }, { label: '4–6 orders', pct: 14, count: 363 }, { label: '7+ orders', pct: 7, count: 182 }].map(d => (
                <div key={d.label} className={styles.distRow}>
                  <span className={styles.distLabel}>{d.label}</span>
                  <div className={styles.distBarWrap}><div className={styles.distBar} style={{ width: `${d.pct}%` }} /></div>
                  <span className={styles.distPct}>{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Promos */}
      {validSection === 'promos' && (
        <>
          <div className={styles.pageHeader} style={{ marginTop: 0 }}>
            <div />
            <button className={styles.addBtn} onClick={() => setShowPromoModal(true)}>+ Create Promo Code</button>
          </div>
          <div className={styles.card}>
            <table className={styles.table}>
              <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Usage</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {promos.map(p => (
                  <tr key={p.code}>
                    <td><code className={styles.promoCode}>{p.code}</code></td>
                    <td>{p.type}</td>
                    <td>{p.value}</td>
                    <td>{p.usage}</td>
                    <td>{p.expiry}</td>
                    <td><span className={`${styles.statusPill} ${p.status === 'Active' ? styles.statusActive : styles.statusExpired}`}>{p.status}</span></td>
                    <td><div className={styles.actions}><button className={styles.actionBtn}>Edit</button><button className={styles.actionBtn}>Disable</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

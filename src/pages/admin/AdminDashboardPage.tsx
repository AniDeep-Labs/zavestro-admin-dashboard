import React from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/adminApi';
import type { DashboardData } from '../../api/adminApi';
import styles from './AdminDashboardPage.module.css';

const PERIOD_MAP: Record<string, string> = {
  'Today': 'today', 'This Week': 'week', 'This Month': 'month', 'Last 30 Days': 'last30',
};

const kpis = [
  { label: 'Total Orders', key: 'totalOrders', format: (v: number) => v.toLocaleString() },
  { label: 'Active Orders', key: 'activeOrders', format: (v: number) => v.toLocaleString() },
  { label: 'GMV', key: 'gmv', format: (v: number) => '₹' + (v / 100000).toFixed(1) + 'L' },
  { label: 'Pending Payments', key: 'pendingPayments', format: (v: number) => v.toLocaleString() },
  { label: 'Open Tickets', key: 'openTickets', format: (v: number) => v.toLocaleString() },
  { label: 'New Customers', key: 'newCustomers', format: (v: number) => v.toLocaleString() },
];

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = React.useState('This Month');
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    dashboardApi.get(PERIOD_MAP[period] ?? 'month')
      .then(setData)
      .catch(() => { /* silently use last data */ })
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.periodSelector}>
          {['Today', 'This Week', 'This Month', 'Last 30 Days'].map(p => (
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

      {/* KPI Row */}
      <div className={styles.kpiGrid}>
        {kpis.map(kpi => {
          const stat = data?.stats[kpi.key as keyof typeof data.stats];
          return (
            <div key={kpi.key} className={`${styles.kpiCard} ${loading ? styles.kpiCardLoading : ''}`}>
              <div className={styles.kpiLabel}>{kpi.label}</div>
              <div className={styles.kpiValue}>{stat ? kpi.format(stat.value) : '—'}</div>
              {stat && (
                <div className={`${styles.kpiTrend} ${stat.up ? styles.trendUp : styles.trendDown}`}>
                  {stat.up ? '▲' : '▼'} {stat.trend} vs last period
                </div>
              )}
              <div className={styles.sparkline}>
                {[40, 55, 48, 62, 70, 58, 75].map((h, i) => (
                  <div key={i} className={styles.sparkBar} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.twoCol}>
        {/* Hub Performance */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Hub Performance</h2>
            <button className={styles.cardLink} onClick={() => navigate('/admin/hubs')}>View All →</button>
          </div>
          <div className={styles.hubList}>
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
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Alerts</h2>
            {data && <span className={styles.alertCount}>{data.alerts.length}</span>}
          </div>
          <div className={styles.alertList}>
            {(data?.alerts ?? []).map((alert, i) => (
              <div
                key={i}
                className={`${styles.alertItem} ${alert.level === 'red' ? styles.alertRed : styles.alertYellow}`}
                onClick={() => navigate(alert.link)}
              >
                <span className={styles.alertDot} />
                <span className={styles.alertText}>{alert.text}</span>
                <span className={styles.alertArrow}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue mini-chart */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Revenue Trend — {period}</h2>
          <button className={styles.cardLink} onClick={() => navigate('/admin/analytics/revenue')}>Full Report →</button>
        </div>
        <div className={styles.chartPlaceholder}>
          <div className={styles.chartBars}>
            {(data?.revenue ?? []).map((d, i) => {
              const maxV = Math.max(...(data?.revenue ?? []).map(r => r.simplified + r.luxe), 1);
              return (
                <div key={i} className={styles.chartBarGroup}>
                  <div className={styles.chartBarSimplified} style={{ height: `${Math.max(4, (d.simplified / maxV) * 100)}%` }} />
                  <div className={styles.chartBarLuxe} style={{ height: `${Math.max(4, (d.luxe / maxV) * 100)}%` }} />
                </div>
              );
            })}
          </div>
          <div className={styles.chartLegend}>
            <span className={styles.legendSimplified}>■ Simplified</span>
            <span className={styles.legendLuxe}>■ Luxe Prime</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Recent Activity</h2>
        </div>
        <div className={styles.activityList}>
          {(data?.recentActivity ?? []).map((item, i) => (
            <div key={i} className={styles.activityItem}>
              <span className={styles.activityIcon}>{item.icon}</span>
              <span className={styles.activityText}>{item.text}</span>
              <span className={styles.activityTime}>{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

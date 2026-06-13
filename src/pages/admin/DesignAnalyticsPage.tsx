import React from 'react';
import { useNavigate } from 'react-router-dom';
import { designAnalyticsApi } from '../../api/adminApi';
import type { FitAccuracyTotals, DesignPerformanceRow } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { StatusBadge } from '../../components/StatusBadge';
import styles from './OrdersListPage.module.css';
import local from './DesignAnalyticsPage.module.css';

// FTR-style tone: ≥90 healthy, ≥75 watch, below = problem.
const fitTone = (pct: number) => (pct >= 90 ? 'done' : pct >= 75 ? 'qc' : 'blocked');

export const DesignAnalyticsPage: React.FC = () => {
  const [totals, setTotals] = React.useState<FitAccuracyTotals | null>(null);
  const [note, setNote] = React.useState<string>('');
  const [designs, setDesigns] = React.useState<DesignPerformanceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const navigate = useNavigate();
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  React.useEffect(() => {
    Promise.all([designAnalyticsApi.fitAccuracy(), designAnalyticsApi.designPerformance()])
      .then(([fa, dp]) => {
        setTotals(fa.totals);
        setNote(fa.note ?? '');
        setDesigns(dp.designs);
      })
      .catch((e) =>
        setToasts((t) => [
          ...t,
          createToast('error', 'Load failed', e instanceof Error ? e.message : undefined),
        ]),
      )
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: 'Fit accuracy', value: totals ? `${totals.fit_accuracy_pct}%` : '—' },
    { label: 'Delivered orders', value: totals ? totals.delivered.toLocaleString('en-IN') : '—' },
    { label: 'Fit-issue orders', value: totals ? totals.fit_issues.toLocaleString('en-IN') : '—' },
  ];

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Design Analytics</h1>
        <span className={styles.pagination}>How your designs perform on fit &amp; demand</span>
      </div>

      <div className={local.kpiRow}>
        {kpis.map((k) => (
          <div key={k.label} className={local.kpiCard}>
            <span className={local.kpiLabel}>{k.label}</span>
            <span className={local.kpiValue}>{loading ? '…' : k.value}</span>
          </div>
        ))}
      </div>
      {note && <p className={local.subtleNote}>{note}</p>}

      <h2 className={local.sectionHeading}>Design performance</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Design</th><th>Units</th><th>Orders</th><th>Fit-issue orders</th><th>Fit accuracy</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : designs.length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>No delivered orders yet — performance appears once designs start selling.</td></tr>
            ) : (
              // Drill-down (W-10): a row → that design's detail (lifecycle + fabrics + fit).
              designs.map((d) => (
                <tr key={d.design_id} className={styles.row} onClick={() => navigate(`/admin/design/library/${d.design_id}`)}>
                  <td className={styles.customerName} style={{ fontWeight: 500 }}>{d.design_name}</td>
                  <td className={styles.total} style={{ fontWeight: 600 }}>{d.units}</td>
                  <td>{d.orders}</td>
                  <td style={{ color: d.fit_issue_orders > 0 ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
                    {d.fit_issue_orders}
                  </td>
                  <td><StatusBadge status={fitTone(d.fit_accuracy_pct)} label={`${d.fit_accuracy_pct}%`} size="sm" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DesignAnalyticsPage;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fitFeedbackApi } from '../../api/adminApi';
import type { FitFeedbackEntry } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { StatusBadge } from '../../components/StatusBadge';
import styles from './OrdersListPage.module.css';

// Fit-Promise radar (W-17): a ≤2 rating is a fit failure that needs rescue.
const fitTone = (n: number) => (n >= 4 ? 'done' : n <= 2 ? 'blocked' : 'qc');

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const areaLabel = (k: string, v: number) => `${k.replace(/_/g, ' ')} ${v < 0 ? 'tight' : 'loose'}`;

export const FitFeedbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState<FitFeedbackEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  React.useEffect(() => {
    fitFeedbackApi
      .list()
      // Failures first — worst fits lead so support sees what to rescue.
      .then((data) => setRows([...data].sort((a, b) => a.overall_fit - b.overall_fit)))
      .catch((e) =>
        setToasts((t) => [
          ...t,
          createToast('error', 'Load failed', e instanceof Error ? e.message : undefined),
        ]),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Fit Feedback</h1>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Hub</th>
              <th>Overall fit</th>
              <th>Areas off</th>
              <th>Notes</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j}>
                      <div className={styles.skeleton} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  No fit feedback yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const off = Object.entries(r.fit_areas || {}).filter(([, v]) => v !== 0);
                return (
                  <tr key={r.id} className={styles.row}>
                    <td className={styles.total}>{r.order_number ?? r.order_id.slice(0, 8)}</td>
                    <td>
                      <div className={styles.customerName}>{r.customer_name ?? '—'}</div>
                    </td>
                    <td>{r.hub_name ?? '—'}</td>
                    <td>
                      <StatusBadge status={fitTone(r.overall_fit)} label={`${r.overall_fit}/5`} size="sm" />
                    </td>
                    <td>
                      {off.length === 0 ? (
                        <span style={{ color: 'var(--color-primary)' }}>perfect</span>
                      ) : (
                        off.map(([k, v]) => (
                          <span
                            key={k}
                            className={`${styles.stagePill} ${styles.stageWarning}`}
                            style={{ marginRight: 4 }}
                          >
                            {areaLabel(k, v as number)}
                          </span>
                        ))
                      )}
                    </td>
                    <td style={{ maxWidth: 240, whiteSpace: 'normal' }}>{r.notes ?? '—'}</td>
                    <td className={styles.date}>{fmtDate(r.created_at)}</td>
                    <td>
                      {r.overall_fit <= 2 && (
                        <button
                          className={styles.exportBtn}
                          onClick={() => navigate(`/admin/orders/${r.order_number ?? r.order_id}`)}
                          title="Open the order to request a free re-measure / book an alteration"
                        >
                          Rescue →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FitFeedbackPage;

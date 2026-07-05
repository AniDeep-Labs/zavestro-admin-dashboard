import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fitFeedbackApi, usersApi, supportApi } from '../../api/adminApi';
import type { FitFeedbackEntry, RescueWatchRow } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal/Modal';
import { Button } from '../../components/Button/Button';
import styles from './OrdersListPage.module.css';
import fs from './FitFeedbackPage.module.css';

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
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  // T1-21 (SP-1): inline rescue on a fit failure — issue goodwill (≤₹500, per-order capped)
  // or request a free re-measure, without leaving the radar.
  const [rescue, setRescue] = React.useState<{ row: FitFeedbackEntry; mode: 'credit' | 'remeasure' } | null>(null);
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // T1-21b Phase 2: rescue watchlist — customers whose rescue rate is abnormal.
  const [watch, setWatch] = React.useState<RescueWatchRow[]>([]);
  React.useEffect(() => { supportApi.rescueWatchlist().then(setWatch).catch(() => {}); }, []);
  const openRescue = (row: FitFeedbackEntry, mode: 'credit' | 'remeasure') => {
    setRescue({ row, mode }); setAmount(''); setReason('');
  };
  const submitRescue = async () => {
    if (!rescue) return;
    const { row, mode } = rescue;
    if (!reason.trim()) return toast('error', 'A reason is required');
    if (mode === 'credit') {
      const amt = Number(amount);
      if (!(amt > 0) || amt > 500) return toast('error', 'Enter an amount up to ₹500');
      setBusy(true);
      try {
        const res = await usersApi.issueCredits(row.user_id, amt, reason.trim(), row.order_id);
        toast('success', `₹${amt} credit issued`, res.order_goodwill_total != null ? `₹${res.order_goodwill_total} goodwill on this order so far.` : undefined);
        setRescue(null);
      } catch (e) {
        toast('error', "Couldn't issue credit", e instanceof Error ? e.message : undefined);
      } finally { setBusy(false); }
    } else {
      setBusy(true);
      try {
        await usersApi.requestRemeasure(row.user_id, { reason: reason.trim(), order_id: row.order_id });
        toast('success', 'Re-measure requested', 'Ops will schedule a free agent visit.');
        setRescue(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : undefined;
        toast('error', msg?.includes('already has an open') ? 'Already requested' : 'Failed', msg);
      } finally { setBusy(false); }
    }
  };

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
      {/* T1-21b Phase 2: rescue watchlist — abnormal rescue rate, for a manager's review */}
      {watch.length > 0 && (
        <div className={fs.watchPanel}>
          <div className={fs.watchTitle}>⚠ Rescue watch — customers over the rescue threshold ({watch[0].window_days}d)</div>
          <div className={fs.watchGrid}>
            {watch.map((w) => (
              <button
                key={w.user_id}
                className={fs.watchCard}
                onClick={() => navigate(`/admin/users/${w.user_id}`)}
                title="Open the customer 360"
              >
                <span className={fs.watchName}>{w.customer_name ?? w.customer_phone ?? w.user_id.slice(0, 8)}</span>
                <span className={fs.watchMeta}>₹{w.goodwill_90d} goodwill · {w.remeasures_90d} re-measures</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
                        <div className={fs.rescueActions}>
                          <button
                            className={styles.exportBtn}
                            onClick={() => openRescue(r, 'credit')}
                            title="Issue goodwill credit (≤₹500, per-order capped)"
                          >
                            Credit
                          </button>
                          <button
                            className={styles.exportBtn}
                            onClick={() => openRescue(r, 'remeasure')}
                            title="Request a free re-measure"
                          >
                            Re-measure
                          </button>
                          <button
                            className={styles.exportBtn}
                            onClick={() => navigate(`/admin/orders/${r.order_number ?? r.order_id}`)}
                            title="Open the order for more options"
                          >
                            Open →
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* T1-21: inline rescue — goodwill credit or free re-measure */}
      <Modal
        open={rescue !== null}
        onClose={() => !busy && setRescue(null)}
        title={rescue?.mode === 'credit' ? 'Issue goodwill credit' : 'Request re-measure'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRescue(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" state={busy ? 'loading' : 'default'} onClick={submitRescue}>
              {rescue?.mode === 'credit' ? 'Issue credit' : 'Request re-measure'}
            </Button>
          </>
        }
      >
        {rescue && (
          <div className={fs.rescueForm}>
            <p className={fs.rescueMeta}>
              {rescue.row.customer_name ?? '—'} · order {rescue.row.order_number ?? rescue.row.order_id.slice(0, 8)}
            </p>
            {rescue.mode === 'credit' && (
              <input
                className={fs.rescueInput}
                type="number"
                min={1}
                max={500}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount (₹, max 500 — per order)"
              />
            )}
            <textarea
              className={fs.rescueInput}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={rescue.mode === 'credit' ? 'Reason (goodwill for the fit issue)' : 'What went wrong with the fit?'}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FitFeedbackPage;

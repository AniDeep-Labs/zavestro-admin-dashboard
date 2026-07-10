import React from 'react';
import { fabricsApi, hubsApi } from '../../api/adminApi';
import type { DeadStock, DeadStockRow, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Can } from '../../components/Can/Can';
import s from './DeadStockPage.module.css';

// T2-15 (O-9): fabric stock that hasn't moved (by last ledger movement) in 30/60/90 days, the
// capital ₹ tied up, and a "flag for markdown" action that surfaces to the CM inbox.
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export const DeadStockPage: React.FC = () => {
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubId, setHubId] = React.useState('');
  const [data, setData] = React.useState<DeadStock | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    fabricsApi
      .deadStock(hubId || undefined)
      .then(setData)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [hubId]);

  React.useEffect(() => { hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {}); }, []);
  React.useEffect(() => { load(); }, [load]);

  const toggleFlag = async (row: DeadStockRow) => {
    try {
      await fabricsApi.flagMarkdown({
        hub_id: row.hub_id ?? '',
        fabric_id: row.fabric_id,
        flagged: !row.markdown_flagged,
      });
      toast('success', row.markdown_flagged ? 'Unflagged' : 'Flagged for markdown');
      load();
    } catch (e) {
      toast('error', 'Could not update', e instanceof Error ? e.message : undefined);
    }
  };

  const bucket = (k: string) => data?.capital_by_bucket?.[k] ?? 0;

  return (
    <div className={s.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={s.pageHeader}>
        <h1 className={s.title}>Dead stock</h1>
        <p className={s.subtitle}>
          Fabric that hasn't moved in {data?.min_days ?? 30}+ days (by last ledger movement, not
          row edits) — the capital tied up, oldest &amp; costliest first. Flag for markdown to send
          it to the CM.
        </p>
      </div>

      <div className={s.toolbar}>
        <select className={s.select} value={hubId} onChange={(e) => setHubId(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      <div className={s.cards}>
        <div className={`${s.kpi} ${s.kpiTotal}`}>
          <span className={s.kpiLabel}>Capital tied up</span>
          <span className={s.kpiValue}>{inr(data?.total_capital ?? 0)}</span>
        </div>
        <div className={s.kpi}><span className={s.kpiLabel}>30–60 days</span><span className={s.kpiValue}>{inr(bucket('30-60'))}</span></div>
        <div className={s.kpi}><span className={s.kpiLabel}>60–90 days</span><span className={s.kpiValue}>{inr(bucket('60-90'))}</span></div>
        <div className={s.kpi}><span className={s.kpiLabel}>90+ days</span><span className={s.kpiValue}>{inr(bucket('90+'))}</span></div>
      </div>

      <div className={s.card}>
        {loading ? (
          <p className={s.empty}>Loading…</p>
        ) : !data || data.items.length === 0 ? (
          <p className={s.empty}>No dead stock — everything has moved within {data?.min_days ?? 30} days.</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Fabric</th>
                <th>Hub</th>
                <th className={s.num}>Available</th>
                <th className={s.num}>Idle</th>
                <th>Bucket</th>
                <th className={s.num}>Capital</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={`${r.hub_id}-${r.fabric_id}`}>
                  <td>{r.fabric_name ?? r.fabric_code ?? '—'}</td>
                  <td>{r.hub_name ?? '—'}</td>
                  <td className={s.num}>{r.available_meters}m</td>
                  <td className={s.num}>{r.days_idle >= 999 ? '—' : `${r.days_idle}d`}</td>
                  <td className={r.bucket === '90+' ? s.bucket90 : undefined}>{r.bucket}</td>
                  <td className={s.num}>{inr(r.capital)}</td>
                  <td>
                    <Can cap="catalog:write" fallback={r.markdown_flagged ? <span className={s.flagged}>flagged</span> : null}>
                      <button className={s.flagBtn} onClick={() => toggleFlag(r)}>
                        {r.markdown_flagged ? 'Unflag' : 'Flag for markdown'}
                      </button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DeadStockPage;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fitOutcomesApi, hubsApi } from '../../api/adminApi';
import type { FitOutcomes, Hub } from '../../api/adminApi';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import styles from './OrdersListPage.module.css';
import s from './CodReconciliationPage.module.css';

// W-12 (SOLUTIONS P1): the made-to-fit master metric. FTR is the number the
// company lives or dies on — surfaced here for design + finance + super.
const ftrTone = (pct: number | null) =>
  pct == null ? 'neutral' : pct >= 90 ? 'done' : pct >= 85 ? 'qc' : 'blocked';

export const FitOutcomesPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = React.useState<FitOutcomes | null>(null);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubFilter, setHubFilter] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    setError('');
    fitOutcomesApi
      .get({ hub_id: hubFilter || undefined })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [hubFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {}); }, []);

  const o = data?.overall;
  const kpis = [
    { label: 'First-time-right (FTR)', value: o?.ftr_pct != null ? `${o.ftr_pct}%` : '—', tone: ftrTone(o?.ftr_pct ?? null), accent: true },
    { label: 'Alteration rate', value: o?.alteration_pct != null ? `${o.alteration_pct}%` : '—' },
    { label: 'Refund rate', value: o?.refund_pct != null ? `${o.refund_pct}%` : '—' },
    { label: 'Feedback response', value: o?.response_pct != null ? `${o.response_pct}%` : '—' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Fit Outcomes</h1>
        <select className={styles.filterSelect} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {error ? (
        <EmptyState title="Couldn't load fit outcomes" body={error} action={{ label: 'Retry', onClick: load }} />
      ) : (
        <>
          <div className={s.summary}>
            {kpis.map((k) => (
              <div key={k.label} className={s.summaryCard}>
                <div className={s.summaryLabel}>{k.label}</div>
                {k.accent ? (
                  <div className={s.summaryValue}>
                    {loading ? '—' : <StatusBadge status={k.tone as string} label={k.value} />}
                  </div>
                ) : (
                  <div className={s.summaryValue}>{loading ? '—' : k.value}</div>
                )}
              </div>
            ))}
          </div>
          {data?.note && <p className={s.summarySub}>{data.note}</p>}

          {o && o.delivered > 0 && (
            <p className={s.summarySub}>
              {o.delivered} delivered · {o.perfect} perfect · {o.altered} altered · {o.refunded} refunded ·{' '}
              {o.poor} poor · {o.no_response} no response
            </p>
          )}

          <h2 className={s.subHeading}>By hub</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Hub</th><th>Delivered</th><th>FTR</th><th>Alteration</th><th>Refund</th><th>Response</th></tr></thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
                  ))
                ) : !data || data.by_hub.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState title="No delivered orders yet" body="Fit outcomes appear once orders start being delivered." size="compact" /></td></tr>
                ) : (
                  data.by_hub.map((h) => (
                    <tr key={h.hub_id ?? 'none'} className={styles.row} onClick={() => navigate('/admin/fit-feedback')}>
                      <td className={styles.customerName}>{h.hub_name ?? '—'}</td>
                      <td className={styles.total}>{h.delivered}</td>
                      <td><StatusBadge status={ftrTone(h.ftr_pct)} label={h.ftr_pct != null ? `${h.ftr_pct}%` : '—'} size="sm" /></td>
                      <td>{h.alteration_pct != null ? `${h.alteration_pct}%` : '—'}</td>
                      <td>{h.refund_pct != null ? `${h.refund_pct}%` : '—'}</td>
                      <td className={styles.date}>{h.response_pct != null ? `${h.response_pct}%` : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default FitOutcomesPage;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fitOutcomesApi, hubsApi, hasCapability } from '../../api/adminApi';
import type { FitOutcomes, FitOutcomeSummary, Hub } from '../../api/adminApi';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState, PageHeader } from '../../components';
import styles from './OrdersListPage.module.css';
import s from './CodReconciliationPage.module.css';
import local from './FitOutcomesPage.module.css';

// W-12 (SOLUTIONS P1): the made-to-fit master metric. FTR is the number the
// company lives or dies on — surfaced here for design + finance + super.
// FTR off too few responses is statistically meaningless, so we stay neutral
// (don't flash red/green) until there are enough responded orders.
const MIN_RESPONSES = 5;
const responded = (x: FitOutcomeSummary) => x.delivered - x.no_response;
const ftrTone = (pct: number | null, lowSample: boolean) =>
  lowSample || pct == null ? 'neutral' : pct >= 90 ? 'done' : pct >= 85 ? 'qc' : 'blocked';

export const FitOutcomesPage: React.FC = () => {
  const navigate = useNavigate();
  // Only support/super can open Fit Feedback (reviews:moderate). Design reaches this
  // page via fit:read but can't drill into the raw feedback — so don't dead-end them.
  const canDrill = hasCapability('reviews:moderate');
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
  const overallResponded = o ? responded(o) : 0;
  const lowSample = !!o && overallResponded < MIN_RESPONSES;

  const kpis = [
    { label: 'First-time-right (FTR)', value: o?.ftr_pct != null ? `${o.ftr_pct}%` : '—', tone: ftrTone(o?.ftr_pct ?? null, lowSample), accent: true },
    { label: 'Alteration rate', value: o?.alteration_pct != null ? `${o.alteration_pct}%` : '—' },
    { label: 'Refund rate', value: o?.refund_pct != null ? `${o.refund_pct}%` : '—' },
    { label: 'Feedback response', value: o?.response_pct != null ? `${o.response_pct}%` : '—' },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Insights · Fit"
        title="Fit Outcomes"
        subtitle="The made-to-fit master metric (FTR) across all delivered orders, broken down by hub so fit problems surface where they happen."
      />

      <div className={local.toolbar}>
        <select className={local.hubSel} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
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

          {!loading && lowSample && (
            <p className={local.lowNote}>
              ⚠ FTR is based on only {overallResponded} responded order{overallResponded === 1 ? '' : 's'} —
              treat as low-confidence until more fit feedback lands.
            </p>
          )}
          {data?.note && <p className={s.summarySub}>{data.note}</p>}

          {o && o.delivered > 0 && (
            <p className={s.summarySub}>
              {o.delivered} delivered · {o.perfect} perfect · {o.ok} acceptable · {o.altered} altered ·{' '}
              {o.refunded} refunded · {o.poor} poor · {o.no_response} no response
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
                  data.by_hub.map((h) => {
                    const hubLow = responded(h) < MIN_RESPONSES;
                    return (
                      <tr
                        key={h.hub_id ?? 'none'}
                        className={canDrill ? styles.row : undefined}
                        onClick={canDrill ? () => navigate('/admin/fit-feedback') : undefined}
                        title={canDrill ? 'Open fit feedback' : undefined}
                      >
                        <td className={styles.customerName}>{h.hub_name ?? '—'}</td>
                        <td className={styles.total}>{h.delivered}</td>
                        <td><StatusBadge status={ftrTone(h.ftr_pct, hubLow)} label={h.ftr_pct != null ? `${h.ftr_pct}%` : '—'} size="sm" /></td>
                        <td>{h.alteration_pct != null ? `${h.alteration_pct}%` : '—'}</td>
                        <td>{h.refund_pct != null ? `${h.refund_pct}%` : '—'}</td>
                        <td className={styles.date}>{h.response_pct != null ? `${h.response_pct}%` : '—'}</td>
                      </tr>
                    );
                  })
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

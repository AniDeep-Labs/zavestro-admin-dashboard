import React from 'react';
import { useHubContextFilter } from '../../utils/useHubContextFilter'; // [SHL-3-8]
import { useNavigate } from 'react-router-dom';
import { fitOutcomesApi, hubsApi, hasCapability } from '../../api/adminApi';
import type { FitOutcomes, FitOutcomeSummary, Hub, FitFailureAgentRow, ReworkTailorRow } from '../../api/adminApi';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState, PageHeader } from '../../components';
import styles from './OrdersListPage.module.css';
import s from './CodReconciliationPage.module.css';
import local from './FitOutcomesPage.module.css';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

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
  const [agents, setAgents] = React.useState<FitFailureAgentRow[]>([]);
  const [tailors, setTailors] = React.useState<ReworkTailorRow[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  // [SHL-3-8] Defaults to the header hub switcher and follows it. Was React.useState(''),
  // so the global control changed nothing on this page while claiming to.
  const [hubFilter, setHubFilter] = useHubContextFilter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    setError('');
    const params = { hub_id: hubFilter || undefined };
    Promise.all([
      fitOutcomesApi.get(params),
      fitOutcomesApi.byAgent(params),
      fitOutcomesApi.reworkByTailor(params),
    ])
      .then(([d, a, t]) => {
        setData(d);
        setAgents(a);
        setTailors(t);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [hubFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {}); }, []);

  const o = data?.overall;
  const overallResponded = o ? responded(o) : 0;
  const lowSample = !!o && overallResponded < MIN_RESPONSES;

  // [DSG-13-9] Every rate carries its own denominator, and its own low-confidence mark.
  //
  // MIN_RESPONSES greyed out FTR alone. On a two-order sample the neighbouring cards
  // rendered "Alteration rate 0% · Refund rate 50% · Feedback response 100%" as bold,
  // full-confidence numbers, and the amber note underneath spoke only about FTR — so the
  // reader was invited to trust the three uncaveated numbers MORE than the caveated one,
  // which is precisely backwards.
  //
  // They are not even the same fraction: FTR is over orders that RESPONDED, the other
  // three are over orders DELIVERED. A single blanket caveat could never have been right
  // for all four, so each says what it is out of.
  const deliveredN = o?.delivered ?? 0;
  const kpis = [
    // [DSG-13-8] The label carries the threshold. "First-time-right" reads as "needed no
    // alteration" — a different, stricter thing (alterations are their own bucket and
    // outrank feedback). What it actually measures is a 4-or-5 rating out of 5.
    { label: 'First-time-right (rated 4–5 of 5)', value: o?.ftr_pct != null ? `${o.ftr_pct}%` : '—', tone: ftrTone(o?.ftr_pct ?? null, lowSample), accent: true, n: overallResponded, unit: 'responded' },
    { label: 'Alteration rate', value: o?.alteration_pct != null ? `${o.alteration_pct}%` : '—', n: deliveredN, unit: 'delivered' },
    { label: 'Refund rate', value: o?.refund_pct != null ? `${o.refund_pct}%` : '—', n: deliveredN, unit: 'delivered' },
    { label: 'Feedback response', value: o?.response_pct != null ? `${o.response_pct}%` : '—', n: deliveredN, unit: 'delivered' },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Insights · Fit"
        title="Fit Outcomes"
        /* [DSG-13-4] Say which population. Design Analytics scopes its fit accuracy to
           orders containing a DESIGN item, deliberately, so legacy off-the-rack orders
           don't inflate the design team's metric — and it reported "0 delivered" in the
           same session this page graded at 50%. Both were true; neither said over what. */
        subtitle="The made-to-fit master metric (FTR) across EVERY delivered order, including legacy off-the-rack ones, broken down by hub so fit problems surface where they happen. Design Analytics counts only orders with a design item, so its figures are narrower and will not match this page."
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
                  <div className={`${s.summaryValue} ${!loading && k.n < MIN_RESPONSES ? local.lowValue : ''}`}>
                    {loading ? '—' : k.value}
                  </div>
                )}
                {/* [DSG-13-9] What the percentage is out of. A rate over two orders and a
                    rate over two thousand look identical without it. */}
                {!loading && (
                  <div className={local.kpiDenominator}>
                    n = {k.n} {k.unit}
                    {k.n < MIN_RESPONSES ? ' · low confidence' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!loading && lowSample && (
            <p className={local.lowNote}>
              ⚠ Small sample: FTR is based on {overallResponded} responded order
              {overallResponded === 1 ? '' : 's'}, and the other rates on {deliveredN} delivered
              order{deliveredN === 1 ? '' : 's'} — every card above shows its own denominator.
              Treat all four as low-confidence until more fit feedback lands.
            </p>
          )}
          {data?.note && <p className={s.summarySub}>{data.note}</p>}

          {o && o.delivered > 0 && (
            <p className={s.summarySub}>
              {/* [DSG-13-8] Bare "perfect" and "poor" are the words the view uses; the
                  numbers behind them are thresholds, and a legend that hides its cut-offs
                  invites everyone to assume a different one. */}
              {o.delivered} delivered · {o.perfect} perfect <span className={local.threshold}>(4–5 of 5)</span> ·{' '}
              {o.ok} acceptable <span className={local.threshold}>(3)</span> · {o.altered} altered ·{' '}
              {o.refunded} refunded · {o.poor} poor <span className={local.threshold}>(1–2)</span> ·{' '}
              {o.no_response} no response
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

                        title={canDrill ? 'Open fit feedback' : undefined} {...(canDrill ? rowActivation(() => navigate('/admin/fit-feedback')) : {})}>
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

          {/* T2-10: the measurer is the #1 fit-failure source — attribute it for coaching. */}
          <h2 className={s.subHeading}>Fit failure by measuring agent</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Agent</th><th>Delivered</th><th>Responded</th><th>Fit failures</th><th>Failure rate</th></tr></thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
                  ))
                ) : agents.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState title="No agent-measured deliveries yet" body="Fit-failure attribution appears once home-visit orders are delivered." size="compact" /></td></tr>
                ) : (
                  agents.map((a) => {
                    const low = a.responded < MIN_RESPONSES;
                    const tone = low || a.fit_failure_pct == null ? 'neutral' : a.fit_failure_pct >= 15 ? 'blocked' : a.fit_failure_pct >= 8 ? 'qc' : 'done';
                    return (
                      <tr key={a.agent_id}>
                        <td className={styles.customerName}>{a.agent_name ?? '—'}</td>
                        <td className={styles.total}>{a.delivered}</td>
                        <td>{a.responded}</td>
                        <td>{a.fit_failures}</td>
                        <td><StatusBadge status={tone} label={a.fit_failure_pct != null ? `${a.fit_failure_pct}%` : '—'} size="sm" /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <h2 className={s.subHeading}>Rework by tailor</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Tailor</th><th>Rework (total)</th><th>Open</th><th>Completed</th></tr></thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 4 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
                  ))
                ) : tailors.length === 0 ? (
                  <tr><td colSpan={4}><EmptyState title="No rework assigned yet" body="Alterations attributed to a tailor appear here." size="compact" /></td></tr>
                ) : (
                  tailors.map((t) => (
                    <tr key={t.tailor_id}>
                      <td className={styles.customerName}>{t.tailor_name ?? '—'}</td>
                      <td className={styles.total}>{t.rework_count}</td>
                      <td>{t.open_count}</td>
                      <td>{t.completed_count}</td>
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

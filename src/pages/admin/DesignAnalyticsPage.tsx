import React from 'react';
import { useNavigate } from 'react-router-dom';
import { designAnalyticsApi, hubsApi, designsApi } from '../../api/adminApi';
import type {
  FitAccuracyTotals,
  DesignPerformanceRow,
  Hub,
  GarmentCategoryOption,
  AnalyticsFilterParams,
} from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader } from '../../components';
import styles from './OrdersListPage.module.css';
import local from './DesignAnalyticsPage.module.css';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

// FTR-style tone: ≥90 healthy, ≥75 watch, below = problem.
const fitTone = (pct: number) => (pct >= 90 ? 'done' : pct >= 75 ? 'qc' : 'blocked');

export const DesignAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [totals, setTotals] = React.useState<FitAccuracyTotals | null>(null);
  const [note, setNote] = React.useState<string>('');
  const [designs, setDesigns] = React.useState<DesignPerformanceRow[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [categories, setCategories] = React.useState<GarmentCategoryOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // filters (§4C: garment-type + hub + date)
  const [garmentCategoryId, setGarmentCategoryId] = React.useState('');
  const [hubId, setHubId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  // filter option lists (once)
  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
    designsApi.garmentCategories().then(setCategories).catch(() => {});
  }, []);

  React.useEffect(() => {
    setLoading(true);
    const f: AnalyticsFilterParams = {
      hub_id: hubId || undefined,
      garment_category_id: garmentCategoryId || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    };
    Promise.all([designAnalyticsApi.fitAccuracy(f), designAnalyticsApi.designPerformance(f)])
      .then(([fa, dp]) => {
        setTotals(fa.totals);
        setNote(fa.note ?? '');
        setDesigns(dp.designs);
      })
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubId, garmentCategoryId, startDate, endDate]);

  const toneClass = (t: string) =>
    t === 'done' ? local.toneDone : t === 'qc' ? local.toneQc : local.toneBlocked;
  const fitPct = totals?.fit_accuracy_pct;
  const kpis = [
    {
      label: 'Fit accuracy (design orders only)',
      value: fitPct != null ? `${fitPct}%` : '—',
      tone: fitPct != null ? toneClass(fitTone(fitPct)) : undefined,
    },
    { label: 'Delivered orders (with a design item)', value: totals ? totals.delivered.toLocaleString('en-IN') : '—' },
    // [DSG-13-7] Order-level, not garment-level — see the table header below.
    { label: 'Orders w/ a fit issue (any item)', value: totals ? totals.fit_issues.toLocaleString('en-IN') : '—' },
  ];

  // Exceptions-first: worst fit accuracy leads (then most fit-issue orders).
  const worstFirst = [...designs].sort(
    (a, b) => a.fit_accuracy_pct - b.fit_accuracy_pct || b.fit_issue_orders - a.fit_issue_orders,
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow="Design · Analytics"
        title="Design Analytics"
        /* [DSG-13-4] Name the population. These figures count only orders containing a
           DESIGN item — deliberately, so legacy off-the-rack orders don't inflate the
           design team's own metric — and there are currently very few. In one session this
           page read "Delivered orders 0" while Fit Outcomes, one click away, graded the
           same period at 50% FTR. Both were correct under their own scope; neither stated
           it, so the pair read as a contradiction rather than as two questions. */
        subtitle="How your designs perform on fit & demand — worst fitters first, so chart/construction fixes surface. Counts ONLY orders containing a design item, so legacy off-the-rack orders are excluded; Fit Outcomes counts every delivered order and will show higher numbers. Fit issues are recorded per ORDER, not per garment, so a multi-item order counts against every design in it — read the ranking as a shortlist to investigate, not a verdict."
      />

      <div className={local.toolbar}>
        <select className={local.sel} value={garmentCategoryId} onChange={(e) => setGarmentCategoryId(e.target.value)}>
          <option value="">All garment types</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={local.sel} value={hubId} onChange={(e) => setHubId(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <label className={local.dateGroup}>
          <span className={local.dateLbl}>From</span>
          <input className={local.dateField} type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} aria-label="From date" />
        </label>
        <label className={local.dateGroup}>
          <span className={local.dateLbl}>To</span>
          <input className={local.dateField} type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} aria-label="To date" />
        </label>
      </div>

      <div className={local.kpiRow}>
        {kpis.map((k) => (
          <div key={k.label} className={local.kpiCard}>
            <span className={local.kpiLabel}>{k.label}</span>
            <span className={`${local.kpiValue} ${!loading && k.tone ? k.tone : ''}`}>
              {loading ? '…' : k.value}
            </span>
          </div>
        ))}
      </div>
      {note && <p className={local.subtleNote}>{note}</p>}

      <h2 className={local.sectionHeading}>Worst-fitting designs — exceptions first</h2>
      <p className={local.sectionSub}>
        Lowest fit accuracy leads, so the designs that need a chart or construction fix surface first. Respects the filters above; a row opens its detail.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            {/* [DSG-13-7] "Fit-issue orders" implied this design caused them. Both fit-issue
                predicates are ORDER-level, and `alteration_requests` carries no
                `order_item_id` and no `design_id` — the attribution does not exist at
                source. In a two-garment order where only the trousers needed altering,
                BOTH designs are counted, and the table that decides which chart to re-cut
                would rank an innocent design as a worst fitter. The column says what it
                actually measures until the schema can say more. */}
            <tr>
              <th>Design</th>
              <th>Units</th>
              <th>Orders</th>
              <th title="Orders containing this design where SOME item had a fit issue — alterations are recorded per order, not per garment, so a multi-item order counts against every design in it.">
                Orders w/ a fit issue (any item)
              </th>
              <th>Fit accuracy</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : worstFirst.length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>No delivered orders match these filters — performance appears once matching designs sell.</td></tr>
            ) : (
              worstFirst.map((d) => (
                <tr key={d.design_id} className={styles.row} {...rowActivation(() => navigate(`/admin/design/library/${d.design_id}`))}>
                  <td className={`${styles.customerName} ${local.cellName}`}>{d.design_name}</td>
                  <td className={`${styles.total} ${local.cellUnits}`}>{d.units}</td>
                  <td>{d.orders}</td>
                  <td className={d.fit_issue_orders > 0 ? local.fitIssueBad : local.fitIssueOk}>{d.fit_issue_orders}</td>
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

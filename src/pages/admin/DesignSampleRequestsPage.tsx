import React from 'react';
import { useNavigate } from 'react-router-dom';
import { sampleJobsApi, hubsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { SampleJob, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import s from './DesignSampleRequestsPage.module.css';

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');
const STAGES = ['requested', 'cutting', 'stitching', 'design_review', 'reviewed'] as const;
const STAGE_LABELS: Record<string, string> = {
  requested: 'Requested', cutting: 'Cutting', stitching: 'Stitching', design_review: 'In review', reviewed: 'Reviewed',
  approved: 'Reviewed', rejected: 'Rejected',
};
const stepIndex = (status: string) => {
  if (status === 'approved') return 4;
  return STAGES.indexOf(status as (typeof STAGES)[number]);
};

export const DesignSampleRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState<SampleJob[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    sampleJobsApi
      .list(statusFilter ? { status: statusFilter } : {})
      .then(setRows)
      .catch((e) => setToasts((t) => [...t, createToast('error', 'Load failed', e instanceof Error ? e.message : undefined)]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {}); }, []);

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';
  const open = rows.filter((r) => r.status !== 'reviewed' && r.status !== 'approved' && r.status !== 'rejected').length;

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={base.pageHeader}>
        <h1 className={base.title}>My Sample Requests</h1>
        <span className={base.pagination}>{loading ? '' : `${open} in progress · ${rows.length} total`}</span>
      </div>

      <div className={base.filterBar}>
        <select className={base.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="requested">Requested</option>
          <option value="cutting">Cutting</option>
          <option value="stitching">Stitching</option>
          <option value="design_review">In review</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      <div className={base.tableWrap}>
        <table className={base.table}>
          <thead>
            <tr><th>Fabric</th><th>Design</th><th>Hub</th><th>Progress</th><th>Requested</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j}><div className={base.skeleton} /></td>)}</tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className={base.empty}>No sample requests yet. Request one from a fabric in the Fabrics catalog.</td></tr>
            ) : (
              rows.map((r) => {
                const idx = stepIndex(r.status);
                const rejected = r.status === 'rejected';
                return (
                  <tr key={r.id} className={base.row} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/design/samples/${r.id}`)}>
                    <td>
                      <div className={s.fabricCell}>
                        {swatch(r.fabric_image_keys) ? <img className={s.thumb} src={swatch(r.fabric_image_keys)} alt="" /> : <div className={s.thumb} />}
                        <div className={s.fabricText}><span>{r.fabric_name}</span><span className={s.code}>{r.fabric_code}</span></div>
                      </div>
                    </td>
                    <td className={base.customerName} style={{ fontWeight: 500 }}>{r.design_name}</td>
                    <td>{hubName(r.hub_id)}</td>
                    <td>
                      {rejected ? (
                        <span className={`${base.stagePill} ${base.stageNeutral}`}>Rejected</span>
                      ) : (
                        <div className={s.stepper}>
                          <div className={s.dots}>
                            {STAGES.map((_, i) => <span key={i} className={`${s.dot} ${i <= idx ? s.dotOn : ''}`} />)}
                          </div>
                          <span className={s.stepLabel}>{STAGE_LABELS[r.status] ?? r.status}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
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

export default DesignSampleRequestsPage;

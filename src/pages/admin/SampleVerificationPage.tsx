import React from 'react';
import { useNavigate } from 'react-router-dom';
import { sampleJobsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { SampleJob } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Alert, AgeCell } from '../../components';
import { SampleProgress, isTerminalSample } from './SampleProgress';
import base from './OrdersListPage.module.css';
import s from './SampleVerificationPage.module.css';
import { UilImage } from '@iconscout/react-unicons';

const thumbUrl = (j: SampleJob) => {
  const key = j.photo_keys?.[0] || j.fabric_image_keys?.[0];
  return key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '';
};

// Stage groupings (FABLE §4C): the design team reviews `design_review`; everything
// before it is still being made at the hub; everything after is disposed.
const AWAITING = ['design_review'];
const REVIEWED = ['reviewed', 'approved', 'rejected', 'cancelled'];

export const SampleVerificationPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const navigate = useNavigate();
  const [samples, setSamples] = React.useState<SampleJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    sampleJobsApi
      .list({})
      .then(setSamples)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byOldest = (a: SampleJob, b: SampleJob) => +new Date(a.created_at) - +new Date(b.created_at);
  const byNewest = (a: SampleJob, b: SampleJob) => +new Date(b.updated_at) - +new Date(a.updated_at);

  const awaiting = samples.filter((j) => AWAITING.includes(j.status)).sort(byOldest);
  const inProgress = samples.filter((j) => ['requested', 'cutting', 'stitching'].includes(j.status)).sort(byOldest);
  const reviewed = samples.filter((j) => REVIEWED.includes(j.status)).sort(byNewest);

  const row = (j: SampleJob) => (
    <tr key={j.id} className={base.row} onClick={() => navigate(`/admin/design/samples/${j.id}`)} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === "Enter") (() => navigate(`/admin/design/samples/${j.id}`))?.(); }}>
      <td>
        <div className={s.sampleCell}>
          {thumbUrl(j) ? <img className={s.thumb} src={thumbUrl(j)} alt="" /> : <div className={s.thumb}><UilImage size={16} /></div>}
          <div className={s.sampleText}>
            <span className={s.designName}>{j.design_name}</span>
            <span className={s.fabric}>{j.fabric_name}</span>
            {/* T2-32 (D-1): the give-back — this design+fabric went live at N hubs. */}
            {j.listed_hub_count > 0 && (
              <span className={s.listedChip}>
                Listed ✓{j.listed_hub_count > 1 ? ` · ${j.listed_hub_count} hubs` : ''}
              </span>
            )}
          </div>
        </div>
      </td>
      <td>{j.hub_name ?? '—'}</td>
      <td>{j.tailor_name ?? <span className={s.muted}>Unassigned</span>}</td>
      <td><AgeCell since={j.created_at} warnAfterH={isTerminalSample(j.status) ? Infinity : 120} alertAfterH={isTerminalSample(j.status) ? Infinity : 240} /></td>
      <td><SampleProgress status={j.status} /></td>
    </tr>
  );

  const skeleton = (
    <tbody>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j}><div className={base.skeleton} /></td>)}</tr>
      ))}
    </tbody>
  );

  const section = (title: string, list: SampleJob[], emptyMsg: string, muted = false) => (
    <section className={s.section}>
      <h2 className={`${s.sectionTitle} ${muted ? s.sectionMuted : ''}`}>
        {title} <span className={s.count}>{loading ? '' : list.length}</span>
      </h2>
      <div className={base.tableWrap}>
        <table className={base.table}>
          <thead><tr><th>Sample</th><th>Hub</th><th>Maker</th><th>Age</th><th>Stage</th></tr></thead>
          {loading ? skeleton : (
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={5} className={base.empty}>{emptyMsg}</td></tr>
              ) : list.map(row)}
            </tbody>
          )}
        </table>
      </div>
    </section>
  );

  const body = (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      {!embedded && (
        <div className={base.pageHeader}>
          <div>
            <h1 className={base.title}>Sample Review</h1>
            <p className={s.subtitle}>Your verdict gates the first listing per hub (D13) — approve only what's right to wear.</p>
          </div>
        </div>
      )}
      {embedded && (
        <p className={s.subtitle}>Your verdict gates the first listing per hub (D13) — approve only what's right to wear.</p>
      )}

      {/* G-3 honest reality: nothing in this queue moves automatically yet. */}
      <Alert
        type="info"
        title="Samples don't progress automatically yet"
        message="They're cut, stitched and submitted by hub staff manually — this queue moves when the ops floor app ships."
      />

      {section('Awaiting your review', awaiting, 'No samples awaiting review ✓')}
      {inProgress.length > 0 && section('In progress at hub', inProgress, '', true)}
      {section('Reviewed', reviewed, 'Nothing reviewed yet.', true)}
    </>
  );

  return embedded ? body : <div className={base.page}>{body}</div>;
};

export default SampleVerificationPage;

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
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const thumbUrl = (j: SampleJob) => {
  const key = j.photo_keys?.[0] || j.fabric_image_keys?.[0];
  return key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '';
};

// Stage groupings (FABLE §4C): the design team reviews `design_review`; everything
// before it is still being made at the hub; everything after is disposed.
const AWAITING = ['design_review'];
const IN_PROGRESS = ['requested', 'cutting', 'stitching'];
const REVIEWED = ['reviewed', 'approved', 'rejected', 'cancelled'];

// [DSG-12-11] This page used to call `list({})` — no status filter, and the endpoint
// had no LIMIT — then split three buckets client-side. At two rows that is invisible;
// at a year of a multi-hub operation the design console downloads the entire sampling
// history to render a queue of three.
//
// Two requests now. The LIVE buckets are bounded by how much a hub can physically have
// in flight, so they are fetched whole. The REVIEWED bucket only grows, so it takes a
// window — and that window is ordered by `updated_at`, because "recently reviewed"
// means recently JUDGED, not recently requested. A sample requested in January and
// approved in June is the newest verdict and nearly the oldest row.
const LIVE_LIMIT = 200;
const REVIEWED_PAGE = 20;

export const SampleVerificationPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const navigate = useNavigate();
  const [samples, setSamples] = React.useState<SampleJob[]>([]);
  const [reviewedRows, setReviewedRows] = React.useState<SampleJob[]>([]);
  const [reviewedMore, setReviewedMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  // [DSG-12-12] Keys that 404: a photo_key can outlive the object in R2.
  const [broken, setBroken] = React.useState<Set<string>>(new Set());
  const markBroken = (id: string) => setBroken((b) => (b.has(id) ? b : new Set(b).add(id)));
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      sampleJobsApi.list({ statuses: [...AWAITING, ...IN_PROGRESS], limit: LIVE_LIMIT }),
      sampleJobsApi.list({
        statuses: REVIEWED,
        // One more than we show, purely to learn whether there ARE more — so the
        // section can say it is a window instead of implying it is the whole history.
        limit: REVIEWED_PAGE + 1,
        order: 'updated_at',
      }),
    ])
      .then(([live, done]) => {
        setSamples(live);
        setReviewedMore(done.length > REVIEWED_PAGE);
        setReviewedRows(done.slice(0, REVIEWED_PAGE));
      })
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, []);

  const byOldest = (a: SampleJob, b: SampleJob) => +new Date(a.created_at) - +new Date(b.created_at);

  const awaiting = samples.filter((j) => AWAITING.includes(j.status)).sort(byOldest);
  const inProgress = samples.filter((j) => IN_PROGRESS.includes(j.status)).sort(byOldest);
  // Already ordered by the server over `updated_at`; re-sorting here would only be able
  // to reorder the window, not correct it.
  const reviewed = reviewedRows;

  const row = (j: SampleJob) => (
    <tr key={j.id} className={base.row} {...rowActivation(() => navigate(`/admin/design/samples/${j.id}`))}>
      <td>
        <div className={s.sampleCell}>
          {/* [DSG-12-12] "key present but unfetchable" is its own state. Without an
              onError the browser draws its own broken-image icon next to a garment the
              reviewer is being asked to judge — worse than showing no photo at all,
              because it reads as a broken PAGE rather than a missing FILE. */}
          {thumbUrl(j) && !broken.has(j.id) ? (
            <img className={s.thumb} src={thumbUrl(j)} alt="" onError={() => markBroken(j.id)} />
          ) : (
            <div className={s.thumb} title={thumbUrl(j) ? 'Photo unavailable' : undefined}>
              <UilImage size={16} />
            </div>
          )}
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

  const section = (
    title: string,
    list: SampleJob[],
    emptyMsg: string,
    muted = false,
    note?: string,
  ) => (
    <section className={s.section}>
      <h2 className={`${s.sectionTitle} ${muted ? s.sectionMuted : ''}`}>
        {title} <span className={s.count}>{loading ? '' : list.length}</span>
        {/* [DSG-12-11] A windowed list must say so. Rendering a bare "20" next to a
            bucket that is really the 20 most recent of several hundred states a total
            the page does not have. */}
        {!loading && note && <span className={s.windowNote}>{note}</span>}
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

      {/* [DSG-12-2] This banner named the wrong blocker, and kept naming it after the
          blocker was gone. It read "this queue moves when the ops floor app ships" —
          but the ops app HAD shipped; what was missing was the sample workflow inside
          it, so the hub had no way to cut, stitch or submit and every request sat here
          having already consumed the cloth. The Samples tab now exists in the
          hub-manager console, so this queue does move. */}
      <Alert
        type="info"
        title="Samples are cut and submitted by the hub"
        message="Hub staff pick these up in the Samples tab of the ops app: cut, stitch, photograph and send for your review. A sample you approve here is what lets the design be listed at that hub."
      />

      {section('Awaiting your review', awaiting, 'No samples awaiting review ✓')}
      {inProgress.length > 0 && section('In progress at hub', inProgress, '', true)}
      {section(
        'Reviewed',
        reviewed,
        'Nothing reviewed yet.',
        true,
        reviewedMore ? `most recent ${REVIEWED_PAGE}` : undefined,
      )}
    </>
  );

  return embedded ? body : <div className={base.page}>{body}</div>;
};

export default SampleVerificationPage;

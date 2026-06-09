import React from 'react';
import { sampleJobsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { SampleJob } from '../../api/adminApi';
import { Modal } from '../../components/Modal/Modal';
import { Button } from '../../components/Button/Button';
import { Textarea } from '../../components/Textarea/Textarea';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import styles from './SampleVerificationPage.module.css';
import { UilTimes } from '@iconscout/react-unicons';

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  cutting: 'Cutting',
  stitching: 'Stitching',
  design_review: 'Awaiting Review',
  approved: 'Approved',
  rejected: 'Rejected',
};
const STATUS_CSS: Record<string, string> = {
  requested: 'stageNeutral',
  cutting: 'stageBlue',
  stitching: 'stageBlue',
  design_review: 'stageWarning',
  approved: 'stageSuccess',
  rejected: 'stageNeutral',
};

const photoUrl = (key: string) =>
  R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '';

export const SampleVerificationPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = React.useState('design_review');
  const [samples, setSamples] = React.useState<SampleJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [acting, setActing] = React.useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<SampleJob | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    sampleJobsApi
      .list({ status: statusFilter || undefined })
      .then(setSamples)
      .catch((e) => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  const approve = async (s: SampleJob) => {
    setActing(s.id);
    try {
      await sampleJobsApi.approve(s.id);
      showToast('success', 'Sample approved', `${s.design_name} · ${s.fabric_name} is ready to list.`);
      load();
    } catch (e) {
      showToast('error', 'Approve failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActing(null);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActing(rejectTarget.id);
    try {
      await sampleJobsApi.reject(rejectTarget.id, rejectReason.trim());
      showToast('success', 'Sample rejected', 'Sent back to the hub for a rebuild.');
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch (e) {
      showToast('error', 'Reject failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActing(null);
    }
  };

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={base.pageHeader}>
        <h1 className={base.title}>Sample Verification</h1>
      </div>

      <div className={base.filterBar}>
        <select
          className={base.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="design_review">Awaiting Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All Statuses</option>
        </select>
      </div>

      <div className={base.tableWrap}>
        <table className={base.table}>
          <thead>
            <tr>
              <th>Design</th>
              <th>Fabric</th>
              <th>Tailor</th>
              <th>Photos</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j}>
                      <div className={base.skeleton} />
                    </td>
                  ))}
                </tr>
              ))
            ) : samples.length === 0 ? (
              <tr>
                <td colSpan={7} className={base.empty}>
                  No samples in this state.
                </td>
              </tr>
            ) : (
              samples.map((s) => (
                <tr key={s.id} className={base.row}>
                  <td className={styles.designName}>{s.design_name}</td>
                  <td>{s.fabric_name}</td>
                  <td>{s.tailor_name ?? '—'}</td>
                  <td>
                    {s.photo_keys.length === 0 ? (
                      <span className={styles.noPhotos}>None</span>
                    ) : (
                      <div className={styles.photoStrip}>
                        {s.photo_keys.slice(0, 4).map((k) =>
                          photoUrl(k) ? (
                            <a
                              key={k}
                              href={photoUrl(k)}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.thumb}
                              title="Open full size"
                            >
                              <img src={photoUrl(k)} alt="sample" />
                            </a>
                          ) : (
                            <span key={k} className={styles.thumbFallback}>
                              IMG
                            </span>
                          ),
                        )}
                        {s.photo_keys.length > 4 && (
                          <span className={styles.morePhotos}>+{s.photo_keys.length - 4}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`${base.stagePill} ${base[STATUS_CSS[s.status] ?? 'stageNeutral']}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    {s.status === 'rejected' && s.rejection_reason && (
                      <div className={styles.rejectReason} title={s.rejection_reason}>
                        {s.rejection_reason}
                      </div>
                    )}
                  </td>
                  <td className={base.date}>
                    {new Date(s.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td>
                    {s.status === 'design_review' ? (
                      <div className={styles.actions}>
                        <Button
                          size="sm"
                          variant="primary"
                          state={acting === s.id ? 'loading' : 'default'}
                          onClick={() => approve(s)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={acting === s.id}
                          onClick={() => {
                            setRejectTarget(s);
                            setRejectReason('');
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className={styles.noActions}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={rejectTarget ? `Reject "${rejectTarget.design_name}"` : 'Reject sample'}
      >
        <div className={styles.modalBody}>
          <p className={styles.modalHint}>
            The hub will rebuild the sample. Tell them what's wrong.
          </p>
          <Textarea
            value={rejectReason}
            onChange={setRejectReason}
            label="Rejection reason"
            placeholder="e.g. collar uneven, sleeve length off by 2cm…"
          />
          <div className={styles.modalActions}>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              <UilTimes size={15} /> Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!rejectReason.trim()}
              state={acting === rejectTarget?.id ? 'loading' : 'default'}
              onClick={submitReject}
            >
              Reject sample
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SampleVerificationPage;

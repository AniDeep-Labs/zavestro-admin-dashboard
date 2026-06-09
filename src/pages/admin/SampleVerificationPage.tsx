import React from 'react';
import { Link } from 'react-router-dom';
import { sampleJobsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { SampleJob } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import styles from './SampleVerificationPage.module.css';
import { UilImage, UilAngleRightB } from '@iconscout/react-unicons';

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

const photoUrl = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

export const SampleVerificationPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = React.useState('design_review');
  const [samples, setSamples] = React.useState<SampleJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    sampleJobsApi
      .list({ status: statusFilter || undefined })
      .then(setSamples)
      .catch((e) => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter]);

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

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.cardSkeleton}`}>
              <div className={styles.thumbSkeleton} />
              <div className={styles.cardBody}>
                <div className={styles.lineSkeleton} />
                <div className={`${styles.lineSkeleton} ${styles.lineShort}`} />
              </div>
            </div>
          ))}
        </div>
      ) : samples.length === 0 ? (
        <div className={styles.emptyState}>No samples in this state.</div>
      ) : (
        <div className={styles.grid}>
          {samples.map((s) => {
            const hero = photoUrl(s.photo_keys[0]);
            return (
              <Link key={s.id} to={`/admin/design/samples/${s.id}`} className={styles.card}>
                <div className={styles.thumb}>
                  {hero ? (
                    <img src={hero} alt={s.design_name} />
                  ) : (
                    <div className={styles.thumbEmpty}>
                      <UilImage size={28} />
                      <span>No photo</span>
                    </div>
                  )}
                  <span
                    className={`${base.stagePill} ${base[STATUS_CSS[s.status] ?? 'stageNeutral']} ${styles.cardPill}`}
                  >
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  {s.photo_keys.length > 1 && (
                    <span className={styles.photoCount}>{s.photo_keys.length} photos</span>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{s.design_name}</div>
                  <div className={styles.cardSub}>{s.fabric_name}</div>
                  <div className={styles.cardMeta}>
                    <span>{s.tailor_name ?? 'Unassigned'}</span>
                    <span className={styles.reviewLink}>
                      Review <UilAngleRightB size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SampleVerificationPage;

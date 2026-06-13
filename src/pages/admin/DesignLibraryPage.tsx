import React from 'react';
import { Link } from 'react-router-dom';
import { designsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { DesignSummary } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import styles from './SampleVerificationPage.module.css';
import { UilImage, UilAngleRightB, UilLayerGroup, UilPlus } from '@iconscout/react-unicons';
import { Button } from '../../components/Button/Button';
import { StatusBadge } from '../../components/StatusBadge';

// G-34 lifecycle chip: where is this design in its life? (sampled → reviewed → live)
function lifecycle(d: DesignSummary): { status: string; label: string } | null {
  if ((d.live_hub_count ?? 0) > 0)
    return { status: 'done', label: `Live · ${d.live_hub_count} hub${d.live_hub_count === 1 ? '' : 's'}` };
  if (d.has_reviewed_sample) return { status: 'fit', label: 'Reviewed — ready to list' };
  if ((d.sample_count ?? 0) > 0) return { status: 'making', label: 'Sampled' };
  if (d.status === 'published') return { status: 'qc', label: 'Never listed' }; // dead design
  return null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};
const STATUS_CSS: Record<string, string> = {
  draft: 'stageWarning',
  published: 'stageSuccess',
  archived: 'stageNeutral',
};
const photoUrl = (key?: string | null) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(v), d);
    return () => clearTimeout(t);
  }, [v, d]);
  return dv;
}

export const DesignLibraryPage: React.FC = () => {
  const [status, setStatus] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [deadOnly, setDeadOnly] = React.useState(false); // G-34: published, never listed
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const q = useDebounce(search, 350);

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    designsApi
      .list({ status: status || undefined, gender: gender || undefined, q: q || undefined })
      .then(setDesigns)
      .catch((e) => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [status, gender, q]);

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={base.pageHeader}>
        <h1 className={base.title}>Design Library</h1>
        <Link to="/admin/design/library/new">
          <Button variant="primary">
            <UilPlus size={16} /> New design
          </Button>
        </Link>
      </div>

      <div className={base.filterBar}>
        <select className={base.filterSelect} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select className={base.filterSelect} value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">All genders</option>
          <option value="men">Men</option>
          <option value="women">Women</option>
          <option value="unisex">Unisex</option>
        </select>
        <input
          className={base.searchInput}
          placeholder="Search designs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className={`${base.viewChip} ${deadOnly ? base.viewChipActive : ''}`}
          onClick={() => setDeadOnly((v) => !v)}
          title="Published designs that aren't listed at any hub"
        >
          Published, never listed
        </button>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.cardSkeleton}`}>
              <div className={styles.thumbSkeleton} />
              <div className={styles.cardBody}>
                <div className={styles.lineSkeleton} />
                <div className={`${styles.lineSkeleton} ${styles.lineShort}`} />
              </div>
            </div>
          ))}
        </div>
      ) : (() => {
        const shown = deadOnly
          ? designs.filter((d) => d.status === 'published' && (d.live_hub_count ?? 0) === 0)
          : designs;
        if (shown.length === 0)
          return <div className={styles.emptyState}>{deadOnly ? 'No published-but-unlisted designs ✓' : 'No designs yet.'}</div>;
        return (
        <div className={styles.grid}>
          {shown.map((d) => {
            const cover = photoUrl(d.cover_key);
            const lc = lifecycle(d);
            return (
              <Link key={d.id} to={`/admin/design/library/${d.id}`} className={styles.card}>
                <div className={styles.thumb}>
                  {cover ? (
                    <img src={cover} alt={d.name} />
                  ) : (
                    <div className={styles.thumbEmpty}>
                      <UilImage size={28} />
                      <span>No image</span>
                    </div>
                  )}
                  <span
                    className={`${base.stagePill} ${base[STATUS_CSS[d.status] ?? 'stageNeutral']} ${styles.cardPill}`}
                  >
                    {STATUS_LABELS[d.status] ?? d.status}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{d.name}</div>
                  <div className={styles.cardSub}>
                    {d.garment_type}
                    {d.gender ? ` · ${d.gender}` : ''}
                    {d.fit_preset ? ` · ${d.fit_preset}` : ''}
                  </div>
                  {lc && (
                    <div className={styles.lifecycleRow}>
                      <StatusBadge status={lc.status} label={lc.label} size="sm" />
                    </div>
                  )}
                  {d.fabric_swatches && d.fabric_swatches.length > 0 && (
                    <div className={styles.swatchChips}>
                      {d.fabric_swatches.slice(0, 5).map((k, i) => (
                        <span key={i} className={styles.swatchChip}><img src={photoUrl(k)} alt="" /></span>
                      ))}
                      {d.fabric_swatches.length > 5 && <span className={styles.swatchMore}>+{d.fabric_swatches.length - 5}</span>}
                    </div>
                  )}
                  <div className={styles.cardMeta}>
                    <span>
                      <UilLayerGroup size={13} /> {d.fabric_count} fabric
                      {d.fabric_count === 1 ? '' : 's'}
                    </span>
                    <span className={styles.reviewLink}>
                      Open <UilAngleRightB size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
};

export default DesignLibraryPage;

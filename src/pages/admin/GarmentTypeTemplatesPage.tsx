import React from 'react';
import { Link } from 'react-router-dom';
import { designsApi } from '../../api/adminApi';
import type { GarmentCategoryOption } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import { UilAngleRightB } from '@iconscout/react-unicons';

export const GarmentTypeTemplatesPage: React.FC = () => {
  const [cats, setCats] = React.useState<GarmentCategoryOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  React.useEffect(() => {
    designsApi
      .garmentCategories()
      .then(setCats)
      .catch((e) =>
        setToasts((t) => [
          ...t,
          createToast('error', 'Load failed', e instanceof Error ? e.message : undefined),
        ]),
      )
      .finally(() => setLoading(false));
  }, []);

  const captureCount = (c: GarmentCategoryOption) =>
    Array.isArray(c.capture_set) ? (c.capture_set as string[]).length : 0;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Garment-Type Templates</h1>
        <span className={styles.pagination}>The base chart · capture-set · pain-points each design inherits</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Garment type</th><th>Body region</th><th>Capture-set</th><th>Fit presets</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : cats.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No garment types.</td></tr>
            ) : (
              cats.map((c) => {
                const presets = c.available_fit_presets ?? [];
                const configured = captureCount(c) > 0 || presets.length > 0;
                return (
                  <tr key={c.id} className={styles.row}>
                    <td className={styles.customerName} style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--color-text-secondary)' }}>{c.body_region ?? '—'}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {captureCount(c) > 0 ? `${captureCount(c)} fields` : <span style={{ opacity: 0.5 }}>none</span>}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {presets.length ? presets.join(', ') : <span style={{ opacity: 0.5 }}>none</span>}
                    </td>
                    <td>
                      <span className={`${styles.stagePill} ${configured ? styles.stageSuccess : styles.stageWarning}`}>
                        {configured ? 'Configured' : 'Needs setup'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/admin/design/templates/${c.id}`} className={styles.actionBtn} style={{ textDecoration: 'none' }}>
                        Edit template <UilAngleRightB size={13} />
                      </Link>
                    </td>
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

export default GarmentTypeTemplatesPage;

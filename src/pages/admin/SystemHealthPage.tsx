import React from 'react';
import { systemHealthApi } from '../../api/adminApi';
import type { SystemHealth } from '../../api/adminApi';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import styles from './SystemHealthPage.module.css';
import { UilSync } from '@iconscout/react-unicons';

// System Health (FABLE-ADMIN-UIUX §3C / SOLUTIONS P13): integration status +
// core checks + worker liveness. Reads only.
const dot = (ok: boolean) => (ok ? 'done' : 'blocked');

export const SystemHealthPage: React.FC = () => {
  const [health, setHealth] = React.useState<SystemHealth | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    setError('');
    systemHealthApi
      .get()
      .then(setHealth)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const integ = health?.integrations;
  const integrationRows: { label: string; ok: boolean; note?: string }[] = integ
    ? [
        { label: 'Razorpay (payments)', ok: integ.razorpay.configured, note: integ.razorpay.webhook ? 'keys + webhook set' : 'keys set, webhook MISSING' },
        { label: 'Cloudflare R2 (media)', ok: integ.r2.configured },
        { label: 'Firebase (push)', ok: integ.firebase.configured },
        { label: 'SendGrid (email)', ok: integ.sendgrid.configured },
        { label: 'Twilio (SMS/OTP)', ok: integ.twilio.configured },
        { label: 'Shiprocket (delivery)', ok: integ.delivery.shiprocket },
        { label: 'Delhivery (delivery)', ok: integ.delivery.delhivery },
      ]
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>System Health</h1>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          <UilSync size={14} /> {loading ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      {error ? (
        <EmptyState title="Couldn't load system health" body={error} action={{ label: 'Retry', onClick: load }} />
      ) : loading && !health ? (
        <div className={styles.grid}>
          {[1, 2, 3].map((i) => <div key={i} className={styles.skelCard} />)}
        </div>
      ) : health ? (
        <>
          <div className={styles.metaLine}>
            Environment <strong>{health.environment}</strong> · schema v{health.core.schemaVersion ?? '?'} ·
            checked {new Date(health.checkedAt).toLocaleTimeString('en-IN')}
          </div>

          <div className={styles.grid}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Core</h3>
              <div className={styles.row}><span>Database</span><StatusBadge status={dot(health.core.database === 'ok')} label={health.core.database} size="sm" /></div>
              <div className={styles.row}><span>Redis</span><StatusBadge status={dot(health.core.redis === 'ok')} label={health.core.redis} size="sm" /></div>
            </div>

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Worker / queue</h3>
              <div className={styles.row}>
                <span>Invoice queue</span>
                <StatusBadge status={dot(health.worker.status === 'ok')} label={health.worker.status} size="sm" />
              </div>
              {health.worker.stuckInvoices > 0 && (
                <div className={styles.warn}>
                  {health.worker.stuckInvoices} invoice(s) stuck &gt; 30 min — the worker may not be draining the queue.
                </div>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Integrations</h3>
            <p className={styles.note}>Configured = credentials present on the server. It does not live-probe each vendor.</p>
            {integrationRows.map((r) => (
              <div key={r.label} className={styles.row}>
                <span>{r.label}</span>
                <span className={styles.rowRight}>
                  {r.note && <span className={styles.rowNote}>{r.note}</span>}
                  <StatusBadge status={r.ok ? 'done' : 'pending'} label={r.ok ? 'Configured' : 'Not set'} size="sm" />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default SystemHealthPage;

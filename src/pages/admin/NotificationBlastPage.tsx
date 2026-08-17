import React from 'react';
import { notificationsAdminApi } from '../../api/adminApi';
import type { BlastPayload, BlastHistoryRow } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import { UilExclamationTriangle, UilMessage } from "@iconscout/react-unicons";

export const NotificationBlastPage: React.FC = () => {
  const [form, setForm] = React.useState<BlastPayload>({
    subject: '', headline: '', body: '', pushBody: '', ctaText: '', ctaUrl: '', segment: 'opted_in',
  });
  const [confirming, setConfirming] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [audienceCount, setAudienceCount] = React.useState<number | null>(null);
  const [history, setHistory] = React.useState<BlastHistoryRow[] | null>(null); // T2-26 SU-7
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const loadHistory = React.useCallback(() => {
    notificationsAdminApi.history().then(setHistory).catch(() => setHistory([]));
  }, []);
  React.useEffect(() => { loadHistory(); }, [loadHistory]);

  const set = <K extends keyof BlastPayload>(k: K, v: BlastPayload[K]) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.subject.trim() && form.headline.trim() && form.body.trim();

  const openConfirm = () => {
    setAudienceCount(null);
    setConfirming(true);
    notificationsAdminApi
      .audienceCount(form.segment ?? 'opted_in')
      .then(setAudienceCount)
      .catch(() => setAudienceCount(null));
  };

  const send = async () => {
    setSending(true);
    try {
      const payload: BlastPayload = {
        ...form,
        pushBody: form.pushBody?.trim() || undefined,
        ctaText: form.ctaText?.trim() || undefined,
        ctaUrl: form.ctaUrl?.trim() || undefined,
      };
      const { users_targeted } = await notificationsAdminApi.blast(payload);
      showToast('success', 'Blast queued', `Sending to ${users_targeted} customer${users_targeted !== 1 ? 's' : ''} (in-app + email + push).`);
      setConfirming(false);
      setForm({ subject: '', headline: '', body: '', pushBody: '', ctaText: '', ctaUrl: '', segment: 'opted_in' });
      loadHistory(); // T2-26: reflect the just-sent blast in the history table
    } catch (e) {
      showToast('error', 'Send failed', e instanceof Error ? e.message : undefined);
    } finally { setSending(false); }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Notification Blast</h1>
      </div>

      <div className={styles.card} style={{ maxWidth: 680 }}>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Audience</label>
            <select className={styles.fieldInput} value={form.segment} onChange={e => set('segment', e.target.value as BlastPayload['segment'])}>
              <option value="opted_in">Opted-in customers only (recommended)</option>
              <option value="all">All active customers — includes people who did NOT opt in</option>
            </select>
            {/* [KA6-6] "All active customers" is a CONSENT decision, and it was
                presented as a preference: an ordinary dropdown option, with the
                consequence stated nowhere. Choosing it means messaging people who
                declined marketing — a DPDP question, not a reach setting. */}
            {form.segment === 'all' && (
              <div className={styles.consentWarning}>
                <UilExclamationTriangle size={15} />
                <span>
                  This ignores marketing consent. It will message customers who explicitly
                  opted out — only appropriate for a service or safety notice, never a promotion.
                </span>
              </div>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Email Subject *</label>
            <input className={styles.fieldInput} value={form.subject} maxLength={200} onChange={e => set('subject', e.target.value)} placeholder="e.g. New monsoon collection is live" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Headline *</label>
            <input className={styles.fieldInput} value={form.headline} maxLength={200} onChange={e => set('headline', e.target.value)} placeholder="Shown in-app and as the push title" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Body *</label>
            <textarea className={styles.fieldTextarea} value={form.body} maxLength={2000} rows={4} onChange={e => set('body', e.target.value)} placeholder="The main message…" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Push Body (optional — defaults to headline)</label>
            <input className={styles.fieldInput} value={form.pushBody} maxLength={200} onChange={e => set('pushBody', e.target.value)} placeholder="Short text for the push notification" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>CTA Text (optional)</label>
            <input className={styles.fieldInput} value={form.ctaText} maxLength={100} onChange={e => set('ctaText', e.target.value)} placeholder="e.g. Shop now" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>CTA URL (optional — full https:// link)</label>
            <input className={styles.fieldInput} value={form.ctaUrl} onChange={e => set('ctaUrl', e.target.value)} placeholder="https://zavestro.in/collections/monsoon" />
          </div>
        </div>
        <div className={styles.modalActions} style={{ marginTop: 18 }}>
          <button className={styles.createBtn} disabled={!valid} onClick={openConfirm}>
            <UilMessage size={14} /> Review & Send
          </button>
        </div>
      </div>

      {/* T2-26 (SU-7): sent history — every blast, to whom, by whom, when. */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Sent</th><th>Headline</th><th>Audience</th><th>Recipients</th><th>By</th></tr></thead>
          <tbody>
            {history === null ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : history.length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>No blasts sent yet.</td></tr>
            ) : (
              history.map(h => (
                <tr key={h.id}>
                  <td className={styles.date}>{new Date(h.sent_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{h.headline || h.subject || '—'}</td>
                  <td>{h.segment === 'all' ? 'All active' : 'Opted-in'}</td>
                  <td>{h.users_targeted.toLocaleString('en-IN')}</td>
                  <td>{h.sent_by_email ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirming && (
        <div className={styles.modalOverlay} onClick={() => !sending && setConfirming(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}><UilExclamationTriangle size={16} style={{ verticalAlign: -2, marginRight: 6, color: '#B45309' }} />Send this blast?</div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
              This will queue{' '}
              <strong>
                {audienceCount === null
                  ? form.segment === 'all' ? 'all active customers' : 'all opted-in customers'
                  : `~${audienceCount.toLocaleString('en-IN')} ${form.segment === 'all' ? 'active' : 'opted-in'} customer${audienceCount === 1 ? '' : 's'}`}
              </strong>{' '}
              to receive “<strong>{form.headline}</strong>” via in-app inbox, email, and push. This cannot be recalled once sent.
            </p>
            {/* [KA6-6] Say it again at the point of no return, not just at the
                point of selection. */}
            {form.segment === 'all' && (
              <p className={styles.consentWarning}>
                <UilExclamationTriangle size={15} />
                <span>
                  <strong>Consent is being overridden.</strong> This audience includes customers
                  who opted out of marketing. Send only if this is a service or safety notice.
                </span>
              </p>
            )}
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} disabled={sending} onClick={() => setConfirming(false)}>Cancel</button>
              <button className={styles.createBtn} disabled={sending} onClick={send}>{sending ? 'Sending…' : 'Confirm & Send'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBlastPage;

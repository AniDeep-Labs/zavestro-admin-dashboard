import React from 'react';
import { notificationsAdminApi } from '../../api/adminApi';
import type { BlastPayload } from '../../api/adminApi';
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
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

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
              <option value="all">All active customers</option>
            </select>
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

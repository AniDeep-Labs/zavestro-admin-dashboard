import React from 'react';
import { notificationsAdminApi } from '../../api/adminApi';
import type { BlastPayload, BlastHistoryRow } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useDialog } from '../../components/Modal/useDialog'; // [DSA-45-2]
import styles from './OrdersListPage.module.css';
import blast from './NotificationBlastPage.module.css'; // [KA6-7/8/9]
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

  // [DSA-45-2] Hand-rolled overlays get <Modal>'s behaviour without its markup: focus moves
  // in, Tab is trapped, Escape closes, focus returns to whatever opened it, and a screen
  // reader is told this is a dialog. Declared here, ABOVE the early returns — a hook placed
  // after one stops being called the moment the page is loading.
  const confirmBlastDialog = useDialog(
    !!(confirming),
    () => !sending && setConfirming(false),
    'Confirm notification blast',
  );
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

      {/* [KA6-9] The form sat in the left ~45% of a 1440 screen with the rest empty, and its
          width was an inline style. [KA6-7] The product's other composer (banners) renders a
          live device frame; this one — which also lands on a phone — previewed nothing. The
          void and the missing preview are the same gap, so one fixes both. */}
      <div className={blast.composer}>
      <div className={styles.card}>
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
              <div className={blast.consentWarning}>
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
            {/* [KA6-8] `maxLength` stopped over-typing but showed nothing, so an author
                learned the limit by being silently unable to type. */}
            <div className={blast.counterRow}><span>{form.subject.length} / 200</span></div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Headline *</label>
            <input className={styles.fieldInput} value={form.headline} maxLength={200} onChange={e => set('headline', e.target.value)} placeholder="Shown in-app and as the push title" />
            <div className={blast.counterRow}>
              <span>{form.headline.length} / 200</span>
              {form.headline.length > 40 && <span className={blast.counterWarn}>over ~40 — most lock screens cut the title here</span>}
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Body *</label>
            <textarea className={styles.fieldTextarea} value={form.body} maxLength={2000} rows={4} onChange={e => set('body', e.target.value)} placeholder="The main message…" />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Push Body (optional — defaults to headline)</label>
            <input className={styles.fieldInput} value={form.pushBody} maxLength={200} onChange={e => set('pushBody', e.target.value)} placeholder="Short text for the push notification" />
            <div className={blast.counterRow}>
              <span>{(form.pushBody ?? "").length} / 200</span>
              {(form.pushBody ?? "").length > 110 && <span className={blast.counterWarn}>over ~110 — most lock screens cut the body here</span>}
            </div>
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

      {/* [KA6-7] What actually lands. Two surfaces, because one blast becomes two things:
          a push notification on a lock screen (title + body, aggressively truncated by the
          OS) and an in-app card. Rendering the truncation is the point — a headline that
          reads fine in a 680px input is often cut mid-word on a phone, and nothing else on
          this page would have told the author that before it went to everyone. */}
      <aside className={blast.previewRail} aria-label="Preview">
        <p className={blast.previewHead}>Push notification</p>
        <div className={blast.pushCard}>
          <div className={blast.pushApp}>ZAVESTRO · now</div>
          <div className={blast.pushTitle}>{form.headline || 'Your headline'}</div>
          <div className={blast.pushBody}>{form.pushBody || form.headline || 'Your push text'}</div>
        </div>
        <p className={blast.previewNote}>
          Most phones show about 40 characters of title and 110 of body on the lock screen.
        </p>

        <p className={blast.previewHead}>In-app</p>
        <div className={blast.inAppCard}>
          <div className={blast.inAppTitle}>{form.headline || 'Your headline'}</div>
          <div className={blast.inAppBody}>{form.body || 'The main message…'}</div>
          {form.ctaText && <div className={blast.inAppCta}>{form.ctaText}</div>}
        </div>
      </aside>
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
          <div className={styles.modal} {...confirmBlastDialog.dialogProps} onClick={e => e.stopPropagation()}>
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
              <p className={blast.consentWarning}>
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

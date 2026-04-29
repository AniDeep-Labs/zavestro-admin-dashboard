import React from 'react';
import { Search, X, Download, Bell, Send, Trash2 } from 'lucide-react';
import { waitlistApi } from '../../api/adminApi';
import type { WaitlistEntry } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './WaitlistPage.module.css';

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const WaitlistPage: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [entries, setEntries] = React.useState<WaitlistEntry[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [showNotifyModal, setShowNotifyModal] = React.useState(false);
  const [notifyChannel, setNotifyChannel] = React.useState('Email + SMS');
  const [notifySubject, setNotifySubject] = React.useState('');
  const [notifyMessage, setNotifyMessage] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const debouncedSearch = useDebounce(search, 350);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    waitlistApi.list({ search: debouncedSearch || undefined, limit: 200 })
      .then(r => { setEntries(r.entries); setTotal(r.total); })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  const handleRemove = async (entry: WaitlistEntry) => {
    if (!confirm(`Remove ${entry.name || entry.email} from waitlist?`)) return;
    try {
      await waitlistApi.remove(entry.id);
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      setTotal(t => t - 1);
      showToast('success', 'Removed', `${entry.name || entry.email} removed from waitlist`);
    } catch (e) {
      showToast('error', 'Remove failed', e instanceof Error ? e.message : undefined);
    }
  };

  const handleSendNotification = async () => {
    setSending(true);
    try {
      await waitlistApi.notify(notifySubject, notifyMessage);
      setShowNotifyModal(false);
      setNotifySubject(''); setNotifyMessage('');
      showToast('success', 'Notification sent', `Sent to ${total.toLocaleString()} waitlist signups`);
    } catch (e) {
      showToast('error', 'Send failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSending(false);
    }
  };

  const filtered = entries;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Waitlist</h1>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn}><Download size={14}/> Export CSV</button>
          <button className={styles.notifyBtn} onClick={() => setShowNotifyModal(true)}><Bell size={14}/> Notify Waitlist</button>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summaryCard}>
        <div className={styles.totalSignups}>
          <span className={styles.totalValue}>{loading ? '…' : total.toLocaleString()}</span>
          <span className={styles.totalLabel}>Total Signups</span>
        </div>
        <div className={styles.summaryMeta}>
          <span>Last signup: 26 Apr 2026, 10:32 AM</span>
          <span>Signups this week: 42 ↑</span>
        </div>
      </div>

      {/* Notification history */}
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Previous Notifications</h3>
        <table className={styles.miniTable}>
          <thead><tr><th>Date</th><th>Subject</th><th>Recipients</th><th>Channels</th><th>Sent by</th></tr></thead>
          <tbody>
            <tr><td>10 Apr 2026</td><td>We're almost ready — coming soon!</td><td>2,341</td><td>Email + SMS</td><td>admin@zavestro.in</td></tr>
            <tr><td>1 Mar 2026</td><td>Zavestro waitlist confirmed</td><td>1,180</td><td>Email</td><td>admin@zavestro.in</td></tr>
          </tbody>
        </table>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search by name, email, or city…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className={styles.clearBtn} onClick={() => setSearch('')}><X size={14}/> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Signed Up</th><th>Source</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No signups yet.</td></tr>
            ) : (
              filtered.map(entry => (
                <tr key={entry.id} className={styles.row}>
                  <td className={styles.name}>{entry.name}</td>
                  <td>{entry.email}</td>
                  <td>{entry.phone}</td>
                  <td>{entry.city}</td>
                  <td className={styles.date}>{entry.signedUp}</td>
                  <td><span className={styles.sourcePill}>{entry.source}</span></td>
                  <td>
                    <button className={styles.removeBtn} onClick={() => handleRemove(entry)}><Trash2 size={13}/> Remove</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>{loading ? 'Loading…' : `Showing ${filtered.length} of ${total} signups`}</div>

      {/* Notify modal */}
      {showNotifyModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNotifyModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Notify Waitlist</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Send to</label>
                <div className={styles.recipientChoice}>
                  <span className={styles.recipientAll}>All ({total.toLocaleString()} signups)</span>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Channel</label>
                <select className={styles.fieldSelect} value={notifyChannel} onChange={e => setNotifyChannel(e.target.value)}>
                  <option>Email + SMS</option>
                  <option>Email only</option>
                  <option>SMS only</option>
                </select>
              </div>
              {notifyChannel !== 'SMS only' && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Email Subject *</label>
                  <input className={styles.fieldInput} value={notifySubject} onChange={e => setNotifySubject(e.target.value)} placeholder="e.g., Zavestro is now live — you're in!" />
                </div>
              )}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Message * {notifyChannel !== 'Email only' && <span className={styles.smsHint}>(SMS: 160 chars max)</span>}</label>
                <textarea className={styles.fieldTextarea} rows={4} value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} placeholder="Your message to the waitlist…" />
                {notifyChannel !== 'Email only' && <div className={styles.charCount}>{notifyMessage.length} / 160</div>}
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowNotifyModal(false)}>Cancel</button>
              <button
                className={styles.sendBtn}
                disabled={sending || !notifyMessage || (notifyChannel !== 'SMS only' && !notifySubject)}
                onClick={handleSendNotification}
              >
                <Send size={14}/> Send Notification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

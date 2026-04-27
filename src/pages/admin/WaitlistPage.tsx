import React from 'react';
import { waitlistEntries } from '../../data/adminMockData';
import styles from './WaitlistPage.module.css';

export const WaitlistPage: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [showNotifyModal, setShowNotifyModal] = React.useState(false);
  const [notifyChannel, setNotifyChannel] = React.useState('Email + SMS');
  const [notifySubject, setNotifySubject] = React.useState('');
  const [notifyMessage, setNotifyMessage] = React.useState('');

  const filtered = waitlistEntries.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()) || e.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Waitlist</h1>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn}>Export CSV</button>
          <button className={styles.notifyBtn} onClick={() => setShowNotifyModal(true)}>Notify Waitlist</button>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summaryCard}>
        <div className={styles.totalSignups}>
          <span className={styles.totalValue}>{waitlistEntries.length.toLocaleString()}</span>
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
            <tr><td>10 Apr 2026</td><td>We're almost ready — coming soon!</td><td>2,341</td><td>Email + SMS</td><td>admin@zavestro.com</td></tr>
            <tr><td>1 Mar 2026</td><td>Zavestro waitlist confirmed</td><td>1,180</td><td>Email</td><td>admin@zavestro.com</td></tr>
          </tbody>
        </table>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search by name, email, or city…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.clearBtn} onClick={() => setSearch('')}>Clear</button>
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
                    <button className={styles.removeBtn}>Remove</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>Showing {filtered.length} of {waitlistEntries.length} signups</div>

      {/* Notify modal */}
      {showNotifyModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNotifyModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Notify Waitlist</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Send to</label>
                <div className={styles.recipientChoice}>
                  <span className={styles.recipientAll}>All ({waitlistEntries.length.toLocaleString()} signups)</span>
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
                disabled={!notifyMessage || (notifyChannel !== 'SMS only' && !notifySubject)}
                onClick={() => setShowNotifyModal(false)}
              >
                Send Notification →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

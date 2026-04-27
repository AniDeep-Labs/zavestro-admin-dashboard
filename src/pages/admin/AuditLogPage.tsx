import React from 'react';
import { auditLog } from '../../data/adminMockData';
import styles from './AuditLogPage.module.css';

const ACTION_TYPES = ['All', 'order_status_update', 'user_deactivate', 'config_update', 'catalog_create', 'catalog_update', 'content_publish', 'support_ticket_resolved', 'promo_create', 'bulk_status_update'];

export const AuditLogPage: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('All');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const filtered = auditLog.filter(entry => {
    const matchSearch = !search || entry.action.toLowerCase().includes(search.toLowerCase()) || entry.entityId.toLowerCase().includes(search.toLowerCase()) || entry.admin.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Audit Log</h1>
      <div className={styles.subtitle}>Read-only. Every admin write action is automatically logged with the admin's identity.</div>

      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search by action, entity ID, or admin email…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          {ACTION_TYPES.map(a => <option key={a}>{a}</option>)}
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setActionFilter('All'); }}>Clear</button>
        <button className={styles.exportBtn}>Export CSV</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Entity</th>
              <th>IP Address</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No audit entries match your filters.</td></tr>
            ) : (
              filtered.map(entry => (
                <React.Fragment key={entry.id}>
                  <tr className={styles.row} onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                    <td className={styles.timestamp}>{entry.timestamp}</td>
                    <td className={styles.admin}>{entry.admin}</td>
                    <td className={styles.action}>{entry.action}</td>
                    <td>
                      <span className={styles.entityType}>{entry.entityType}</span>
                      <span className={styles.entityId}>{entry.entityId}</span>
                    </td>
                    <td className={styles.ip}>{entry.ip}</td>
                    <td>
                      <button className={styles.expandBtn}>{expandedId === entry.id ? '▲' : '▼'}</button>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={6}>
                        <div className={styles.expandedContent}>
                          <div className={styles.expandedLabel}>Full detail:</div>
                          <pre className={styles.jsonBlock}>{JSON.stringify(entry, null, 2)}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        Showing {filtered.length} of {auditLog.length} entries · Newest first
      </div>
    </div>
  );
};

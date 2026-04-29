import React from 'react';
import { Search, X, Download, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { auditApi } from '../../api/adminApi';
import type { AuditEntry } from '../../api/adminApi';
import styles from './AuditLogPage.module.css';

const LIMIT = 50;

const ACTION_TYPES = ['All', 'order_status_update', 'user_deactivate', 'config_update', 'catalog_create', 'catalog_update', 'content_publish', 'support_ticket_resolved', 'promo_create', 'bulk_status_update'];

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

export const AuditLogPage: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('All');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);

  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const debouncedSearch = useDebounce(search, 350);

  React.useEffect(() => {
    setLoading(true);
    setError('');
    auditApi.list({
      search: debouncedSearch || undefined,
      action: actionFilter !== 'All' ? actionFilter : undefined,
      page,
      limit: LIMIT,
    })
      .then(res => {
        setEntries(res.entries ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [debouncedSearch, actionFilter, page]);

  const clearFilters = () => {
    setSearch('');
    setActionFilter('All');
    setPage(1);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Audit Log</h1>
      <div className={styles.subtitle}>Read-only. Every admin write action is automatically logged with the admin's identity.</div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search by action, entity ID, or admin email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
        >
          {ACTION_TYPES.map(a => <option key={a}>{a}</option>)}
        </select>
        <button className={styles.clearBtn} onClick={clearFilters}><X size={14} /> Clear</button>
        <button className={styles.exportBtn}><Download size={14} /> Export CSV</button>
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
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j}><div className={styles.skeleton} /></td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  <div>{error}</div>
                  <button className={styles.retryBtn} onClick={() => { setError(''); setPage(1); }}>Retry</button>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No audit entries match your filters.</td></tr>
            ) : (
              entries.map(entry => (
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
                      <button className={styles.expandBtn}>{expandedId === entry.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</button>
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

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>
          {loading ? 'Loading…' : `${total} entries total · Newest first`}
        </span>
        <div className={styles.pageButtons}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={15}/> Prev
          </button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages || loading}
            onClick={() => setPage(p => p + 1)}
          >
            Next <ChevronRight size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
};
